# Guía Completa para IA — Automotriz Online SD

> Este documento describe en detalle todas las funciones, flujos y endpoints de la aplicación de taller automotriz. Está diseñado para que una IA externa pueda entender el sistema, consultar datos y ejecutar acciones correctamente.

---

## 1. ARQUITECTURA GENERAL

| Componente | URL de producción | Descripción |
|---|---|---|
| **Frontend (web)** | `https://appagent.up.railway.app` | React + Vite. Vistas: Admin, Técnico, Cliente |
| **Panel Admin** | `https://appagent.up.railway.app/admin` | Vista exclusiva del administrador |
| **Panel Técnico** | `https://appagent.up.railway.app/technician` | Vista exclusiva del técnico |
| **Portal Cliente** | `https://appagent.up.railway.app/client` | Vista pública para que el cliente consulte su vehículo |
| **Backend (JSON Server)** | `https://json-server-production-0af6.up.railway.app` | Express + json-server. Base de datos en volumen Railway |

Todas las llamadas a la API se hacen contra el Backend. El frontend consume el backend directamente desde el navegador.

---

## 2. BASE DE DATOS — COLECCIONES

El backend usa `json-server` sobre un archivo `db.json` persistido en un volumen Railway. Las colecciones disponibles son:

| Colección | Descripción |
|---|---|
| `orders` | Órdenes de servicio (vehículos en taller) |
| `quotes` | Cotizaciones asociadas a órdenes |
| `reports` | Reportes técnicos subidos por técnicos |
| `ai_reports` | Reportes generados por IA (separados de los del técnico) |
| `expenses` | Gastos / egresos del taller |
| `todos` | Tareas pendientes del admin |
| `settings` | Configuración del formulario de revisión |
| `archived_orders` | Órdenes archivadas (reservado, sin uso activo) |

---

## 3. ENDPOINTS JSON-SERVER (CRUD automático)

`json-server` expone automáticamente endpoints REST para cada colección.  
**Base URL:** `https://json-server-production-0af6.up.railway.app`

### 3.1 Patrón general

```
GET    /{colección}              → lista todos
GET    /{colección}/{id}         → obtiene uno por ID
POST   /{colección}              → crea nuevo registro
PATCH  /{colección}/{id}         → actualiza campos parciales
PUT    /{colección}/{id}         → reemplaza registro completo
DELETE /{colección}/{id}         → elimina registro
```

### 3.2 Parámetros de consulta útiles

```
?_embed=quotes          → incluye cotizaciones dentro de cada orden
?_embed=reports         → incluye reportes dentro de cada orden
?_expand=order          → incluye la orden padre dentro de un reporte
?_sort=fecha&_order=desc → ordena por campo
?placa=ABC123           → filtra por campo exacto
?estado=Proceso         → filtra por estado
```

---

## 4. ESTRUCTURA DE DATOS

### 4.1 Orden (`orders`)

```json
{
  "id": 1,
  "placa": "ABC123",
  "cliente": "Juan Pérez",
  "telefono": "3001234567",
  "correo": "juan@email.com",
  "marca": "Toyota",
  "modelo": "Corolla",
  "anio": "2020",
  "kilometraje": "85000",
  "servicios": "Cambio de aceite y revisión general",
  "notas": "Cliente solicita revisión de frenos",
  "estado": "Recepción",
  "fecha": "2026-05-24T15:00:00.000Z",
  "fotos": ["data:image/jpeg;base64,..."],
  "metodoPago": "Efectivo",
  "notasEntrega": "",
  "checklistFinal": {
    "pruebaRuta": true,
    "limpio": true,
    "herramientas": true,
    "fecha": "2026-05-24T18:00:00.000Z"
  }
}
```

**Estados posibles de una orden (flujo):**
```
Recepción → Proceso → Calidad → Docs Rápidos → Entregado
```

| Estado | Significado |
|---|---|
| `Recepción` | Vehículo recién ingresado, pendiente de revisión |
| `Proceso` | Cotización autorizada, técnico trabajando |
| `Calidad` | Técnico terminó, pendiente de revisión de calidad |
| `Docs Rápidos` | Orden rápida lista para facturar |
| `Entregado` | Vehículo entregado al cliente |

---

### 4.2 Cotización (`quotes`)

```json
{
  "id": 1,
  "orderId": 1,
  "autorizada": true,
  "items": [
    {
      "descripcion": "Pastillas de freno delanteras",
      "cantidad": 1,
      "precio": 120000,
      "aplicaIva": false,
      "prioridad": "urgente"
    },
    {
      "descripcion": "Aceite motor 5W30",
      "cantidad": 4,
      "precio": 35000,
      "aplicaIva": false,
      "prioridad": "plazo_medio"
    }
  ]
}
```

