import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

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

  // Health check at root level for Render compatibility or simplified monitoring
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root route metadata
  app.get('/', (req, res) => {
    res.json({
      name: 'EduNexus API Server',
      version: '1.0.0',
      status: 'online',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth'
      }
    });
  });

  // Specialized 404 for any other non-API routes on the backend domain
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'This is an API-only server. For the web interface, please visit the official frontend domain.'
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduNexus API server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EduNexus server:', err);
});
