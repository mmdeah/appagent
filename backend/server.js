const jsonServer = require('json-server');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

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
// e.g. server.get('/echo', (req, res) => res.jsonp(req.query))

server.use(router);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`JSON Server is running on port ${port}`);
  console.log(`Using database at ${dbFile}`);
});