**Valores de `prioridad`:**
| Valor | Significado | Color en UI |
|---|---|---|
| `urgente` | Atención inmediata | Rojo |
| `plazo_medio` | Puede esperar semanas | Amarillo |
| `plazo_largo` | No urgente | Verde |

**Cálculo de totales:**
```
lineTotal = precio × cantidad
lineTotalConIva = aplicaIva ? lineTotal × 1.19 : lineTotal
subtotal = Σ lineTotal (sin IVA)
iva = Σ (aplicaIva ? lineTotal × 0.19 : 0)
total = subtotal + iva
```

---

### 4.3 Reporte Técnico del Técnico (`reports`)

```json
{
  "id": "1716580800000",
  "orderId": 1,
  "fecha": "2026-05-24T18:00:00.000Z",
  "precioDiagnostico": 50000,
  "items": [
    {
      "category": "Frenos",
      "item": "Pastillas Del.",
      "state": "Malo",
      "manoObra": "80000",
      "requiereRepuesto": true,
      "recibeReparacion": false
    },
    {
      "category": "Suspensión",
      "item": "Amortiguadores Del.",
      "state": "Regular",
      "manoObra": "60000",
      "requiereRepuesto": false,
      "recibeReparacion": true
    },
    {
      "category": "Insumos",
      "item": "Silicona",
      "state": "Necesario",
      "cantidad": 2
    },
    {
      "category": "Servicios Especializados",
      "item": "Diagnostico Profundo en",
      "state": "Realizar",
      "area": "Motor",
      "manoObra": "150000"
    }
  ],
  "scannerCodes": [
    {
      "prefix": "P",
      "code": "0301",
      "description": "Fallo de encendido cilindro 1"
    }
  ]
}
```

**Estados de ítem:**
| Estado | Aplica a | Significado |
|---|---|---|
| `Bueno` | Categorías normales | Sin novedad |
| `Regular` | Categorías normales | Requiere atención próxima |
| `Malo` | Categorías normales | Requiere intervención inmediata |
| `Necesario` | Insumos | El insumo es requerido |
| `Realizar` | Servicios Especializados | El servicio debe realizarse |

**Prefijos de códigos DTC:**
| Prefijo | Sistema |
|---|---|
| `P` | Powertrain (motor/transmisión) |
| `B` | Body (carrocería) |
| `C` | Chassis (chasis) |
| `U` | Network (red/comunicaciones) |

---

### 4.4 Reporte IA (`ai_reports`)

```json
{
  "id": "1716580800001",
  "orderId": 1,
  "fecha": "2026-05-24T19:00:00.000Z",
  "contenido": {
    "objeto": "El presente informe documenta...",
    "descripcion_ingreso": "El vehículo ingresa al taller...",
    "diagnosticos": [
      {
        "titulo": "Sistema de Frenos",
        "hallazgo": "Se evidencian pastillas con desgaste crítico...",
        "causas": ["Desgaste por uso prolongado", "Falta de mantenimiento preventivo"],
        "riesgos": ["Pérdida de capacidad de frenado", "Daño en discos"]
      }
    ],
    "alcance": [
      { "tipo": "Correctivo", "descripcion": "Reemplazo de pastillas de freno delanteras" },
      { "tipo": "Preventivo", "descripcion": "Cambio de líquido de frenos" }
    ],
    "conclusion": "El vehículo presenta condiciones que requieren...",
    "recomendacion_alerta": "Se recomienda ejecutar todas las intervenciones..."
  }
}
```

---

### 4.5 Gasto (`expenses`)

```json
{
  "id": 1,
  "fecha": "2026-05-24",
  "concepto": "Compra de aceites y filtros",
  "monto": 250000,
  "metodoPago": "Nequi"
}
```

**Métodos de pago válidos:** `Efectivo`, `Nequi`, `Bancolombia`, `Banco de Bogota`, `Tarjeta`

---

### 4.6 Tarea (`todos`)

```json
{
  "id": 1,
  "text": "Llamar a proveedor de repuestos",
  "completed": false
}
```

---

### 4.7 Configuración (`settings`)

