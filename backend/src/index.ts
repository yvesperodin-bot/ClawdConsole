import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabase, getSetupState, logAudit, DATA_DIR } from './database/db.js';
import setupRoutes from './routes/setup.js';
import statusRoutes from './routes/status.js';
import chatRoutes from './routes/chat.js';
import actionsRoutes from './routes/actions.js';
import securityRoutes from './routes/security.js';
import logsRoutes from './routes/logs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Clawd Console Backend Server
 *
 * LOCAL-ONLY server running on localhost:3001
 * No external network access - all communication stays on this machine.
 */

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Static files directory (for production mode)
const FRONTEND_DIST = path.join(__dirname, '..', '..', '..', 'frontend', 'dist');

// Middleware - CORS only needed in dev mode (Vite proxy)
if (!isProduction) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
  }));
}
app.use(express.json({ limit: '1mb' }));

// Request logging (for development)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Server start time for uptime calculation
const startTime = Date.now();

// Health check endpoint (always available)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'clawd-console-backend',
    timestamp: new Date().toISOString(),
    local_only: true,
  });
});

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

// API routes
app.use('/api/setup', setupRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/actions', actionsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/logs', logsRoutes);

// Production mode: Serve static frontend files
if (isProduction && fs.existsSync(FRONTEND_DIST)) {
  // Serve static assets
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback: serve index.html for non-API routes
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path === '/health') {
      res.status(404).json({
        error: 'Not found',
        message: 'The requested API endpoint does not exist.',
      });
      return;
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  // Development mode or no frontend build: 404 for non-API routes
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'The requested endpoint does not exist.',
    });
  });
}

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);

  // Log the error but don't expose stack traces to client
  logAudit('SYSTEM', 'ERROR', `Server error: ${err.message}`, null, 'HIGH');

  res.status(500).json({
    error: 'Internal error',
    message: 'Something went wrong. Please try again.',
  });
});

// Initialize database and start server
function start() {
  try {
    // Initialize database
    getDatabase();
    console.log('Database initialized');

    // Check setup state
    const setupState = getSetupState();
    if (setupState?.completed) {
      console.log(`Setup completed. Workspace: ${setupState.workspace_path}`);
      console.log(`Security profile: ${setupState.security_profile}`);
    } else {
      console.log('Setup not completed. User will be prompted to complete setup wizard.');
    }

    // Start server - LOCALHOST ONLY
    app.listen(PORT, '127.0.0.1', () => {
      console.log('');
      console.log('========================================');
      console.log('  Clawd Console');
      console.log('========================================');
      console.log(`  URL: http://localhost:${PORT}`);
      console.log(`  Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
      console.log(`  Data: ${DATA_DIR}`);
      console.log('  Network: LOCAL-ONLY (127.0.0.1)');
      if (isProduction) {
        console.log('');
        console.log('  Open your browser to the URL above.');
      }
      console.log('========================================');
      console.log('');

      logAudit('SYSTEM', 'STARTUP', `Server started on port ${PORT}`, { mode: isProduction ? 'production' : 'development' }, 'INFO');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
