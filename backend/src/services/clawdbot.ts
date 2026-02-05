import { logAudit } from '../database/db.js';

/**
 * ClawdBot Service
 *
 * Handles communication with the local ClawdBot agent running on localhost:7331.
 * This is the ONLY external service allowed in AIR_GAPPED mode since it's local.
 *
 * API Contract:
 * - GET  /health                -> { ok, version? }
 * - POST /chat                  -> { conversationId, response, proposedActions?[] }
 * - POST /actions/approve       -> { ok, resultSummary, updatedFiles? }
 * - POST /actions/deny          -> { ok }
 */

const CLAWDBOT_URL = 'http://127.0.0.1:7331';

// Timeouts
const HEALTH_CHECK_TIMEOUT_MS = 1000;   // Fast timeout for status checks
const CHAT_TIMEOUT_MS = 5000;           // 5s for chat
const ACTION_TIMEOUT_MS = 10000;        // 10s for action execution

// ============================================================================
// Type Definitions
// ============================================================================

export interface ClawdBotStatus {
  connected: boolean;
  version?: string;
  uptime?: number;
  error?: string;
}

export interface ProposedAction {
  actionId: string;
  type: string;
  target: string;
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  preview?: string;
}

export interface ClawdBotChatResponse {
  success: boolean;
  conversationId?: string;
  response?: string;
  proposedActions?: ProposedAction[];
  error?: string;
}

export interface ClawdBotActionResult {
  success: boolean;
  ok?: boolean;
  resultSummary?: string;
  updatedFiles?: string[];
  error?: string;
}

// Legacy interface for backwards compatibility
export interface ClawdBotResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if ClawdBot is running and accessible
 * GET /health -> { ok, version? }
 */
export async function checkClawdBotStatus(): Promise<ClawdBotStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    const response = await fetch(`${CLAWDBOT_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        connected: data.ok === true || response.ok,
        version: data.version || 'unknown',
        uptime: data.uptime,
      };
    }

    return {
      connected: false,
      error: `ClawdBot responded with status ${response.status}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Don't log every failed health check as it's normal during startup
    if (!errorMessage.includes('ECONNREFUSED') && !errorMessage.includes('abort')) {
      logAudit('CLAWDBOT', 'CONNECTION_ERROR', `Failed to connect to ClawdBot: ${errorMessage}`, null, 'INFO');
    }

    return {
      connected: false,
      error: getClawdBotFriendlyError(errorMessage),
    };
  }
}

// ============================================================================
// Chat
// ============================================================================

/**
 * Send a message to ClawdBot for processing
 * POST /chat -> { conversationId?, message } -> { conversationId, response, proposedActions?[] }
 */
export async function sendToClawdBot(
  conversationId: string,
  message: string
): Promise<ClawdBotChatResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    const response = await fetch(`${CLAWDBOT_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: conversationId,
        message: message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      logAudit('CLAWDBOT', 'MESSAGE_SENT', 'Message sent to ClawdBot', { conversationId }, 'INFO');

      // Normalize proposed actions
      const proposedActions: ProposedAction[] = [];
      if (data.proposedActions && Array.isArray(data.proposedActions)) {
        for (const action of data.proposedActions) {
          proposedActions.push({
            actionId: action.actionId || action.id,
            type: action.type || action.action_type,
            target: action.target,
            summary: action.summary || action.description,
            riskLevel: normalizeRiskLevel(action.riskLevel || action.risk_level),
            preview: action.preview,
          });
        }
      }

      return {
        success: true,
        conversationId: data.conversationId || conversationId,
        response: data.response || data.message || data.content,
        proposedActions: proposedActions.length > 0 ? proposedActions : undefined,
      };
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    logAudit('CLAWDBOT', 'REQUEST_FAILED', `ClawdBot chat request failed: ${errorText}`, { conversationId, status: response.status }, 'MEDIUM');

    return {
      success: false,
      error: `ClawdBot could not process your request (status ${response.status}).`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logAudit('CLAWDBOT', 'CONNECTION_ERROR', `Failed to communicate with ClawdBot: ${errorMessage}`, { conversationId }, 'MEDIUM');

    return {
      success: false,
      error: getClawdBotFriendlyError(errorMessage),
    };
  }
}

// ============================================================================
// Action Approval
// ============================================================================

/**
 * Forward approval to ClawdBot
 * POST /actions/approve -> { conversationId, actionId } -> { ok, resultSummary, updatedFiles? }
 */
export async function approveClawdBotAction(
  conversationId: string,
  clawdActionId: string
): Promise<ClawdBotActionResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);

    const response = await fetch(`${CLAWDBOT_URL}/actions/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: conversationId,
        actionId: clawdActionId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      logAudit('CLAWDBOT', 'ACTION_APPROVED', `Action ${clawdActionId} approved and forwarded`, { conversationId, clawdActionId }, 'INFO');

      return {
        success: true,
        ok: data.ok,
        resultSummary: data.resultSummary || data.result_summary || 'Action completed',
        updatedFiles: data.updatedFiles || data.updated_files,
      };
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    logAudit('CLAWDBOT', 'ACTION_APPROVAL_FAILED', `ClawdBot action approval failed: ${errorText}`, { conversationId, clawdActionId, status: response.status }, 'MEDIUM');

    return {
      success: false,
      error: `ClawdBot could not execute the action (status ${response.status}).`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logAudit('CLAWDBOT', 'ACTION_EXECUTION_FAILED', `Failed to forward approval to ClawdBot: ${errorMessage}`, { conversationId, clawdActionId }, 'HIGH');

    return {
      success: false,
      error: getClawdBotFriendlyError(errorMessage),
    };
  }
}

