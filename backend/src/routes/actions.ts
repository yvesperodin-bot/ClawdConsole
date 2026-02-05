import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import {
  getSetupState,
  getSecurityProfile,
  createPendingAction,
  getPendingActions,
  getPendingAction,
  approveActionWithResult,
  denyActionWithReason,
  logAudit,
} from '../database/db.js';
import { approveClawdBotAction, denyClawdBotAction } from '../services/clawdbot.js';
import { validatePath, validateCommand } from '../middleware/workspaceJail.js';

const router = Router();

/**
 * In-flight lock to prevent duplicate approvals/denials per action.
 * Key: actionId, Value: timestamp when lock acquired
 * Locks expire after 30 seconds (in case of crash/timeout)
 */
const actionLocks = new Map<string, number>();
const LOCK_TIMEOUT_MS = 30000;

function acquireActionLock(actionId: string): boolean {
  const now = Date.now();
  const existingLock = actionLocks.get(actionId);

  // Check if there's an active lock
  if (existingLock && (now - existingLock) < LOCK_TIMEOUT_MS) {
    return false; // Lock is held
  }

  // Acquire lock
  actionLocks.set(actionId, now);
  return true;
}

function releaseActionLock(actionId: string): void {
  actionLocks.delete(actionId);
}

// Cleanup stale locks periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of actionLocks.entries()) {
    if ((now - timestamp) >= LOCK_TIMEOUT_MS) {
      actionLocks.delete(id);
    }
  }
}, 60000); // Clean up every minute

/**
 * Action Types and their security requirements:
 * - FILE_READ, FILE_WRITE, FILE_DELETE, LIST_DIR, CREATE_FILE: Workspace jail enforced
 * - RUN_COMMAND: Requires POWER_USER profile + PIN verification
 * - NETWORK_REQUEST: Requires CONNECTED profile + allowlist
 */

