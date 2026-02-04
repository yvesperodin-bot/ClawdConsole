import { Router, Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  getSetupState,
  createSetupState,
  completeSetup,
  getSecurityProfiles,
  logAudit,
  setSetting,
  getSetting,
} from '../database/db.js';
import { checkClawdBotStatus } from '../services/clawdbot.js';
import { detectLocalAI, getLocalAIExplanation } from '../services/localAI.js';

const router = Router();

// Helper to get default workspace path
function getDefaultWorkspacePath(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    return 'C:\\AI_WORKSPACE';
  }
  return path.join(os.homedir(), 'AI_WORKSPACE');
}

/**
 * GET /api/setup/state
 * Get current setup state for the wizard
 */
router.get('/state', (req: Request, res: Response) => {
  const state = getSetupState();
  res.json({
    setupComplete: state?.completed ?? false,
    workspacePath: state?.workspace_path ?? getDefaultWorkspacePath(),
    securityProfile: state?.security_profile ?? 'AIR_GAPPED',
    hasAdminPin: !!state?.admin_pin_hash,
  });
});

/**
 * GET /api/setup/status
 * Check if setup has been completed
 */
router.get('/status', (req: Request, res: Response) => {
  const state = getSetupState();
  res.json({
    completed: state?.completed ?? false,
    workspace_path: state?.workspace_path ?? null,
    security_profile: state?.security_profile ?? null,
  });
});

/**
 * GET /api/setup/environment
 * Get system environment information for setup wizard
 */
router.get('/environment', async (req: Request, res: Response) => {
  const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10;
  const freeMemoryGB = Math.round(os.freemem() / (1024 * 1024 * 1024) * 10) / 10;

  // Get disk space for home directory
  let diskInfo = { free: 0, total: 0 };
  try {
    const homeDir = os.homedir();
    const stats = fs.statfsSync(homeDir);
    diskInfo = {
      free: Math.round((stats.bfree * stats.bsize) / (1024 * 1024 * 1024) * 10) / 10,
      total: Math.round((stats.blocks * stats.bsize) / (1024 * 1024 * 1024) * 10) / 10,
    };
  } catch (error) {
    // Disk info optional
  }

  res.json({
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    memory: {
      total_gb: totalMemoryGB,
      free_gb: freeMemoryGB,
      sufficient: totalMemoryGB >= 4, // Minimum 4GB recommended
    },
    disk: {
      free_gb: diskInfo.free,
      total_gb: diskInfo.total,
      sufficient: diskInfo.free >= 10, // Minimum 10GB recommended
    },
    user: {
      home_dir: os.homedir(),
      username: os.userInfo().username,
    },
  });
});

/**
 * GET /api/setup/default-workspace
 * Get the default workspace path
 */
router.get('/default-workspace', (req: Request, res: Response) => {
  const platform = os.platform();
  let defaultPath: string;

  if (platform === 'win32') {
    defaultPath = 'C:\\AI_WORKSPACE';
  } else {
    defaultPath = path.join(os.homedir(), 'AI_WORKSPACE');
  }

  res.json({
    path: defaultPath,
    exists: fs.existsSync(defaultPath),
  });
});

/**
 * POST /api/setup/validate-workspace
 * Validate a workspace path
 */
router.post('/validate-workspace', (req: Request, res: Response) => {
  const { path: workspacePath } = req.body;

  if (!workspacePath || typeof workspacePath !== 'string') {
    return res.status(400).json({
      valid: false,
      error: 'Please enter a folder path.',
    });
  }

  // Check if path is absolute
  if (!path.isAbsolute(workspacePath)) {
    return res.status(400).json({
      valid: false,
      error: 'Please enter a complete folder path (like C:\\AI_WORKSPACE or /home/user/AI_WORKSPACE).',
    });
  }

  // Check if it's a system directory
  const blockedPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', 'C:\\Windows', 'C:\\Program Files'];
  const normalizedLower = workspacePath.toLowerCase();
  for (const blocked of blockedPaths) {
    if (normalizedLower.startsWith(blocked.toLowerCase())) {
      return res.status(400).json({
        valid: false,
        error: 'This is a system folder and cannot be used as a workspace. Please choose a different location.',
      });
    }
  }

  const exists = fs.existsSync(workspacePath);
  let writable = false;

  if (exists) {
    try {
      fs.accessSync(workspacePath, fs.constants.W_OK);
      writable = true;
    } catch {
      writable = false;
    }
  }

  res.json({
    valid: true,
    exists,
    writable,
    message: exists
      ? (writable ? 'This folder exists and can be used.' : 'This folder exists but you may not have permission to write to it.')
      : 'This folder will be created when you complete setup.',
  });
});

/**
 * GET /api/setup/check-clawdbot
 * Check ClawdBot connection
 */
router.get('/check-clawdbot', async (req: Request, res: Response) => {
  const status = await checkClawdBotStatus();
  res.json(status);
});

/**
 * GET /api/setup/check-local-ai
 * Check for local AI providers
 */
router.get('/check-local-ai', async (req: Request, res: Response) => {
  const status = await detectLocalAI();
  res.json({
    ...status,
    explanation: getLocalAIExplanation(),
  });
});

/**
 * GET /api/setup/security-profiles
 * Get available security profiles
 */
