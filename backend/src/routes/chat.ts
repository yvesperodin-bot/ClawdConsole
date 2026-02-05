import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getSetupState,
  createConversation,
  getConversations,
  getConversation,
  addMessage,
  getMessages,
  createPendingAction,
  logAudit,
} from '../database/db.js';
import { sendToClawdBot, checkClawdBotStatus, CLAWDBOT_MESSAGES } from '../services/clawdbot.js';
import { validatePath } from '../middleware/workspaceJail.js';

const router = Router();

/**
 * In-flight lock to prevent duplicate message sends per conversation.
 * Key: conversationId, Value: timestamp when lock acquired
 * Locks expire after 30 seconds (in case of crash/timeout)
 */
const conversationLocks = new Map<string, number>();
const LOCK_TIMEOUT_MS = 30000;

function acquireLock(conversationId: string): boolean {
  const now = Date.now();
  const existingLock = conversationLocks.get(conversationId);

  // Check if there's an active lock
  if (existingLock && (now - existingLock) < LOCK_TIMEOUT_MS) {
    return false; // Lock is held
  }

  // Acquire lock
  conversationLocks.set(conversationId, now);
  return true;
}

function releaseLock(conversationId: string): void {
  conversationLocks.delete(conversationId);
}

// Cleanup stale locks periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of conversationLocks.entries()) {
    if ((now - timestamp) >= LOCK_TIMEOUT_MS) {
      conversationLocks.delete(id);
    }
  }
}, 60000); // Clean up every minute

// Middleware to check setup completion
router.use((req: Request, res: Response, next) => {
  const state = getSetupState();
  if (!state || !state.completed) {
    return res.status(403).json({
      error: 'Setup required',
      message: 'Please complete the setup wizard before using chat.',
    });
  }
  next();
});

/**
 * GET /api/chat/conversations
 * List all conversations
 */
router.get('/conversations', (req: Request, res: Response) => {
  const conversations = getConversations();
  res.json({
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
  });
});

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
router.post('/conversations', (req: Request, res: Response) => {
  const { title } = req.body;
  const id = crypto.randomUUID();
  const conversationTitle = title || `Chat ${new Date().toLocaleDateString()}`;

  const conversation = createConversation(id, conversationTitle);

  res.status(201).json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      created_at: conversation.created_at,
    },
  });
});

/**
 * GET /api/chat/conversations/:id
 * Get a conversation with messages
 */
router.get('/conversations/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const conversation = getConversation(id);

  if (!conversation) {
    return res.status(404).json({
      error: 'Not found',
      message: 'This conversation could not be found.',
    });
  }

  const messages = getMessages(id);

  res.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
    },
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    })),
  });
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send a message in a conversation
 *
 * Flow:
 * 1. Acquire conversation lock (prevents double-send)
 * 2. Save user message
 * 3. If ClawdBot reachable: forward to ClawdBot /chat
 * 4. Save assistant response
 * 5. If proposedActions returned: persist to pending_actions table
 * 6. If ClawdBot unreachable: respond with calm local message
 * 7. Release lock
 */
