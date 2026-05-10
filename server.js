import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

  // Allow multiple origins in production, or just use origin: true to reflect request origin
  // If the user provides VITE_FRONTEND_URL, we should prioritize it.
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173'
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development, allow all origins for ease of use
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  const apiRouter = express.Router();

  apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'EduNexus API is running' });
  });

  apiRouter.get('/test', (req, res) => {
    res.json({ status: "ok", message: "API is working" });
  });

  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/v1', apiRoutes);

  // Specialized API 404 handler - prevents /api/* requests from falling through to SPA index.html
  apiRouter.use((req, res) => {
    console.warn(`API Route not found: ${req.originalUrl}`);
    res.status(404).json({ error: 'Not Found', message: `API route ${req.originalUrl} does not exist.` });
  });

  app.use('/api', apiRouter);

  // Vite integration for local development preview in AI Studio
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    console.log('Starting in development mode with Vite middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production (Render), we specifically DO NOT serve the frontend static files.
    // The frontend is hosted on Vercel.
    console.log('Production mode: API only server.');
    app.get('/', (req, res) => {
      res.json({ message: 'EduNexus API Server (Production)', health: '/api/health' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduNexus unified server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EduNexus server:', err);
});
