import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getSetupState,
  getSecurityProfiles,
  getSecurityProfile,
  updateSecurityProfile,
  logAudit,
} from '../database/db.js';

const router = Router();

// Middleware to check setup completion
router.use((req: Request, res: Response, next) => {
  const state = getSetupState();
  if (!state || !state.completed) {
    return res.status(403).json({
      error: 'Setup required',
      message: 'Please complete the setup wizard before managing security settings.',
    });
  }
  next();
});

/**
 * GET /api/security/profiles
 * List all security profiles
 */
router.get('/profiles', (req: Request, res: Response) => {
  const profiles = getSecurityProfiles();
  const currentState = getSetupState()!;

  res.json({
    profiles: profiles.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      allow_network: p.allow_network,
      allow_external_ai: p.allow_external_ai,
      allow_system_access: p.allow_system_access,
      risk_level: p.risk_level,
      is_current: p.id === currentState.security_profile,
    })),
    current_profile: currentState.security_profile,
  });
});

/**
 * GET /api/security/current
 * Get current security profile details
 */
router.get('/current', (req: Request, res: Response) => {
  const state = getSetupState()!;
  const profile = getSecurityProfile(state.security_profile);

  if (!profile) {
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Current security profile not found. Please contact support.',
    });
  }

  res.json({
    profile: {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      allow_network: profile.allow_network,
      allow_external_ai: profile.allow_external_ai,
      allow_system_access: profile.allow_system_access,
      risk_level: profile.risk_level,
    },
    has_admin_pin: !!state.admin_pin_hash,
    warnings: getProfileWarnings(profile),
  });
});

/**
 * POST /api/security/profile
 * Change security profile
 */
router.post('/profile', (req: Request, res: Response) => {
  const { profile_id, admin_pin, confirm } = req.body;

  // Validate profile exists
  const newProfile = getSecurityProfile(profile_id);
  if (!newProfile) {
    return res.status(400).json({
      error: 'Invalid profile',
      message: 'The selected security profile does not exist.',
    });
  }

  const state = getSetupState()!;
  const currentProfile = getSecurityProfile(state.security_profile);

  // Check if changing to a higher risk profile
  const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const currentRiskIndex = riskOrder.indexOf(currentProfile?.risk_level || 'LOW');
  const newRiskIndex = riskOrder.indexOf(newProfile.risk_level);

  if (newRiskIndex > currentRiskIndex && !confirm) {
    return res.status(400).json({
      error: 'Confirmation required',
      message: `Switching to ${newProfile.name} increases your risk level from ${currentProfile?.risk_level} to ${newProfile.risk_level}. Please confirm this change.`,
      requires_confirmation: true,
      warnings: getProfileWarnings(newProfile),
    });
  }

  // Verify admin PIN if set
  if (state.admin_pin_hash) {
    if (!admin_pin) {
      return res.status(403).json({
        error: 'PIN required',
        message: 'Your admin PIN is required to change security profiles.',
        requires_pin: true,
      });
    }

    const providedHash = crypto.createHash('sha256').update(admin_pin).digest('hex');
    if (providedHash !== state.admin_pin_hash) {
      logAudit('SECURITY', 'INVALID_PIN', 'Invalid admin PIN for profile change', { attempted_profile: profile_id }, 'HIGH');
      return res.status(403).json({
        error: 'Invalid PIN',
        message: 'The admin PIN you entered is incorrect.',
      });
    }
  }

  // Update profile
  updateSecurityProfile(profile_id);

  res.json({
    success: true,
    message: `Security profile changed to ${newProfile.name}.`,
    profile: {
      id: newProfile.id,
      name: newProfile.name,
      description: newProfile.description,
      risk_level: newProfile.risk_level,
    },
    warnings: getProfileWarnings(newProfile),
  });
});

/**
 * POST /api/security/pin
 * Set or update admin PIN
 */
router.post('/pin', (req: Request, res: Response) => {
  const { current_pin, new_pin } = req.body;
  const state = getSetupState()!;

  // Verify current PIN if set
  if (state.admin_pin_hash) {
    if (!current_pin) {
      return res.status(403).json({
        error: 'Current PIN required',
        message: 'Please enter your current admin PIN.',
      });
    }

    const providedHash = crypto.createHash('sha256').update(current_pin).digest('hex');
    if (providedHash !== state.admin_pin_hash) {
      logAudit('SECURITY', 'INVALID_PIN', 'Invalid current PIN for PIN change', null, 'HIGH');
      return res.status(403).json({
        error: 'Invalid PIN',
        message: 'The current PIN you entered is incorrect.',
      });
    }
  }

  // Validate new PIN
  if (!new_pin || typeof new_pin !== 'string' || new_pin.length < 4) {
    return res.status(400).json({
      error: 'Invalid PIN',
      message: 'Please enter a PIN with at least 4 characters.',
    });
  }

  // Update PIN
  const newPinHash = crypto.createHash('sha256').update(new_pin).digest('hex');
  const db = require('../database/db.js').getDatabase();
  db.prepare(`
    UPDATE setup_state
    SET admin_pin_hash = ?, updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run(newPinHash);

  logAudit('SECURITY', 'PIN_CHANGED', 'Admin PIN was changed', null, 'MEDIUM');

  res.json({
    success: true,
    message: state.admin_pin_hash
      ? 'Your admin PIN has been updated.'
      : 'Admin PIN has been set. You will need it to change security settings.',
  });
});

/**
 * DELETE /api/security/pin
 * Remove admin PIN
 */
router.delete('/pin', (req: Request, res: Response) => {
  const { current_pin } = req.body;
  const state = getSetupState()!;

  if (!state.admin_pin_hash) {
    return res.status(400).json({
      error: 'No PIN set',
      message: 'There is no admin PIN to remove.',
    });
  }

  // Verify current PIN
  if (!current_pin) {
    return res.status(403).json({
      error: 'PIN required',
      message: 'Please enter your current admin PIN to remove it.',
    });
  }

  const providedHash = crypto.createHash('sha256').update(current_pin).digest('hex');
  if (providedHash !== state.admin_pin_hash) {
    logAudit('SECURITY', 'INVALID_PIN', 'Invalid PIN for PIN removal', null, 'HIGH');
    return res.status(403).json({
      error: 'Invalid PIN',
      message: 'The PIN you entered is incorrect.',
    });
  }

  // Remove PIN
  const db = require('../database/db.js').getDatabase();
  db.prepare(`
    UPDATE setup_state
    SET admin_pin_hash = NULL, updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run();

  logAudit('SECURITY', 'PIN_REMOVED', 'Admin PIN was removed', null, 'MEDIUM');

  res.json({
    success: true,
    message: 'Admin PIN has been removed.',
  });
});

/**
 * Get warnings for a security profile
 */
function getProfileWarnings(profile: ReturnType<typeof getSecurityProfile>): string[] {
  if (!profile) return [];

  const warnings: string[] = [];

  if (profile.allow_network) {
    warnings.push('This profile allows network access. Data may leave your computer.');
  }

  if (profile.allow_external_ai) {
    warnings.push('This profile allows external AI services. Your conversations may be sent to cloud providers.');
  }

  if (profile.allow_system_access) {
    warnings.push('This profile allows system-level access. Use with caution.');
  }

  if (profile.risk_level === 'HIGH' || profile.risk_level === 'CRITICAL') {
    warnings.push('This is a high-risk profile intended for advanced users only.');
  }

  return warnings;
}

export default router;