router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const { content } = req.body;

  // Validate conversation exists
  const conversation = getConversation(conversationId);
  if (!conversation) {
    return res.status(404).json({
      error: 'Not found',
      message: 'This conversation could not be found.',
    });
  }

  // Validate message content
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid message',
      message: 'Please enter a message.',
    });
  }

  // Try to acquire lock - prevent double-send
  if (!acquireLock(conversationId)) {
    return res.status(429).json({
      error: 'Already processing',
      message: 'A message is already being sent. Please wait.',
    });
  }

  // Save user message first (always persisted)
  const userMessageId = crypto.randomUUID();
  const userMessage = addMessage(userMessageId, conversationId, 'user', content.trim());

  // Check ClawdBot status
  const clawdbotStatus = await checkClawdBotStatus();

  if (!clawdbotStatus.connected) {
    // ClawdBot not available - respond with calm local message
    const offlineContent = CLAWDBOT_MESSAGES.OFFLINE_MODE + ' Your message has been saved. When ClawdBot is available, you can continue the conversation.';
    const offlineMessageId = crypto.randomUUID();
    const offlineMessage = addMessage(offlineMessageId, conversationId, 'system', offlineContent);

    logAudit('CHAT', 'OFFLINE_MODE', 'Message saved while ClawdBot unavailable', { conversationId }, 'INFO');

    releaseLock(conversationId);
    return res.json({
      user_message: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        created_at: userMessage.created_at,
      },
      assistant_message: {
        id: offlineMessage.id,
        role: offlineMessage.role,
        content: offlineMessage.content,
        created_at: offlineMessage.created_at,
      },
      clawdbot_available: false,
      proposed_actions: [],
    });
  }

  // Send to ClawdBot
  const response = await sendToClawdBot(conversationId, content.trim());

  if (!response.success) {
    // ClawdBot error - still save an error message
    const errorContent = response.error || 'Could not process your message. Please try again.';
    const errorMessageId = crypto.randomUUID();
    const errorMessage = addMessage(errorMessageId, conversationId, 'system', errorContent);

    releaseLock(conversationId);
    return res.json({
      user_message: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        created_at: userMessage.created_at,
      },
      assistant_message: {
        id: errorMessage.id,
        role: errorMessage.role,
        content: errorMessage.content,
        created_at: errorMessage.created_at,
      },
      clawdbot_available: false,
      proposed_actions: [],
    });
  }

  // Save assistant response
  const assistantContent = response.response || 'I received your message.';
  const assistantMessageId = crypto.randomUUID();
  const assistantMessage = addMessage(assistantMessageId, conversationId, 'assistant', assistantContent);

  // Process proposed actions
  const proposedActions: Array<{
    id: string;
    action_type: string;
    target: string;
    summary: string;
    risk_level: string;
    preview: string | null;
  }> = [];

  if (response.proposedActions && response.proposedActions.length > 0) {
    for (const action of response.proposedActions) {
      // Validate file paths for file operations
      if (action.type.startsWith('FILE_') || action.type.includes('FILE')) {
        const pathCheck = validatePath(action.target);
        if (!pathCheck.allowed) {
          logAudit('SECURITY', 'ACTION_PATH_BLOCKED', `Proposed action blocked: ${pathCheck.reason}`, { actionType: action.type, target: action.target }, 'HIGH');
          continue; // Skip this action - don't persist it
        }
      }

      // Create a local ID for this action
      const localId = crypto.randomUUID();

      // Persist to pending_actions table
      const pendingAction = createPendingAction(
        localId,
        action.type,
        action.target,
        action.summary,
        action.riskLevel,
        action.preview || null,
        conversationId,
        action.actionId // ClawdBot's action ID
      );

      proposedActions.push({
        id: pendingAction.id,
        action_type: pendingAction.action_type,
        target: pendingAction.target,
        summary: pendingAction.summary,
        risk_level: pendingAction.risk_level,
        preview: pendingAction.preview,
      });
    }

    if (proposedActions.length > 0) {
      logAudit('CHAT', 'PROPOSED_ACTIONS', `${proposedActions.length} action(s) proposed and awaiting approval`, { conversationId, count: proposedActions.length }, 'INFO');
    }
  }

  releaseLock(conversationId);
  res.json({
    user_message: {
      id: userMessage.id,
      role: userMessage.role,
      content: userMessage.content,
      created_at: userMessage.created_at,
    },
    assistant_message: {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      created_at: assistantMessage.created_at,
    },
    clawdbot_available: true,
    proposed_actions: proposedActions,
  });
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const conversation = getConversation(id);

  if (!conversation) {
    return res.status(404).json({
      error: 'Not found',
      message: 'This conversation could not be found.',
    });
  }

  // Note: Messages are deleted via CASCADE in the database
  const db = require('../database/db.js').getDatabase();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);

  logAudit('CHAT', 'CONVERSATION_DELETED', `Deleted conversation: ${conversation.title}`, { id }, 'INFO');

  res.json({
    success: true,
    message: 'Conversation deleted.',
  });
});

export default router;