```json
{
  "id": "revision_form",
  "categories": {
    "Suspensión": ["Amortiguadores Del.", "Amortiguadores Tras.", "Bujes de Tijera"],
    "Frenos": ["Pastillas Del.", "Pastillas Tras.", "Discos Del.", "Discos Tras."],
    "Dirección": ["Caja de Dirección", "Terminales", "Axiales"],
    "Transmisión": ["Puntas", "Cardán", "Embrague"],
    "Fugas": ["Fuga Aceite Motor", "Fuga Transmisión", "Fuga Refrigerante"],
    "Batería / Eléctrico": ["Batería", "Alternador", "Motor de Arranque"],
    "Chequeo Visual Motor": ["Correa Distribución", "Correa Accesorios", "Aceite Motor"],
    "Niveles": ["Aceite Motor", "Líquido Frenos", "Refrigerante"],
    "Otros": ["Luces", "Limpiaparabrisas", "Llantas (Estado)"],
    "Insumos": ["Silicona", "Utiles de Aseo", "Prensa"],
    "Servicios Especializados": ["Diagnostico Profundo en", "Sincronizacion", "Escaner / Calibracion"]
  }
}
```

---

## 5. ENDPOINTS PERSONALIZADOS

### 5.1 Generar Informe Técnico con IA

```
POST /api/generate-ai-report
Content-Type: application/json
```

**Body:**
```json
{
  "orderId": 1,
  "allQuotes": true,
  "selectedItems": [],
  "notes": "Enfocarse en el sistema de frenos y refrigeración"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `orderId` | number/string | ID de la orden a analizar |
| `allQuotes` | boolean | `true` = usar todos los ítems de la cotización |
| `selectedItems` | array | Si `allQuotes` es `false`, lista de descripciones de ítems a incluir |
| `notes` | string | Observaciones adicionales para guiar a la IA |

**Respuesta exitosa:** Archivo PDF binario para descargar (Content-Type: application/pdf)

**Errores posibles:**
```json
{ "error": "orderId is required" }                          // 400
{ "error": "Order with ID X not found" }                    // 404
{ "error": "Falta configurar OPENROUTER_API_KEY" }          // 500
{ "error": "El script de generación de PDF falló" }         // 500
```

**Notas:**
- Usa el modelo `openai/gpt-oss-120b:free` vía OpenRouter
- Guarda el resultado en la colección `ai_reports`
- Genera el PDF con la plantilla ReportLab (Python)
- Solo acepta órdenes con estado diferente a `Entregado`

---

### 5.2 Migración de reportes corruptos (mantenimiento)

```
POST /api/migrate-ai-reports
```

Mueve reportes sin campo `items` de la colección `reports` a `ai_reports`. Solo usar una vez si hay datos corruptos.

**Respuesta:**
```json
{ "message": "Se movieron 3 reporte(s) de IA a ai_reports.", "moved": 3 }
```

---

## 6. FLUJOS COMPLETOS

### 6.1 Flujo completo de una orden (Admin)

```
1. Admin crea orden
   POST /orders  { placa, cliente, marca, modelo, ... estado: "Recepción" }

2. Técnico hace revisión y sube reporte
   POST /reports  { orderId, items: [...], scannerCodes: [...] }

3. Admin ve el reporte y crea cotización
   POST /quotes  { orderId, items: [{ descripcion, cantidad, precio, aplicaIva, prioridad }] }

4. Admin autoriza la cotización y mueve la orden a Proceso
   PATCH /quotes/{id}  { autorizada: true }
   PATCH /orders/{id}  { estado: "Proceso" }

5. Técnico termina el trabajo (checklist de salida)
   PATCH /orders/{id}  { estado: "Calidad", checklistFinal: { pruebaRuta, limpio, herramientas, fecha } }

6. Admin mueve la orden a Docs Rápidos o directamente a Entregado
   PATCH /orders/{id}  { estado: "Entregado", metodoPago: "Efectivo" }
```

---

### 6.2 Flujo de generación de Informe IA (Admin)

```
1. Admin va a la pestaña "Generar Informe" en el Panel Admin
2. Selecciona una placa de una orden activa (no Entregado)
3. Elige si usar toda la cotización o ítems específicos
4. Agrega observaciones opcionales para guiar la IA
5. Hace clic en "Generar Informe Técnico IA"
   POST /api/generate-ai-report  { orderId, allQuotes, selectedItems, notes }
6. El backend:
   a. Obtiene datos de la orden y cotización
   b. Llama a OpenRouter (GPT-OSS 120B) con un prompt estructurado
   c. Recibe JSON estructurado con diagnósticos
   d. Ejecuta generate_pdf.py con ReportLab para crear el PDF premium
   e. Retorna el PDF para descarga automática
   f. Guarda el reporte en ai_reports
```

---

### 6.3 Flujo del Técnico

```
1. Técnico entra a la vista /technician
2. Ve dos columnas:
   - "Revisión Pendiente": órdenes en Recepción, Docs Rápidos
   - "En Trabajo": órdenes en Proceso con cotización autorizada