router.get('/security-profiles', (req: Request, res: Response) => {
  const profiles = getSecurityProfiles();
  res.json({
    profiles,
    default: 'AIR_GAPPED',
    recommendation: 'We recommend starting with the Air-Gapped profile for maximum security. You can change this later.',
  });
});

/**
 * POST /api/setup/complete
 * Complete the setup wizard
 */
router.post('/complete', (req: Request, res: Response) => {
  const { workspace_path, security_profile, admin_pin } = req.body;

  // Validate workspace path
  if (!workspace_path || typeof workspace_path !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Please provide a workspace folder path.',
    });
  }

  if (!path.isAbsolute(workspace_path)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a complete folder path.',
    });
  }

  // Validate security profile
  const validProfiles = ['AIR_GAPPED', 'LOCAL_ONLY', 'CONNECTED', 'POWER_USER'];
  const profile = security_profile || 'AIR_GAPPED';
  if (!validProfiles.includes(profile)) {
    return res.status(400).json({
      success: false,
      error: 'Please select a valid security profile.',
    });
  }

  // Create workspace directory if it doesn't exist
  try {
    if (!fs.existsSync(workspace_path)) {
      fs.mkdirSync(workspace_path, { recursive: true });
      logAudit('SETUP', 'WORKSPACE_CREATED', `Created workspace directory: ${workspace_path}`, null, 'INFO');
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Could not create the workspace folder. Please check permissions or choose a different location.',
    });
  }

  // Hash admin PIN if provided
  let adminPinHash: string | null = null;
  if (admin_pin && typeof admin_pin === 'string' && admin_pin.length >= 4) {
    adminPinHash = crypto.createHash('sha256').update(admin_pin).digest('hex');
  }

  // Create initial setup state if not exists
  const existingState = getSetupState();
  if (!existingState) {
    createSetupState(workspace_path);
  }

  // Complete setup
  const state = completeSetup(workspace_path, profile, adminPinHash);

  // Also store in app_settings for easy access
  setSetting('setupComplete', 'true');
  setSetting('workspacePath', workspace_path);
  setSetting('securityProfile', profile);
  if (adminPinHash) {
    setSetting('adminPinHash', adminPinHash);
  }
  setSetting('lastHealthCheckAt', new Date().toISOString());

  res.json({
    success: true,
    message: 'Setup completed successfully. Welcome to Clawd Console!',
    state: {
      completed: state.completed,
      workspace_path: state.workspace_path,
      security_profile: state.security_profile,
      has_admin_pin: !!state.admin_pin_hash,
    },
  });
});

/**
 * POST /api/setup/reset
 * Reset setup (requires admin PIN if set)
 */
router.post('/reset', (req: Request, res: Response) => {
  const { admin_pin } = req.body;
  const state = getSetupState();

  if (!state) {
    return res.status(400).json({
      success: false,
      error: 'Setup has not been completed yet.',
    });
  }

  // Verify admin PIN if set
  if (state.admin_pin_hash) {
    if (!admin_pin) {
      return res.status(403).json({
        success: false,
        error: 'Admin PIN is required to reset setup.',
        requires_pin: true,
      });
    }

    const providedHash = crypto.createHash('sha256').update(admin_pin).digest('hex');
    if (providedHash !== state.admin_pin_hash) {
      logAudit('SECURITY', 'INVALID_PIN', 'Invalid admin PIN provided for setup reset', null, 'HIGH');
      return res.status(403).json({
        success: false,
        error: 'Incorrect admin PIN.',
      });
    }
  }

  // Reset by creating new uncompleted state
  createSetupState(state.workspace_path);

  // Also update app_settings
  setSetting('setupComplete', 'false');

  logAudit('SETUP', 'RESET', 'Setup wizard reset', null, 'MEDIUM');

  res.json({
    success: true,
    message: 'Setup has been reset. Please complete the setup wizard again.',
  });
});

/**
 * POST /api/setup/pin/verify
 * Verify admin PIN (for future gated actions)
 */
router.post('/pin/verify', (req: Request, res: Response) => {
  const { admin_pin } = req.body;
  const state = getSetupState();

  if (!state || !state.admin_pin_hash) {
    return res.json({
      valid: true,
      message: 'No admin PIN is configured.',
    });
  }

  if (!admin_pin) {
    return res.status(400).json({
      valid: false,
      error: 'Please enter your admin PIN.',
    });
  }

  const providedHash = crypto.createHash('sha256').update(admin_pin).digest('hex');
  if (providedHash !== state.admin_pin_hash) {
    return res.status(403).json({
      valid: false,
      error: 'Incorrect admin PIN.',
    });
  }

  res.json({
    valid: true,
    message: 'PIN verified.',
  });
});

/**
 * POST /api/setup/run-health-check
 * Run a system health check
 */
router.post('/run-health-check', async (req: Request, res: Response) => {
  const clawdbotStatus = await checkClawdBotStatus();
  const localAIStatus = await detectLocalAI();

  // Update last health check time
  setSetting('lastHealthCheckAt', new Date().toISOString());

  res.json({
    timestamp: new Date().toISOString(),
    clawdbot: clawdbotStatus,
    localAI: localAIStatus,
    allGood: clawdbotStatus.connected || localAIStatus.anyAvailable,
  });
});

export default router;
