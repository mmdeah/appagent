require('dotenv').config();
const jsonServer = require('json-server');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const multer = require('multer');

const server = jsonServer.create();
const middlewares = jsonServer.defaults();

// Free OpenRouter models are unreliable (rate limits, upstream overload, models
// going paid). Try each in order and fall back to the next on a recoverable error.
const OPENROUTER_MODEL_CHAIN = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen3-14b:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-4-scout:free',
  'deepseek/deepseek-r1:free',
];
const callOpenRouterWithFallback = async (openRouterKey, { systemPrompt, userPrompt, messages, temperature = 0.3 }) => {
  const chatMessages = messages || [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  let lastErrText = '';
  for (const model of OPENROUTER_MODEL_CHAIN) {
    console.log(`Calling OpenRouter with model: ${model}...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s budget per model
    let resp;
    try {
      resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://appagent.up.railway.app',
          'X-Title': 'AppAgent'
        },
        body: JSON.stringify({ model, messages: chatMessages, temperature })
      });
    } catch (e) {
      lastErrText = e.name === 'AbortError' ? `Tiempo de espera agotado con ${model}` : `Error de red con ${model}: ${e.message}`;
      console.warn(lastErrText);
      continue;
    } finally {
      clearTimeout(timeout);
    }
    if (resp.ok) {
      const data = await resp.json();
      let content = data?.choices?.[0]?.message?.content?.trim() || '';
      // Some models (e.g. DeepSeek R1) emit <think>...</think> reasoning before the real answer
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (content) return { ok: true, content };
      lastErrText = 'Respuesta vacía del modelo ' + model;
      continue;
    }
    lastErrText = await resp.text();
    console.warn(`Model ${model} failed:`, lastErrText);
    // 429 (rate limit), 502/503 (upstream overload) and 404 (model gone) are all worth retrying with the next model
    if (![429, 404, 500, 502, 503].includes(resp.status)) break;
  }
  return { ok: false, error: lastErrText };
};

// Use Railway volume path if available, otherwise use local directory
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dbFile = path.join(dataDir, 'db.json');
const defaultDbFile = path.join(__dirname, 'db.json');

// If the database doesn't exist in the volume, copy the default one
if (dataDir !== __dirname && !fs.existsSync(dbFile)) {
  console.log(`Database not found at ${dbFile}. Copying default db.json...`);
  try {
    fs.copyFileSync(defaultDbFile, dbFile);
  } catch (error) {
    console.error("Error copying db.json:", error);
  }
}

// READ-ONLY startup checks: the server NEVER writes to db.json on boot.
// (Migrations and structure fixes were removed on purpose to protect the data.)
try {
  const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const requiredKeys = ['orders', 'quotes', 'reports', 'expenses', 'archived_orders', 'ai_reports', 'todos', 'ald_billings', 'cn_billings', 'la_ascension_billings', 'fleet_users'];
  const missing = requiredKeys.filter(k => !dbData[k]);
  if (missing.length > 0) console.warn(`WARNING: db.json is missing collections: ${missing.join(', ')} (not modified)`);
  console.log(`DB loaded: ${(dbData.orders || []).length} orders, ${(dbData.expenses || []).length} expenses.`);
} catch (e) {
  console.error("Error reading db.json (file left untouched):", e.message);
}

// Auto-backup on startup: read-only copy of db.json. Skips backup when the DB
// looks empty so a wipe never rotates out the good backups.
try {
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const hasData = (dbData.orders || []).length > 0 || (dbData.expenses || []).length > 0;
  if (hasData) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `db_${stamp}.json`);
    fs.copyFileSync(dbFile, backupFile);
    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('db_')).sort();
    if (backups.length > 10) backups.slice(0, backups.length - 10).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
    console.log(`Backup created: ${backupFile}`);
  } else {
    console.log('DB is empty — skipping startup backup to preserve existing backups.');
  }
} catch (e) {
  console.error("Backup error:", e.message);
}

const router = jsonServer.router(dbFile);

// PDF uploads directory (persists via Railway volume)
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'));
  }
});

server.use(cors());
server.use(middlewares);
server.use(jsonServer.bodyParser);

// Upload PDF for an order
server.post('/api/orders/:orderId/pdfs', upload.single('pdf'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const { orderId } = req.params;
    const db = router.db;
    const order = db.get('orders').find(o => String(o.id) === String(orderId)).value();
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const newPdf = {
      id: Date.now(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    };
    const pdfs = [...(order.pdfs || []), newPdf];
    db.get('orders').find(o => String(o.id) === String(orderId)).assign({ pdfs }).write();
    res.json(newPdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download a PDF
server.get('/api/orders/:orderId/pdfs/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.download(filePath, req.params.filename);
});

// Delete a PDF
server.delete('/api/orders/:orderId/pdfs/:fileId', (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    const db = router.db;
    const order = db.get('orders').find(o => String(o.id) === String(orderId)).value();
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const target = (order.pdfs || []).find(p => String(p.id) === String(fileId));
    if (target) {
      const filePath = path.join(uploadsDir, target.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const pdfs = (order.pdfs || []).filter(p => String(p.id) !== String(fileId));
    db.get('orders').find(o => String(o.id) === String(orderId)).assign({ pdfs }).write();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download full database backup
server.get('/api/backup-db', (req, res) => {
  try {
    const data = fs.readFileSync(dbFile, 'utf8');
    const stamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="db_backup_${stamp}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AI analytics chat: answers business questions using the database (READ-ONLY)
server.post('/api/chat-analytics', async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Se requiere el historial de mensajes' });
    }
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) return res.status(500).json({ error: 'Falta OPENROUTER_API_KEY' });

    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const quotesByOrder = {};
    (db.quotes || []).forEach(q => { (quotesByOrder[q.orderId] = quotesByOrder[q.orderId] || []).push(q); });
    const calcTotals = (o) => {
      const qs = quotesByOrder[o.id] || [];
      const q = qs.find(x => x.autorizada) || qs[0];
      let total = 0, iva = 0; const items = [];
      (q?.items || []).forEach(i => {
        const lt = (Number(i.precio) || 0) * (Number(i.cantidad) || 1);
        total += lt + (i.aplicaIva ? lt * 0.19 : 0);
        if (i.aplicaIva) iva += lt * 0.19;
        items.push(`${i.descripcion} x${i.cantidad || 1} $${Math.round(Number(i.precio) || 0)}`);
      });
      return { total: Math.round(total), iva: Math.round(iva), items };
    };

    const allOrders = db.orders || [];
    const orderLines = allOrders.slice(-250).map(o => {
      const t = calcTotals(o);
      return `#${o.id}|${o.placa}|${o.cliente}|${[o.marca, o.modelo, o.anio].filter(Boolean).join(' ')}|${o.estado}|${(o.fecha || '').split('T')[0]}|pago:${o.metodoPago || '-'}|total:$${t.total}|iva:$${t.iva}|items:[${t.items.join('; ')}]`;
    }).join('\n');

    const allExpenses = db.expenses || [];
    const expenseLines = allExpenses.slice(-400).map(g =>
      `${g.fecha || '?'}|${g.concepto}|${g.categoria || 'sin categoría'}|${g.metodoPago || '-'}|$${g.monto}`
    ).join('\n');

    const dataContext = `FECHA ACTUAL: ${new Date().toISOString().split('T')[0]}

ÓRDENES DE SERVICIO (${allOrders.length} en total; formato: id|placa|cliente|vehículo|estado|fecha ingreso|método pago|total facturado|iva|items cotizados):
${orderLines}

GASTOS (${allExpenses.length} en total; formato: fecha|concepto|categoría|método de pago|monto):
${expenseLines}

NOTAS:
- Estados de órdenes activas: Recepción, Proceso, Calidad, Ingresos Rápidos. Estado final: Entregado.
- "Ingreso Rápido" como cliente = órdenes exprés varias, no un cliente real.
- Los ingresos reales corresponden a órdenes en estado Entregado.`;

    const systemPrompt = `Eres el analista financiero del Taller Automotriz. Respondes preguntas del dueño sobre su negocio usando ÚNICAMENTE los datos reales entregados abajo. Responde SIEMPRE en español. Si la respuesta no está en los datos, dilo claramente en lugar de inventar.

FORMATO DE RESPUESTA (OBLIGATORIO — síguelo siempre):
1. Primera línea: la respuesta directa a la pregunta, empezando con un emoji apropiado (💰 📊 🚗 📈 📉 ⚠️ ✅) y la cifra o dato clave en negrita con **asteriscos dobles**.
2. Luego, si aplica, una sección con detalle usando viñetas que empiecen con "• ". Máximo 6 viñetas.
3. Los títulos de sección van en negrita: **Detalle:**, **Comparación:**, etc.
4. Todas las cifras en pesos colombianos con puntos de miles: $1.250.000 (nunca decimales).
5. En comparaciones usa ▲ para subidas y ▼ para bajadas, con el porcentaje.
6. Si hiciste un cálculo, ciérralo con una línea: 💡 *Cálculo: ingresos - gastos = resultado*
7. Máximo 12 líneas en total. Prohibido: tablas markdown, encabezados con #, bloques de código, respuestas largas.

Ejemplo de respuesta bien formateada:
💰 Este mes has facturado **$42.537.920** en 41 vehículos.

**Detalle:**
• Órdenes entregadas: 41
• Ticket promedio: $1.037.510
• Mejor cliente: La Ascension ($6.021.400)

**Comparación:** ▼ 4% frente al mismo punto de junio.

${dataContext}`;

    const result = await callOpenRouterWithFallback(openRouterKey, {
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))
      ],
      temperature: 0.2
    });
    if (!result.ok) {
      console.error('Chat analytics OpenRouter error:', result.error);
      return res.status(502).json({ error: 'Error de OpenRouter API', details: result.error });
    }
    res.json({ reply: result.content });
  } catch (e) {
    console.error('Error in /api/chat-analytics:', e);
    res.status(500).json({ error: e.message });
  }
});

