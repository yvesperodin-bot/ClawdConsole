import { Router, Request, Response } from 'express';
import {
  getSetupState,
  getAuditLog,
  exportAuditLog,
} from '../database/db.js';

const router = Router();

// Middleware to check setup completion
router.use((req: Request, res: Response, next) => {
  const state = getSetupState();
  if (!state || !state.completed) {
    return res.status(403).json({
      error: 'Setup required',
      message: 'Please complete the setup wizard before viewing logs.',
    });
  }
  next();
});

/**
 * GET /api/logs
 * Get audit log entries
 */
router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const category = req.query.category as string | undefined;
  const riskLevel = req.query.risk_level as string | undefined;

  const logs = getAuditLog(limit, category, riskLevel);

  res.json({
    count: logs.length,
    logs: logs.map(log => ({
      id: log.id,
      event_type: log.event_type,
      event_category: log.event_category,
      description: log.description,
      details: log.details ? JSON.parse(log.details) : null,
      risk_level: log.risk_level,
      created_at: log.created_at,
    })),
  });
});

/**
 * GET /api/logs/categories
 * Get available log categories
 */
router.get('/categories', (req: Request, res: Response) => {
  const db = require('../database/db.js').getDatabase();
  const categories = db.prepare(`
    SELECT DISTINCT event_category FROM audit_log ORDER BY event_category
  `).all() as Array<{ event_category: string }>;

  res.json({
    categories: categories.map(c => c.event_category),
  });
});

/**
 * GET /api/logs/stats
 * Get log statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  const db = require('../database/db.js').getDatabase();

  const totalCount = db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number };

  const byCategory = db.prepare(`
    SELECT event_category, COUNT(*) as count
    FROM audit_log
    GROUP BY event_category
    ORDER BY count DESC
  `).all() as Array<{ event_category: string; count: number }>;

  const byRiskLevel = db.prepare(`
    SELECT risk_level, COUNT(*) as count
    FROM audit_log
    WHERE risk_level IS NOT NULL
    GROUP BY risk_level
    ORDER BY count DESC
  `).all() as Array<{ risk_level: string; count: number }>;

  const recentHigh = db.prepare(`
    SELECT COUNT(*) as count
    FROM audit_log
    WHERE risk_level IN ('HIGH', 'MEDIUM')
    AND created_at > datetime('now', '-24 hours', 'localtime')
  `).get() as { count: number };

  res.json({
    total: totalCount.count,
    by_category: byCategory,
    by_risk_level: byRiskLevel,
    alerts_24h: recentHigh.count,
  });
});

/**
 * GET /api/logs/export
 * Export audit logs
 */
router.get('/export', (req: Request, res: Response) => {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
  const exported = exportAuditLog(format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=clawd_audit_log_${Date.now()}.csv`);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=clawd_audit_log_${Date.now()}.json`);
  }

  res.send(exported);
});

/**
 * GET /api/logs/network
 * Get network access log
 */
router.get('/network', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const db = require('../database/db.js').getDatabase();

  const logs = db.prepare(`
    SELECT * FROM network_log
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    destination: string;
    allowed: number;
    reason: string | null;
    created_at: string;
  }>;

  res.json({
    count: logs.length,
    logs: logs.map(log => ({
      id: log.id,
      destination: log.destination,
      allowed: Boolean(log.allowed),
      reason: log.reason,
      created_at: log.created_at,
    })),
  });
});

/**
 * GET /api/logs/security
 * Get security-related logs only
 */
router.get('/security', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const db = require('../database/db.js').getDatabase();

  const logs = db.prepare(`
    SELECT * FROM audit_log
    WHERE event_category IN ('SECURITY', 'ACTION', 'NETWORK')
    OR risk_level IN ('HIGH', 'MEDIUM')
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);

  res.json({
    count: logs.length,
    logs: logs.map((log: any) => ({
      id: log.id,
      event_type: log.event_type,
      event_category: log.event_category,
      description: log.description,
      details: log.details ? JSON.parse(log.details) : null,
      risk_level: log.risk_level,
      created_at: log.created_at,
    })),
  });
});

export default router;
