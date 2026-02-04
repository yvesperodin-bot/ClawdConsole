import { logAudit } from '../database/db.js';

/**
 * ClawdBot Service
 *
 * Handles communication with the local ClawdBot agent running on localhost:7331.
 * This is the ONLY external service allowed in AIR_GAPPED mode since it's local.
 */

const CLAWDBOT_URL = 'http://localhost:7331';
const TIMEOUT_MS = 5000;

export interface ClawdBotStatus {
  connected: boolean;
  version?: string;
  uptime?: number;
  error?: string;
}

export interface ClawdBotResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Check if ClawdBot is running and accessible
 */
export async function checkClawdBotStatus(): Promise<ClawdBotStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${CLAWDBOT_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        connected: true,
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
    if (!errorMessage.includes('ECONNREFUSED')) {
      logAudit('CLAWDBOT', 'CONNECTION_ERROR', `Failed to connect to ClawdBot: ${errorMessage}`, null, 'INFO');
    }

    return {
      connected: false,
      error: getClawdBotFriendlyError(errorMessage),
    };
  }
}

/**
 * Send a message to ClawdBot for processing
 */
export async function sendToClawdBot(
  conversationId: string,
  message: string
): Promise<ClawdBotResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for processing

    const response = await fetch(`${CLAWDBOT_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      logAudit('CLAWDBOT', 'MESSAGE_SENT', 'Message sent to ClawdBot', { conversationId }, 'INFO');
      return {
        success: true,
        data: data,
      };
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    logAudit('CLAWDBOT', 'REQUEST_FAILED', `ClawdBot request failed: ${errorText}`, { conversationId, status: response.status }, 'MEDIUM');

    return {
      success: false,
      error: `ClawdBot could not process your request. Please try again.`,
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

/**
 * Request an action from ClawdBot (returns a pending action for approval)
 */
export async function requestAction(
  actionType: string,
  target: string,
  parameters: Record<string, any>
): Promise<ClawdBotResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${CLAWDBOT_URL}/action/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action_type: actionType,
        target: target,
        parameters: parameters,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    }

    return {
      success: false,
      error: 'Could not request action from ClawdBot.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: getClawdBotFriendlyError(errorMessage),
    };
  }
}

/**
 * Execute an approved action
 */
export async function executeApprovedAction(actionId: string): Promise<ClawdBotResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for execution

    const response = await fetch(`${CLAWDBOT_URL}/action/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action_id: actionId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      logAudit('CLAWDBOT', 'ACTION_EXECUTED', `Action ${actionId} executed`, { actionId, result: data }, 'INFO');
      return {
        success: true,
        data: data,
      };
    }

    return {
      success: false,
      error: 'Could not execute the action. Please try again.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logAudit('CLAWDBOT', 'EXECUTION_FAILED', `Action execution failed: ${errorMessage}`, { actionId }, 'HIGH');
    return {
      success: false,
      error: getClawdBotFriendlyError(errorMessage),
    };
  }
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
};
