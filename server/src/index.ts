import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import { createWsServer } from './ws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_DIST = path.join(__dirname, '../../client/dist');

initDb();

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message.includes('Unsupported file type') || err.message.includes('Only .txt')) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err.message.includes('File too large')) {
    res.status(400).json({ error: 'File too large (max 5MB)' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

const server = http.createServer(app);

if (process.env.NODE_ENV !== 'test') {
  try {
    createWsServer(server);
  } catch (err) {
    console.warn('WebSocket server failed to start (presence disabled):', err);
  }

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop other servers and run "npm run dev" again.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
