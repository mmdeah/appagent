import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
// json-server v1 (alpha/beta) is often imported via a different syntax, 
// but we installed ^1.0.0-beta.15 which has an internal JS api or we can use the v0.17 approach.
// However, since json-server v1 is a CLI tool by default, we can actually just run express 
// and mount json-server as a middleware if we downgrade it or use its router.
// Given json-server v1 API changes, a safer way to mount it is to use the older json-server or use its new create() API.
// Wait, for json-server v1-beta, the programmatic API is:
// import jsonServer from 'json-server' => jsonServer.create() is deprecated.
// Let's implement a simple custom json-server with json-server ^0.17 OR if we stick with beta,
// we might run into issues mounting it. Let's try to mount json-server beta, or better yet, run it as a subprocess.
// Actually, `json-server` v1 beta no longer exposes a clean Express middleware API.
// Let's just uninstall json-server v1 beta and install v0.17.4 which we know works well as middleware.

import jsonServer from 'json-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// API routes using json-server
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

app.use('/api', middlewares);
app.use('/api', router);

// Serve static React files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
