import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Routes
import authRoutes from './src/routes/auth.js';
import apiRoutes from './src/routes/api.js';

async function startServer() {
  const app = express();
  // Using PORT 3000 for local environment compatibility, 
  // but prioritizing process.env.PORT for Render production.
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'EduNexus API is running' });
  });

  // Specifically requested test endpoint
  app.get('/api/test', (req, res) => {
    res.json({
      status: "ok",
      message: "API is working"
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/v1', apiRoutes);

  // Global 404 for non-API routes (Ensures no accidental frontend serving)
  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `The route ${req.originalUrl} does not exist on this API server.`
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/test`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start API server:', err);
});
