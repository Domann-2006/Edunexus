import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from './src/routes/auth.js';
import apiRoutes from './src/routes/api.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
  message: { message: 'Too many auth requests from this IP, please try again after 15 minutes' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
  skip: (req) => req.originalUrl && req.originalUrl.startsWith('/api/auth'),
  message: { message: 'Too many requests from this IP, please try again after a minute' }
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = process.env.APP_PORT || 3000;

  app.use(compression());

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

  app.use('/api/auth', authLimiter);
  app.use('/api', apiLimiter);

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

  // Serve Vite in development or static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.resolve(__dirname, 'dist');

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduNexus server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EduNexus server:', err);
});