// Action types that require special handling
const FILE_ACTION_TYPES = ['FILE_READ', 'FILE_WRITE', 'FILE_DELETE', 'LIST_DIR', 'CREATE_FILE'];
const COMMAND_ACTION_TYPES = ['RUN_COMMAND', 'COMMAND_EXECUTE'];
const NETWORK_ACTION_TYPES = ['NETWORK_REQUEST'];

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
  const { action_type, target, summary, risk_level, preview, conversation_id, clawd_action_id } = req.body;

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
  if (FILE_ACTION_TYPES.includes(action_type)) {
    const pathCheck = validatePath(target);
    if (!pathCheck.allowed) {
      logAudit('SECURITY', 'ACTION_BLOCKED', `Proposed action blocked: ${pathCheck.reason}`, { action_type, target }, 'HIGH');
      return res.status(403).json({
        error: 'Path not allowed',
        message: pathCheck.reason,
      });
    }
  }

  if (COMMAND_ACTION_TYPES.includes(action_type)) {
    const commandCheck = validateCommand(target);
    if (!commandCheck.allowed) {
      logAudit('SECURITY', 'ACTION_BLOCKED', `Proposed command blocked: ${commandCheck.reason}`, { action_type, target }, 'HIGH');
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
    conversation_id || null,
    clawd_action_id || null
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
 *
 * Security checks:
 * 1. Verify action exists and is PENDING
 * 2. Validate workspace jail for file operations
 * 3. Check profile permissions for command/network operations
 * 4. Require PIN for RUN_COMMAND actions
 * 5. Forward approval to ClawdBot
 * 6. Store result and update status
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { admin_pin } = req.body;

  // Try to acquire lock - prevent double-approve
  if (!acquireActionLock(id)) {
    return res.status(429).json({
      error: 'Already processing',
      message: 'This action is already being processed. Please wait.',
    });
  }

  // Get the action
  const action = getPendingAction(id);
  if (!action || action.status !== 'PENDING') {
    releaseActionLock(id);
    return res.status(404).json({
      error: 'Not found',
      message: 'This action is no longer pending or does not exist.',
    });
  }

  const state = getSetupState()!;
  const profile = getSecurityProfile(state.security_profile);

  // Security Check 1: Validate file paths against workspace jail
  if (FILE_ACTION_TYPES.includes(action.action_type)) {
    const pathCheck = validatePath(action.target);
    if (!pathCheck.allowed) {
      denyActionWithReason(id, `Security: ${pathCheck.reason}`);
      logAudit('SECURITY', 'APPROVAL_BLOCKED', `Action blocked by workspace jail: ${action.summary}`, { id, reason: pathCheck.reason }, 'HIGH');
      releaseActionLock(id);
      return res.status(403).json({
        error: 'Action blocked',
        message: `This action was blocked for your safety: ${pathCheck.reason}`,
      });
    }
  }

  // Security Check 2: RUN_COMMAND requires POWER_USER profile + PIN
  if (COMMAND_ACTION_TYPES.includes(action.action_type)) {
    // Must be POWER_USER
    if (!profile || !profile.allow_system_access) {
      denyActionWithReason(id, 'Security: Command execution not allowed in current profile');
      logAudit('SECURITY', 'APPROVAL_BLOCKED', `Command execution blocked: profile ${state.security_profile} does not allow system access`, { id }, 'HIGH');
      releaseActionLock(id);
      return res.status(403).json({
        error: 'Profile restriction',
        message: 'Command execution is only allowed in Power User mode. Please change your security profile in Settings.',
      });
    }

    // Must verify PIN if set
    if (state.admin_pin_hash) {
      if (!admin_pin) {
        releaseActionLock(id);
        return res.status(403).json({
          error: 'PIN required',
          message: 'Your admin PIN is required to approve command execution.',
          requires_pin: true,
        });
      }

      const pinValid = await bcrypt.compare(admin_pin, state.admin_pin_hash);
      if (!pinValid) {
        logAudit('SECURITY', 'INVALID_PIN', 'Invalid PIN for command approval', { id }, 'HIGH');
        releaseActionLock(id);
        return res.status(403).json({
          error: 'Invalid PIN',
          message: 'The admin PIN you entered is incorrect.',
        });
      }
    }

    // Validate command safety
    const commandCheck = validateCommand(action.target);
    if (!commandCheck.allowed) {
      denyActionWithReason(id, `Security: ${commandCheck.reason}`);
      logAudit('SECURITY', 'APPROVAL_BLOCKED', `Command blocked: ${commandCheck.reason}`, { id }, 'HIGH');
      releaseActionLock(id);
      return res.status(403).json({
        error: 'Command blocked',
        message: commandCheck.reason,
      });
    }
  }

  // Security Check 3: NETWORK_REQUEST requires CONNECTED profile
  if (NETWORK_ACTION_TYPES.includes(action.action_type)) {
    if (!profile || !profile.allow_network) {
      denyActionWithReason(id, 'Security: Network access not allowed in current profile');
      logAudit('SECURITY', 'APPROVAL_BLOCKED', `Network request blocked: profile ${state.security_profile} does not allow network access`, { id }, 'HIGH');
      releaseActionLock(id);
      return res.status(403).json({
        error: 'Profile restriction',
        message: 'Network requests are not allowed in your current security profile.',
      });
    }
  }

  // Forward approval to ClawdBot
  if (action.clawd_action_id && action.conversation_id) {
    const clawdResult = await approveClawdBotAction(action.conversation_id, action.clawd_action_id);

    if (!clawdResult.success) {
      logAudit('ACTION', 'EXECUTION_FAILED', `ClawdBot execution failed: ${action.summary}`, { id, error: clawdResult.error }, 'MEDIUM');
      releaseActionLock(id);
      return res.status(502).json({
        error: 'Execution failed',
        message: clawdResult.error || 'ClawdBot could not execute the action. Please try again.',
      });
    }

    // Store result and mark as approved
    const resultSummary = clawdResult.resultSummary || 'Action completed successfully';
    const resolved = approveActionWithResult(id, resultSummary);

    logAudit('ACTION', 'EXECUTED', `Action executed: ${action.summary}`, { id, resultSummary, updatedFiles: clawdResult.updatedFiles }, 'INFO');

    releaseActionLock(id);
    return res.json({
      success: true,
      message: 'Action approved and executed.',
      action: {
        id: resolved.id,
        action_type: resolved.action_type,
        target: resolved.target,
        status: resolved.status,
        result_summary: resolved.result_summary,
        resolved_at: resolved.resolved_at,
      },
      result: {
        summary: resultSummary,
        updated_files: clawdResult.updatedFiles,
      },
    });
  }

  // No ClawdBot action ID - just mark as approved (manual action)
  const resolved = approveActionWithResult(id, 'Approved by user');

  releaseActionLock(id);
  res.json({
    success: true,
    message: 'Action approved.',
    action: {
      id: resolved.id,
      action_type: resolved.action_type,
      target: resolved.target,
      status: resolved.status,
      result_summary: resolved.result_summary,
      resolved_at: resolved.resolved_at,
    },
  });
});

/**
 * POST /api/actions/:id/deny
 * Deny a pending action
 */
router.post('/:id/deny', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  // Try to acquire lock - prevent double-deny
  if (!acquireActionLock(id)) {
    return res.status(429).json({
      error: 'Already processing',
      message: 'This action is already being processed. Please wait.',
    });
  }

  // Get the action
  const action = getPendingAction(id);
  if (!action || action.status !== 'PENDING') {
    releaseActionLock(id);
    return res.status(404).json({
      error: 'Not found',
      message: 'This action is no longer pending or does not exist.',
    });
  }

  // Forward denial to ClawdBot (best effort)
  if (action.clawd_action_id && action.conversation_id) {
    await denyClawdBotAction(action.conversation_id, action.clawd_action_id, reason);
  }

  // Mark as denied with reason
  const resolved = denyActionWithReason(id, reason || null);

  releaseActionLock(id);
  res.json({
    success: true,
    message: 'Action denied.',
    action: {
      id: resolved.id,
      action_type: resolved.action_type,
      target: resolved.target,
      status: resolved.status,
      deny_reason: resolved.deny_reason,
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
      result_summary: a.result_summary,
      deny_reason: a.deny_reason,
      created_at: a.created_at,
      resolved_at: a.resolved_at,
    })),
  });
});

export default router;