3. Para hacer revisión:
   a. Selecciona una orden
   b. Llena el formulario por categorías:
      - Suspensión, Frenos, Dirección, Transmisión, Fugas,
        Batería/Eléctrico, Chequeo Visual Motor, Niveles, Otros:
        → Marca cada ítem como Bueno / Regular / Malo
        → Si es Regular/Malo: agrega mano de obra ($), marca si requiere repuesto o reparación
      - Insumos: checkbox + cantidad
      - Servicios Especializados: checkbox + área (si aplica) + valor ($)
   c. Agrega códigos DTC del escáner (formato: prefijo + 4 dígitos + descripción)
   d. Presiona "Subir Revisión"
      POST /reports  { orderId, items, scannerCodes, precioDiagnostico, fecha }

4. Para terminar trabajo:
   a. Presiona "Terminar" en una orden "En Trabajo"
   b. Completa checklist de salida:
      - ¿Prueba de ruta? ✓
      - ¿Vehículo limpio? ✓
      - ¿Herramientas fuera? ✓
   c. Presiona "Confirmar"
      PATCH /orders/{id}  { estado: "Calidad", checklistFinal: {...} }
```

---

### 6.4 Gestión de Gastos (Admin)

```
# Registrar gasto
POST /expenses  { fecha, concepto, monto, metodoPago }

# Ver todos los gastos
GET /expenses

# Eliminar gasto
DELETE /expenses/{id}
```

---

### 6.5 Gestión de Tareas (Admin)

```
# Crear tarea
POST /todos  { text: "Llamar proveedor", completed: false }

# Marcar como completada
PATCH /todos/{id}  { completed: true }

# Eliminar tarea
DELETE /todos/{id}
```

---

### 6.6 Configuración del formulario de revisión (Admin)

El admin puede agregar/eliminar categorías e ítems que el técnico ve en su formulario.

```
# Leer configuración actual
GET /settings/revision_form

# Actualizar categorías
PATCH /settings/revision_form  { categories: { "Nueva Categoría": ["Item 1", "Item 2"] } }
```

---

## 7. PANEL ADMIN — PESTAÑAS Y FUNCIONES

| Pestaña | Función principal |
|---|---|
| **Kanban** | Vista de tablero con 4 columnas de estado. Arrastra/mueve órdenes. Clic en tarjeta abre modal de detalle. |
| **Historial** | Lista de órdenes entregadas con totales. Permite ver detalle y eliminar. |
| **Gastos** | Registro y listado de egresos del taller. Muestra balance neto por método de pago. |
| **Docs Rápidos** | Formulario simplificado para crear órdenes de facturación rápida. |
| **Generar Informe** | Selector de orden activa → IA genera PDF técnico premium con ReportLab. |

**Estadísticas visibles en el panel:**
- Órdenes activas (no entregadas)
- Total facturado (suma de cotizaciones de órdenes entregadas)
- Gastos registrados
- Ganancia neta (facturado − gastos)
- Balance por método de pago

---

## 8. MODAL DE DETALLE DE ORDEN — PESTAÑAS

Al hacer clic en cualquier orden del Kanban o Historial se abre el modal con estas pestañas:

| Pestaña | Función |
|---|---|
| **Info** | Datos del vehículo y cliente. Permite editar inline. |
| **Fotos** | Galería de fotos de ingreso con lightbox. |
| **Reporte** | Reporte técnico del técnico (items, estados, escáner). Permite imprimir PDF. |
| **Cotización** | Items con precios, prioridad, IVA. Guardar borrador, autorizar, imprimir PDF cotización o cuenta de cobro. |
| **Entrega** | Marcar como entregado con método de pago y notas de entrega. |

---

## 9. PDF GENERADOS POR EL SISTEMA

### 9.1 Cotización PDF
- Generado en el navegador (JavaScript, sin servidor)
- Ítems ordenados por prioridad: Urgente → Plazo Medio → Plazo Largo
- Subtotales por grupo de prioridad
- La columna de prioridad se puede activar/desactivar con un toggle
- Incluye datos del cliente, vehículo, totales con IVA

### 9.2 Cuenta de Cobro PDF
- Igual que cotización pero SIN columna de prioridad ni agrupaciones
- Lista simple de servicios prestados
- Se genera cuando la orden está en estado `Entregado` o `Docs Rápidos`

### 9.3 Reporte Técnico del Técnico PDF
- Tabla con categorías, ítems, estados (Bueno/Regular/Malo)
- Mano de obra por ítem
- Códigos DTC si existen
- Generado en el navegador

### 9.4 Informe Técnico IA PDF
- Generado en el servidor con Python + ReportLab
- Diseño corporativo premium (colores DARK_BLUE, MID_BLUE, ACCENT)
- Secciones: Objeto, Descripción de Ingreso, Diagnóstico Técnico (por sistema), Alcance, Conclusión, Recomendación
- Requiere variable de entorno `OPENROUTER_API_KEY` en el servidor

---

## 10. VARIABLES DE ENTORNO REQUERIDAS

| Variable | Servicio | Descripción |
|---|---|---|
| `OPENROUTER_API_KEY` | JSON Server (backend) | Clave de API para OpenRouter (modelo GPT-OSS 120B) |
| `VITE_API_URL` | web (frontend) | URL del JSON Server (ej: `json-server-production-0af6.up.railway.app`) |
| `VITE_BACKEND_URL` | web (frontend) | URL del servidor principal para endpoints custom (igual que VITE_API_URL) |
| `PORT` | JSON Server | Puerto del servidor (Railway lo setea automáticamente) |
| `RAILWAY_VOLUME_MOUNT_PATH` | JSON Server | Ruta del volumen persistente (Railway lo setea automáticamente) |

---

## 11. EJEMPLOS DE CONSULTAS ÚTILES PARA UNA IA

```bash
# Listar todas las órdenes activas con sus cotizaciones
GET /orders?_embed=quotes&estado_ne=Entregado