// Storage diagnostics: is the volume mounted? which backups exist and what do they contain?
server.get('/api/storage-info', (req, res) => {
  try {
    const backupDir = path.join(dataDir, 'backups');
    const backups = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).sort().reverse().map(f => {
      let orders = null, expensesCount = null;
      try {
        const b = JSON.parse(fs.readFileSync(path.join(backupDir, f), 'utf8'));
        orders = (b.orders || []).length;
        expensesCount = (b.expenses || []).length;
      } catch (_) {}
      return { file: f, size: fs.statSync(path.join(backupDir, f)).size, orders, expenses: expensesCount };
    }) : [];
    const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    res.json({
      volumeMounted: !!process.env.RAILWAY_VOLUME_MOUNT_PATH,
      volumePath: process.env.RAILWAY_VOLUME_MOUNT_PATH || null,
      dataDir,
      counts: Object.fromEntries(Object.entries(dbData).map(([k, v]) => [k, Array.isArray(v) ? v.length : 'obj'])),
      backups,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Restore the database from a backup file (keeps a safety copy of the current state)
server.post('/api/restore-backup', (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'filename inválido' });
    }
    const backupPath = path.join(dataDir, 'backups', filename);
    if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'Backup no encontrado' });
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(dbFile, path.join(dataDir, 'backups', `pre-restore_${stamp}.json`));
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
    if (router.db && typeof router.db.setState === 'function') { router.db.setState(data); }
    res.json({ message: `Base de datos restaurada desde ${filename}`, orders: (data.orders || []).length, expenses: (data.expenses || []).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manual, explicit-only provisioning: add a brand-new EMPTY collection key if
// (and only if) it doesn't already exist. Never touches or modifies any existing
// key/data. This never runs automatically — it must be POSTed to on purpose,
// same pattern as /api/migrate-ai-reports below. Needed because json-server's
// REST routes for a resource only exist if the key was present in db.json when
// the router was created at boot.
server.post('/api/ensure-collection', (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !/^[a-z_]+$/.test(name)) return res.status(400).json({ error: 'Nombre de colección inválido' });
    const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    if (dbData[name] !== undefined) {
      return res.json({ message: `La colección "${name}" ya existía. No se modificó nada.`, created: false });
    }
    dbData[name] = [];
    fs.writeFileSync(dbFile, JSON.stringify(dbData, null, 2));
    res.json({ message: `Colección "${name}" creada vacía. El servidor necesita reiniciarse para exponer sus rutas REST.`, created: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// One-time cleanup: move AI reports (no items field) from reports → ai_reports
server.post('/api/migrate-ai-reports', (req, res) => {
  try {
    const db = router.db;
    const allReports = db.get('reports').value() || [];
    const corrupt = allReports.filter(r => !r.items);
    const clean   = allReports.filter(r =>  r.items);

    if (corrupt.length === 0) {
      return res.json({ message: 'Nada que limpiar, todo está bien.', moved: 0 });
    }

    // Move corrupt reports to ai_reports
    corrupt.forEach(r => db.get('ai_reports').push(r).value());
    // Keep only valid reports
    db.set('reports', clean).write();

    res.json({ message: `Se movieron ${corrupt.length} reporte(s) de IA a ai_reports.`, moved: corrupt.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fleet user login
server.post('/api/fleet-login', (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'Faltan credenciales' });
    const db = router.db;
    const user = db.get('fleet_users').find(u => u.usuario === usuario && u.password === password).value();
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Analyze expense image with AI vision
server.post('/api/analyze-expense-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Se requiere imageBase64' });

    const openRouterKey = process.env.OPENROUTER_EXPENSE_KEY || process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) return res.status(500).json({ error: 'Falta OPENROUTER_EXPENSE_KEY' });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://appagent.up.railway.app',
        'X-Title': 'AppAgent'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-preview-05-20',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` }
              },
              {
                type: 'text',
                text: `Analiza esta imagen de un recibo, factura o comprobante de gasto. Extrae los datos y responde SOLO con un objeto JSON válido con estas claves exactas:
{
  "fecha": "YYYY-MM-DD o null si no se ve",
  "concepto": "descripción breve del gasto (ej: Compra aceite motor, Repuestos frenos)",
  "monto": número entero sin símbolos ni puntos ni comas (ej: 45000),
  "metodoPago": "Efectivo" o "Nequi" o "Bancolombia" o "Banco de Bogota" o "Tarjeta" (infiere si puedes, sino "Efectivo"),
  "categoria": "Repuestos" o "Insumos" o "Nómina" o "Arriendo" o "Servicios Públicos" o "Herramientas" o "Impuestos" o "Otros" (clasifica según el contenido del recibo)
}
No incluyas texto adicional, solo el JSON.`
              }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Error de OpenRouter', details: err });
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content?.trim() || '';
    if (content.startsWith('```')) {
      content = content.replace(/^```json?/, '').replace(/```$/, '').trim();
    }

    const data = JSON.parse(content);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Custom routes can be added here
server.post('/api/generate-ai-report', async (req, res) => {
  try {
    const { orderId, selectedItems, allQuotes, notes } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    // Get DB data
    const db = router.db; // lowdb instance used by json-server
    const parsedOrderId = isNaN(orderId) ? orderId : Number(orderId);
    const order = db.get('orders').find(o => String(o.id) === String(parsedOrderId)).value();
    if (!order) {
      return res.status(404).json({ error: `Order with ID ${orderId} not found` });
    }

    // Find quote for the order
    const quote = db.get('quotes').find(q => String(q.orderId) === String(order.id)).value();
    
    // Determine which items to include
    let itemsToAnalyze = [];
    if (quote && quote.items && quote.items.length > 0) {
      if (allQuotes) {
        itemsToAnalyze = quote.items;
      } else if (selectedItems && Array.isArray(selectedItems)) {
        // Handle both index (number) and description (string) matching
        itemsToAnalyze = quote.items.filter((item, index) => 
          selectedItems.includes(index) || 
          selectedItems.includes(item.descripcion) ||
          selectedItems.includes(String(index))
        );
      }
    }

    // Build the prompt for OpenRouter
    const vehicleDesc = `${order.marca} ${order.modelo} (${order.anio || 'N/A'}) con placa ${order.placa}`;
    const quoteItemsText = itemsToAnalyze.length > 0 
      ? itemsToAnalyze.map(item => `- ${item.descripcion} (Cantidad: ${item.cantidad}, Precio: $${item.precio})`).join('\n')
      : "No hay ítems específicos de cotización vinculados.";

    const systemPrompt = `Actúas como un ingeniero automotriz y perito técnico de primer nivel. Tu tarea es redactar un informe técnico automotriz sumamente detallado y estructurado a partir de los datos del vehículo y los trabajos/cotizaciones seleccionados.
Debes responder ESTRICTAMENTE en formato JSON válido que encaje exactamente con el siguiente esquema. No agregues introducciones, explicaciones ni formato markdown en la respuesta, solo el objeto JSON limpio.

Esquema del JSON esperado:
{
  "objeto": "Un párrafo formal que describa el objeto del presente informe (diagnosticar y documentar el estado técnico del vehículo, justificando las intervenciones).",
  "descripcion_ingreso": "Un párrafo formal que detalle por qué el vehículo ingresó al taller y qué novedades generales iniciales se detectaron.",
  "diagnosticos": [
    {
      "titulo": "Nombre del Sistema o Falla (ej: Sistema de Frenos, Dirección, etc.)",
      "hallazgo": "Descripción sumamente técnica y detallada de lo que se encontró en este sistema.",
      "causas": [
        "Causa técnica probable 1",
        "Causa técnica probable 2"
      ],
      "riesgos": [
        "Riesgo técnico/seguridad 1 si no se interviene",
        "Riesgo técnico/seguridad 2 si no se interviene"
      ]
    }
  ],
  "alcance": [
    {
      "tipo": "Preventivo" o "Correctivo",
      "descripcion": "Descripción concisa pero clara de la acción de mantenimiento o reparación realizada/cotizada."
    }
  ],
  "conclusion": "Un párrafo formal que resuma la conclusión técnica general, enfatizando el restablecimiento de la seguridad del vehículo.",
  "recomendacion_alerta": "Una recomendación crítica final sobre la importancia de ejecutar estas intervenciones de manera integral."
}`;

    const userPrompt = `Datos del Vehículo:
- Marca/Modelo: ${order.marca} ${order.modelo}
- Placa: ${order.placa}
- Cliente: ${order.cliente}
- Kilometraje: ${order.kilometraje || 'N/A'} KM
- Motivo de Ingreso: ${order.motivoIngreso || order.servicios || 'Mantenimiento General'}

Trabajos y Repuestos Cotizados Seleccionados:
${quoteItemsText}

Observaciones del Administrador a tener en cuenta para el enfoque de la IA:
${notes || 'Ninguna observación especial.'}

Genera el informe técnico formal en español enfocado en los ítems seleccionados y en los datos del vehículo, siguiendo el esquema JSON proporcionado de manera estricta.`;

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      console.error("Missing OPENROUTER_API_KEY environmental variable.");
      return res.status(500).json({ error: "Falta configurar la variable de entorno OPENROUTER_API_KEY en el servidor." });
    }

    const result = await callOpenRouterWithFallback(openRouterKey, { systemPrompt, userPrompt, temperature: 0.3 });
    if (!result.ok) {
      console.error("OpenRouter API error:", result.error);
      return res.status(502).json({ error: "Error de OpenRouter API", details: result.error });
    }
    let contentText = result.content;
    // Strip markdown code fences
    contentText = contentText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let reportJson;
    try {
      reportJson = JSON.parse(contentText);
    } catch (_) {
      // Try to extract the first { ... } block from the response
      const match = contentText.match(/\{[\s\S]*\}/);
      if (match) {
        try { reportJson = JSON.parse(match[0]); } catch (e2) { reportJson = null; }
      }
    }

    if (!reportJson) {
      console.error("Failed to parse AI content as JSON. Content:", contentText.slice(0, 500));
      return res.status(500).json({ error: "La IA no devolvió JSON válido", details: contentText.slice(0, 400) });
    }

    // Build the data structure for the PDF generator script
    const today = new Date().toLocaleDateString('es-CO');
    const pdfData = {
      output_filename: `Informe_Tecnico_${order.placa}_${Date.now()}.pdf`,
      datos_vehiculo: {
        marca_modelo: `${order.marca} ${order.modelo} ${order.anio || ''}`.trim(),
        placa: order.placa,
        cliente: order.cliente,
        fecha: today,
        motivo: order.motivoIngreso || order.servicios || 'Mantenimiento General y Diagnóstico',
        referencia: quote ? `COT-${quote.id}` : `ORD-${order.id}`
      },
      objeto: reportJson.objeto,
      descripcion_ingreso: reportJson.descripcion_ingreso,
      diagnosticos: reportJson.diagnosticos || [],
      alcance: reportJson.alcance || [],
      conclusion: reportJson.conclusion,
      recomendacion_alerta: reportJson.recomendacion_alerta
    };

    // Save the AI report in its own collection (separate from technician reports)
    const newAiReport = {
      id: Date.now().toString(),
      orderId: order.id,
      fecha: new Date().toISOString(),
      contenido: reportJson
    };
    db.get('ai_reports').push(newAiReport).write();

    // Call the Python script to build the PDF using ReportLab
    console.log("Calling python generate_pdf.py with generated report...");
    const pyProcess = spawn('python3', [path.join(__dirname, 'generate_pdf.py')]);
    
    let stdoutData = "";
    let stderrData = "";
    
    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });
    
    pyProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });
    
    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error("Python process exited with code:", code, stderrData);
        return res.status(500).json({ error: "El script de generación de PDF falló", details: stderrData });
      }
      try {
        const result = JSON.parse(stdoutData.trim());
        if (result.success && result.output) {
          const filePath = path.join(__dirname, result.output);
          res.download(filePath, result.output, (err) => {
            if (err) console.error("Error downloading PDF:", err);
            // Delete temporary file after sending
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
            });
          });
        } else {
          res.status(500).json({ error: "Error en la salida del script de PDF", details: result.error });
        }
      } catch (parseErr) {
        res.status(500).json({ 
          error: "Error al interpretar la salida del script de PDF", 
          stdout: stdoutData, 
          details: parseErr.message 
        });
      }
    });

    pyProcess.stdin.write(JSON.stringify(pdfData, null, 2));
    pyProcess.stdin.end();

  } catch (error) {
    console.error("Internal Server Error in /api/generate-ai-report:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

server.use(router);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`JSON Server is running on port ${port}`);
  console.log(`Using database at ${dbFile}`);
});
