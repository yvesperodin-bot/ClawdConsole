import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getSetupState,
  createPendingAction,
  getPendingActions,
  resolveAction,
  logAudit,
} from '../database/db.js';
import { executeApprovedAction } from '../services/clawdbot.js';
import { validatePath, validateCommand, FRIENDLY_MESSAGES } from '../middleware/workspaceJail.js';

const router = Router();

// Middleware to check setup completion
router.use((req: Request, res: Response, next) => {
  const state = getSetupState();
  if (!state || !state.completed) {
    return res.status(403).json({
      error: 'Setup required',
      message: 'Please complete the setup wizard before managing actions.',
    });
  }
  next();
});

/**
 * GET /api/actions/pending
 * List all pending actions requiring approval
 */
router.get('/pending', (req: Request, res: Response) => {
  const actions = getPendingActions();

  res.json({
    count: actions.length,
    actions: actions.map(a => ({
      id: a.id,
      action_type: a.action_type,
      target: a.target,
      summary: a.summary,
      risk_level: a.risk_level,
      preview: a.preview,
      created_at: a.created_at,
    })),
  });
});

/**
 * POST /api/actions/propose
 * Propose a new action (from ClawdBot or internal)
 */
router.post('/propose', (req: Request, res: Response) => {
  const { action_type, target, summary, risk_level, preview, conversation_id } = req.body;

  // Validate required fields
  if (!action_type || !target || !summary) {
    return res.status(400).json({
      error: 'Missing fields',
      message: 'Action type, target, and summary are required.',
    });
  }

  // Validate risk level
  const validRiskLevels = ['LOW', 'MEDIUM', 'HIGH'];
  const riskLevelValue = risk_level || 'MEDIUM';
  if (!validRiskLevels.includes(riskLevelValue)) {
    return res.status(400).json({
      error: 'Invalid risk level',
      message: 'Risk level must be LOW, MEDIUM, or HIGH.',
    });
  }

  // Validate target based on action type
  if (action_type === 'FILE_READ' || action_type === 'FILE_WRITE' || action_type === 'FILE_DELETE') {
    const pathCheck = validatePath(target);
    if (!pathCheck.allowed) {
      return res.status(403).json({
        error: 'Path not allowed',
        message: pathCheck.reason,
      });
    }
  }

  if (action_type === 'COMMAND_EXECUTE') {
    const commandCheck = validateCommand(target);
    if (!commandCheck.allowed) {
      return res.status(403).json({
        error: 'Command not allowed',
        message: commandCheck.reason,
      });
    }
  }

  // Create pending action
  const id = crypto.randomUUID();
  const action = createPendingAction(
    id,
    action_type,
    target,
    summary,
    riskLevelValue as 'LOW' | 'MEDIUM' | 'HIGH',
    preview || null,
    conversation_id || null
  );

  res.status(201).json({
    action: {
      id: action.id,
      action_type: action.action_type,
      target: action.target,
      summary: action.summary,
      risk_level: action.risk_level,
      preview: action.preview,
      status: action.status,
      created_at: action.created_at,
    },
    message: 'Action proposed and awaiting your approval.',
  });
});

/**
 * POST /api/actions/:id/approve
 * Approve a pending action
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Get pending actions to find this one
  const pendingActions = getPendingActions();
  const action = pendingActions.find(a => a.id === id);

  if (!action) {
    return res.status(404).json({
      error: 'Not found',
      message: 'This action is no longer pending or does not exist.',
    });
  }

  // Perform final security checks
  if (action.action_type.startsWith('FILE_')) {
    const pathCheck = validatePath(action.target);
    if (!pathCheck.allowed) {
      resolveAction(id, false);
      return res.status(403).json({
        error: 'Action blocked',
        message: `This action was blocked for your safety: ${pathCheck.reason}`,
      });
    }
  }

  // Resolve the action as approved
  const resolved = resolveAction(id, true);

  // Execute the action via ClawdBot
  const result = await executeApprovedAction(id);

  if (!result.success) {
    logAudit('ACTION', 'EXECUTION_FAILED', `Failed to execute action: ${action.summary}`, { id, error: result.error }, 'MEDIUM');
    return res.status(502).json({
      error: 'Execution failed',
      message: result.error || 'The action could not be completed. Please try again.',
      action: {
        id: resolved.id,
        status: resolved.status,
        resolved_at: resolved.resolved_at,
      },
    });
  }

  res.json({
    success: true,
    message: 'Action approved and executed.',
    action: {
      id: resolved.id,
      action_type: resolved.action_type,
      target: resolved.target,
      status: resolved.status,
      resolved_at: resolved.resolved_at,
    },
    result: result.data,
  });
});

/**
 * POST /api/actions/:id/deny
 * Deny a pending action
 */
router.post('/:id/deny', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  // Get pending actions to find this one
  const pendingActions = getPendingActions();
  const action = pendingActions.find(a => a.id === id);

  if (!action) {
    return res.status(404).json({
      error: 'Not found',
      message: 'This action is no longer pending or does not exist.',
    });
  }

  // Resolve the action as denied
  const resolved = resolveAction(id, false);

  // Log the denial reason if provided
  if (reason) {
    logAudit('ACTION', 'DENIAL_REASON', `Action denied with reason: ${reason}`, { id, reason }, 'INFO');
  }

  res.json({
    success: true,
    message: 'Action denied.',
    action: {
      id: resolved.id,
      action_type: resolved.action_type,
      target: resolved.target,
      status: resolved.status,
      resolved_at: resolved.resolved_at,
    },
  });
});

/**
 * GET /api/actions/history
 * Get action history (approved and denied)
 */
router.get('/history', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

  const db = require('../database/db.js').getDatabase();
  const actions = db.prepare(`
    SELECT * FROM pending_actions
    WHERE status != 'PENDING'
    ORDER BY resolved_at DESC
    LIMIT ?
  `).all(limit);

  res.json({
    count: actions.length,
    actions: actions.map((a: any) => ({
      id: a.id,
      action_type: a.action_type,
      target: a.target,
      summary: a.summary,
      risk_level: a.risk_level,
      status: a.status,
      created_at: a.created_at,
      resolved_at: a.resolved_at,
    })),
  });
});

export default router;