# Obtener una orden específica por placa
GET /orders?placa=ABC123&_embed=reports&_embed=quotes

# Ver todos los reportes técnicos ordenados por fecha
GET /reports?_sort=fecha&_order=desc&_expand=order

# Ver gastos del mes actual
GET /expenses?fecha_gte=2026-05-01&fecha_lte=2026-05-31

# Mover una orden a "Proceso"
PATCH /orders/1  { "estado": "Proceso" }

# Crear una cotización
POST /quotes  {
  "orderId": 1,
  "autorizada": false,
  "items": [
    { "descripcion": "Cambio de aceite", "cantidad": 1, "precio": 80000, "aplicaIva": false, "prioridad": "urgente" }
  ]
}

# Autorizar cotización y mover orden a Proceso
PATCH /quotes/1  { "autorizada": true }
PATCH /orders/1  { "estado": "Proceso" }

# Generar informe IA para una orden
POST /api/generate-ai-report  {
  "orderId": 1,
  "allQuotes": true,
  "selectedItems": [],
  "notes": "Enfocarse en sistemas críticos de seguridad"
}
```

---

## 12. CATEGORÍAS DEL FORMULARIO DE REVISIÓN TÉCNICA

Estas son las categorías y sus ítems por defecto que el técnico ve en su app:

| Categoría | Ítems |
|---|---|
| Suspensión | Amortiguadores Del., Amortiguadores Tras., Bujes de Tijera, Tijeras, Lágrimas, Soporte de Amortiguadores, Bujes Barra Estabilizadora, Soportes de Motor, Rótulas |
| Frenos | Pastillas Del., Pastillas Tras., Discos Del., Discos Tras., Líquido de Frenos, Freno de Mano, Mangueras de Freno, Bomba de Freno, Cilindro de Freno, Campanas Traseras, Bandas Traseras |
| Dirección | Caja de Dirección, Terminales, Axiales, Bomba de Dirección, Aceite Hidráulico, Holgura Volante |
| Transmisión | Puntas, Cardán, Embrague, Empaque Caja de Cambios, Guardapolvos |
| Fugas | Fuga Aceite Motor, Fuga Transmisión, Fuga Dirección, Fuga Refrigerante, Fuga Combustible, Fuga Frenos |
| Batería / Eléctrico | Batería, Alternador, Motor de Arranque |
| Chequeo Visual Motor | Correa Distribución, Correa Accesorios, Aceite Motor, Cableado Visible, Empaque tapavalvulas, Empaque de Carter, Reten Delantero Cigueñal, Reten Trasero Cigueñal, Tapacadena, Sensor |
| Niveles | Aceite Motor, Líquido Frenos, Líquido Dirección, Refrigerante, Agua Limpiaparabrisas |
| Otros | Luces, Limpiaparabrisas, Pito, Espejos, Vidrios, Tapicería, Llantas (Estado), Llantas (Presión) |
| Insumos | Silicona, Utiles de Aseo, Prensa, Pegante Shellac, Cableado / Conexiones Electricas |
| Servicios Especializados | Diagnostico Profundo en, Sincronizacion, Mantenimiento de Frenos, Escaner / Calibracion |
