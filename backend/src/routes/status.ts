import { Router, Request, Response } from 'express';
import {
  getSetupState,
  getSecurityProfile,
  getPendingActions,
} from '../database/db.js';
import { checkClawdBotStatus } from '../services/clawdbot.js';
import { detectLocalAI, isNetworkAllowed } from '../services/localAI.js';

const router = Router();

/**
 * GET /api/status
 * Get complete system status for dashboard
 */
router.get('/', async (req: Request, res: Response) => {
  const setupState = getSetupState();

  if (!setupState || !setupState.completed) {
    return res.json({
      setup_required: true,
      message: 'Please complete the setup wizard to get started.',
    });
  }

  // Get all status information in parallel
  const [clawdbotStatus, localAIStatus] = await Promise.all([
    checkClawdBotStatus(),
    detectLocalAI(),
  ]);

  const securityProfile = getSecurityProfile(setupState.security_profile);
  const pendingActions = getPendingActions();

  res.json({
    setup_required: false,
    clawdbot: {
      connected: clawdbotStatus.connected,
      version: clawdbotStatus.version,
      status_message: clawdbotStatus.connected
        ? 'ClawdBot is running and ready.'
        : 'ClawdBot is not running.',
    },
    local_ai: {
      available: localAIStatus.anyAvailable,
      providers: localAIStatus.providers.filter(p => p.detected).map(p => ({
        name: p.name,
        models: p.models?.length || 0,
      })),
    },
    network: {
      allowed: isNetworkAllowed(),
      status: isNetworkAllowed() ? 'ENABLED' : 'DISABLED',
      status_message: isNetworkAllowed()
        ? 'Network access is enabled with your current security profile.'
        : 'Network access is disabled. Your data stays on this computer.',
    },
    security: {
      profile_id: setupState.security_profile,
      profile_name: securityProfile?.name || 'Unknown',
      risk_level: securityProfile?.risk_level || 'UNKNOWN',
    },
    workspace: {
      path: setupState.workspace_path,
    },
    pending_approvals: {
      count: pendingActions.length,
      actions: pendingActions.slice(0, 5).map(a => ({
        id: a.id,
        type: a.action_type,
        summary: a.summary,
        risk_level: a.risk_level,
      })),
    },
  });
});

/**
 * GET /api/status/health
 * Simple health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/status/clawdbot
 * Get ClawdBot status only
 */
router.get('/clawdbot', async (req: Request, res: Response) => {
  const status = await checkClawdBotStatus();
  res.json(status);
});

/**
 * GET /api/status/local-ai
 * Get local AI status only
 */
router.get('/local-ai', async (req: Request, res: Response) => {
  const status = await detectLocalAI();
  res.json(status);
});

export default router;
