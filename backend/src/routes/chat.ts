import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getSetupState,
  createConversation,
  getConversations,
  getConversation,
  addMessage,
  getMessages,
  logAudit,
} from '../database/db.js';
import { sendToClawdBot, checkClawdBotStatus } from '../services/clawdbot.js';

const router = Router();

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

  // Check ClawdBot status
  const clawdbotStatus = await checkClawdBotStatus();
  if (!clawdbotStatus.connected) {
    return res.status(503).json({
      error: 'ClawdBot unavailable',
      message: 'ClawdBot is not running. Please start ClawdBot to send messages.',
    });
  }

  // Save user message
  const userMessageId = crypto.randomUUID();
  const userMessage = addMessage(userMessageId, conversationId, 'user', content.trim());

  // Send to ClawdBot
  const response = await sendToClawdBot(conversationId, content.trim());

  if (!response.success) {
    return res.status(502).json({
      error: 'Processing failed',
      message: response.error || 'Could not process your message. Please try again.',
      user_message: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        created_at: userMessage.created_at,
      },
    });
  }

  // Save assistant response
  const assistantContent = response.data?.message || response.data?.content || 'I received your message but could not generate a response.';
  const assistantMessageId = crypto.randomUUID();
  const assistantMessage = addMessage(assistantMessageId, conversationId, 'assistant', assistantContent);

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
    // Include any proposed actions from ClawdBot
    proposed_actions: response.data?.proposed_actions || [],
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
