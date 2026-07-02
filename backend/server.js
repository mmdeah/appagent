require('dotenv').config();
const jsonServer = require('json-server');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const multer = require('multer');

const server = jsonServer.create();
const middlewares = jsonServer.defaults();

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

// Ensure all required collections exist
try {
  const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const requiredKeys = ['orders', 'quotes', 'reports', 'expenses', 'archived_orders', 'ai_reports', 'todos', 'ald_billings', 'cn_billings', 'fleet_users'];
  let modified = false;
  requiredKeys.forEach(key => {
    if (!dbData[key]) {
      dbData[key] = [];
      modified = true;
    }
  });
  if (modified) {
    fs.writeFileSync(dbFile, JSON.stringify(dbData, null, 2));
    console.log("Updated db.json with missing collections.");
  }
} catch (e) {
  console.error("Error checking/updating db.json structure:", e);
}

// Migrate "Docs Rápidos" -> "Ingresos Rápidos"
try {
  const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  let migrated = 0;
  (dbData.orders || []).forEach(o => {
    if (o.estado === 'Docs Rápidos') { o.estado = 'Ingresos Rápidos'; migrated++; }
  });
  if (migrated > 0) {
    fs.writeFileSync(dbFile, JSON.stringify(dbData, null, 2));
    console.log(`Migrated ${migrated} order(s) from "Docs Rápidos" to "Ingresos Rápidos".`);
  }
} catch (e) {
  console.error("Error running Docs Rápidos migration:", e);
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
  "metodoPago": "Efectivo" o "Nequi" o "Bancolombia" o "Banco de Bogota" o "Tarjeta" (infiere si puedes, sino "Efectivo")
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

    console.log("Calling OpenRouter with model: openai/gpt-oss-120b:free...");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://appagent.up.railway.app",
        "X-Title": "AppAgent"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return res.status(502).json({ error: "Error de OpenRouter API", details: errorText });
    }

    const aiResult = await response.json();
    if (!aiResult.choices || aiResult.choices.length === 0) {
      console.error("Unexpected OpenRouter response:", aiResult);
      return res.status(502).json({ error: "Respuesta inesperada de OpenRouter", details: JSON.stringify(aiResult) });
    }

    let contentText = aiResult.choices[0].message.content.trim();
    
    // Clean JSON formatting from markdown codeblocks if present
    if (contentText.startsWith("```")) {
      contentText = contentText.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    let reportJson;
    try {
      reportJson = JSON.parse(contentText);
    } catch (parseError) {
      console.error("Failed to parse AI content as JSON. Content:", contentText);
      return res.status(500).json({ error: "La IA no devolvió un formato JSON válido", details: contentText });
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
