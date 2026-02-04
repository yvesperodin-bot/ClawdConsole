import express from 'express';
import cors from 'cors';
import { getDatabase, getSetupState, logAudit } from './database/db.js';
import setupRoutes from './routes/setup.js';
import statusRoutes from './routes/status.js';
import chatRoutes from './routes/chat.js';
import actionsRoutes from './routes/actions.js';
import securityRoutes from './routes/security.js';
import logsRoutes from './routes/logs.js';

/**
 * Clawd Console Backend Server
 *
 * LOCAL-ONLY server running on localhost:3001
 * No external network access - all communication stays on this machine.
 */

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
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

// Health check endpoint (always available)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'clawd-console-backend',
    timestamp: new Date().toISOString(),
    local_only: true,
  });
});

// API routes
app.use('/api/setup', setupRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/actions', actionsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/logs', logsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist.',
  });
});

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
      console.log('  Clawd Console Backend');
      console.log('========================================');
      console.log(`  Running on: http://localhost:${PORT}`);
      console.log('  Mode: LOCAL-ONLY (no external network)');
      console.log('========================================');
      console.log('');

      logAudit('SYSTEM', 'STARTUP', `Server started on port ${PORT}`, null, 'INFO');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
