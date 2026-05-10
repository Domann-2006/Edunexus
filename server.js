import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import authRoutes from './src/routes/auth.js';
import apiRoutes from './src/routes/api.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'EduNexus API is running' });
  });

  app.get('/api/test', (req, res) => {
    res.json({ status: "ok", message: "API is working" });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/v1', apiRoutes);

  // Vite integration for development and production
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting in development mode with Vite middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting in production mode (serving dist)');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduNexus unified server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EduNexus server:', err);
});