/**
 * Forward denial to ClawdBot (best effort)
 * POST /actions/deny -> { conversationId, actionId, reason? } -> { ok }
 */
export async function denyClawdBotAction(
  conversationId: string,
  clawdActionId: string,
  reason?: string
): Promise<ClawdBotActionResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);

    const response = await fetch(`${CLAWDBOT_URL}/actions/deny`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: conversationId,
        actionId: clawdActionId,
        reason: reason,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      logAudit('CLAWDBOT', 'ACTION_DENIED', `Action ${clawdActionId} denied and forwarded`, { conversationId, clawdActionId, reason }, 'INFO');

      return {
        success: true,
        ok: data.ok,
      };
    }

    // Denial forwarding is best effort - log but don't fail
    logAudit('CLAWDBOT', 'ACTION_DENY_FORWARD_FAILED', `ClawdBot deny forward failed (best effort)`, { conversationId, clawdActionId, status: response.status }, 'INFO');

    return {
      success: true, // Still mark as success since local denial is what matters
      ok: true,
    };
  } catch (error) {
    // Denial forwarding is best effort - log but don't fail
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logAudit('CLAWDBOT', 'ACTION_DENY_FORWARD_FAILED', `Failed to forward denial to ClawdBot (best effort): ${errorMessage}`, { conversationId, clawdActionId }, 'INFO');

    return {
      success: true, // Still mark as success since local denial is what matters
      ok: true,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize risk level to our enum
 */
function normalizeRiskLevel(level: string | undefined): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (!level) return 'MEDIUM';
  const normalized = level.toUpperCase();
  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH') {
    return normalized;
  }
  return 'MEDIUM';
}

/**
 * Convert technical errors to friendly messages
 */
function getClawdBotFriendlyError(error: string): string {
  if (error.includes('ECONNREFUSED')) {
    return 'ClawdBot is not running. Please start ClawdBot and try again.';
  }
  if (error.includes('abort') || error.includes('timeout')) {
    return 'ClawdBot is taking too long to respond. It might be busy or not running properly.';
  }
  if (error.includes('ENOTFOUND')) {
    return 'Could not find ClawdBot on this computer. Please check if it is installed correctly.';
  }
  return 'Could not connect to ClawdBot. Please make sure it is running on this computer.';
}

/**
 * Friendly status messages for the UI
 */
export const CLAWDBOT_MESSAGES = {
  CONNECTED: 'ClawdBot is running and ready to help.',
  NOT_RUNNING: 'ClawdBot is not running. Start it to enable AI assistance.',
  STARTING: 'Connecting to ClawdBot...',
  ERROR: 'There was a problem connecting to ClawdBot.',
  OFFLINE_MODE: 'ClawdBot is not available. Working in offline mode.',
};
