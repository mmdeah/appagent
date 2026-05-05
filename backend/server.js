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

// Ensure all required collections exist
try {
  const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const requiredKeys = ['orders', 'quotes', 'reports', 'expenses', 'archived_orders', 'todos'];
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

const router = jsonServer.router(dbFile);

server.use(cors());
server.use(middlewares);
server.use(jsonServer.bodyParser);

// Custom routes can be added here

server.use(router);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`JSON Server is running on port ${port}`);
  console.log(`Using database at ${dbFile}`);
});
