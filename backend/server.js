const jsonServer = require('json-server');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');

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

const router = jsonServer.router(dbFile);

server.use(cors());
server.use(middlewares);
server.use(jsonServer.bodyParser);

// Custom routes can be added here
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'autoonlinesdclientes@gmail.com',
    pass: 'vebd cese ezft nppf'
  }
});

const generateEmailHtml = (title, message, placa) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
      .header { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; padding: 30px 40px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.025em; }
      .content { padding: 40px; }
      .message { font-size: 16px; margin-bottom: 30px; }
      .placa-badge { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 16px; border-radius: 9999px; font-weight: 700; color: #475569; letter-spacing: 0.1em; margin-bottom: 20px; font-size: 14px; }
      .btn { display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-align: center; font-size: 16px; width: 100%; box-sizing: border-box; transition: background 0.2s; }
      .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>AppTaller2</h1>
      </div>
      <div class="content">
        <div style="text-align: center;">
          <div class="placa-badge">VEHÍCULO: ${placa}</div>
        </div>
        <div class="message">
          <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">${title}</h2>
          <p>${message}</p>
        </div>
        <a href="https://appagent.up.railway.app/cliente" class="btn" style="color: white !important;">Consultar Estado de mi Vehículo</a>
      </div>
      <div class="footer">
        Este es un correo automático, por favor no responda a este mensaje.<br>
        &copy; ${new Date().getFullYear()} Taller Automotriz. Todos los derechos reservados.
      </div>
    </div>
  </body>
  </html>
  `;
};

server.post('/api/send-email', async (req, res) => {
  const { to, type, placa } = req.body;
  if (!to) return res.status(400).json({ error: 'Falta destinatario (to)' });

  let subject = '';
  let title = '';
  let message = '';

  if (type === 'reception') {
    subject = `Recepción de Vehículo ${placa}`;
    title = `¡Hola! Hemos recibido tu vehículo`;
    message = `Confirmamos la recepción de tu vehículo de placas <strong>${placa}</strong> en nuestro taller. Ya nos encontramos trabajando en él. Puedes hacer seguimiento detallado a tu orden de servicio, reportes y cotizaciones accediendo al siguiente enlace.`;
  } else if (type === 'update') {
    subject = `Actualización en tu Orden de Servicio ${placa}`;
    title = `¡Hay novedades en tu servicio!`;
    message = `Se ha realizado un cambio en el estado de la orden de servicio para tu vehículo de placas <strong>${placa}</strong>. Por favor, revisa la información más reciente entrando al enlace a continuación.`;
  } else {
    return res.status(400).json({ error: 'Tipo de correo inválido' });
  }

  const html = generateEmailHtml(title, message, placa);

  try {
    await transporter.sendMail({
      from: '"Taller Automotriz" <autoonlinesdclientes@gmail.com>',
      to,
      subject,
      html
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error enviando correo:', error);
    res.status(500).json({ error: error.message });
  }
});

server.use(router);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`JSON Server is running on port ${port}`);
  console.log(`Using database at ${dbFile}`);
});
