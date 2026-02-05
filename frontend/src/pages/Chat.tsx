import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../services/api';

/**
 * Chat Page - Local AI conversation interface
 */

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface ProposedAction {
  id: string;
  action_type: string;
  target: string;
  summary: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  preview: string | null;
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposedActions, setProposedActions] = useState<ProposedAction[]>([]);
  const [clawdbotAvailable, setClawdbotAvailable] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadConversations() {
    setLoading(true);
    const result = await apiGet<{ conversations: Conversation[] }>('/api/chat/conversations');
    if (result.data) {
      setConversations(result.data.conversations);
    }
    setLoading(false);
  }

  async function createConversation() {
    const result = await apiPost<{ conversation: Conversation }>('/api/chat/conversations', {
      title: `Chat ${new Date().toLocaleString()}`,
    });
    if (result.data) {
      setConversations([result.data.conversation, ...conversations]);
      selectConversation(result.data.conversation);
    }
  }

  async function selectConversation(conversation: Conversation) {
    setActiveConversation(conversation);
    setMessages([]);
    setProposedActions([]);
    setClawdbotAvailable(null);
    setLoading(true);
    setError(null);

    const result = await apiGet<{ conversation: Conversation; messages: Message[] }>(
      `/api/chat/conversations/${conversation.id}`
    );
    if (result.data) {
      setMessages(result.data.messages);
    }
    setLoading(false);
  }

  async function deleteConversation(conversation: Conversation) {
    if (!confirm(`Delete "${conversation.title}"?`)) return;

    await apiDelete(`/api/chat/conversations/${conversation.id}`);
    setConversations(conversations.filter(c => c.id !== conversation.id));

    if (activeConversation?.id === conversation.id) {
      setActiveConversation(null);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!inputValue.trim() || !activeConversation || sending) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);
    setError(null);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    const result = await apiPost<{
      user_message: Message;
      assistant_message: Message;
      clawdbot_available: boolean;
      proposed_actions: ProposedAction[];
      error?: string;
    }>(`/api/chat/conversations/${activeConversation.id}/messages`, { content });

    if (result.error) {
      // Show error but keep user message
      setError(result.error);
      // Add system error message
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: result.error,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(0, -1), tempUserMsg, errorMsg]);
    } else if (result.data) {
      // Replace temp message with real ones
      setMessages(prev => [
        ...prev.slice(0, -1),
        result.data!.user_message,
        result.data!.assistant_message,
      ]);

      // Update ClawdBot availability status
      setClawdbotAvailable(result.data.clawdbot_available);

      // Update proposed actions
      if (result.data.proposed_actions && result.data.proposed_actions.length > 0) {
        setProposedActions(prev => [...prev, ...result.data!.proposed_actions]);
      }
    }

    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function formatActionType(type: string): string {
    const typeMap: Record<string, string> = {
      FILE_READ: 'Read File',
      FILE_WRITE: 'Write File',
      FILE_DELETE: 'Delete File',
      LIST_DIR: 'List Directory',
      CREATE_FILE: 'Create File',
      RUN_COMMAND: 'Run Command',
      COMMAND_EXECUTE: 'Run Command',
      NETWORK_REQUEST: 'Network Request',
    };
    return typeMap[type] || type;
  }

  function dismissProposedActions() {
    setProposedActions([]);
  }

  return (
    <div className="chat-layout">
      {/* Conversation sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Conversations</h2>
          <button className="btn btn-primary btn-small" onClick={createConversation}>
            New
          </button>
        </div>

        <div className="conversation-list">
          {loading && conversations.length === 0 && (
            <div className="empty-state">Loading...</div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="empty-state">
              No conversations yet.<br />
              Click "New" to start.
            </div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${activeConversation?.id === conv.id ? 'active' : ''}`}
              onClick={() => selectConversation(conv)}
            >
              <div className="conversation-title">{conv.title}</div>
              <div className="conversation-meta">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
              <button
                className="conversation-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv);
                }}
                title="Delete conversation"
              >
                x
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat-main">
        {!activeConversation ? (
          <div className="chat-empty">
            <div className="chat-empty-content">
              <h2>Local AI Chat</h2>
              <p>
                Chat with your local AI assistant. All conversations are stored
                on your computer only.
              </p>
              <div className="chat-notice">
                <strong>Safety first:</strong> Any actions the AI suggests will require
                your approval before they run.
              </div>
              <button className="btn btn-primary" onClick={createConversation}>
                Start New Conversation
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="chat-header">
              <h3>{activeConversation.title}</h3>
              <span className="text-muted">Local AI - All actions require approval</span>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && !loading && (
                <div className="chat-start-hint">
                  Start the conversation by typing a message below.
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`message message-${msg.role}`}>
                  <div className="message-header">
                    <span className="message-role">
                      {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : 'System'}
                    </span>
                    <span className="message-time">{formatTime(msg.created_at)}</span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
              {sending && (
                <div className="message message-assistant">
                  <div className="message-header">
                    <span className="message-role">AI</span>
                  </div>
                  <div className="message-content message-thinking">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error display */}
            {error && (
              <div className="chat-error">
                {error}
              </div>
            )}

            {/* ClawdBot status indicator */}
            {clawdbotAvailable === false && (
              <div className="chat-status-banner offline">
                ClawdBot is not available. Messages are saved locally.
              </div>
            )}

            {/* Proposed actions banner */}
            {proposedActions.length > 0 && (
              <div className="chat-proposed-actions">
                <div className="proposed-actions-header">
                  <span className="proposed-actions-title">
                    {proposedActions.length} action{proposedActions.length > 1 ? 's' : ''} awaiting your approval
                  </span>
                  <button
                    className="btn btn-link btn-small"
                    onClick={dismissProposedActions}
                  >
                    Dismiss
                  </button>
                </div>
                <div className="proposed-actions-list">
                  {proposedActions.slice(0, 3).map(action => (
                    <div key={action.id} className={`proposed-action-item risk-${action.risk_level.toLowerCase()}`}>
                      <span className={`risk-dot risk-${action.risk_level.toLowerCase()}`}></span>
                      <span className="proposed-action-type">{formatActionType(action.action_type)}</span>
                      <span className="proposed-action-summary">{action.summary}</span>
                    </div>
                  ))}
                  {proposedActions.length > 3 && (
                    <div className="proposed-actions-more">
                      +{proposedActions.length - 3} more action{proposedActions.length - 3 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <div className="proposed-actions-footer">
                  <span className="text-muted">Actions never run without your approval.</span>
                  <Link to="/approvals" className="btn btn-primary btn-small">
                    Review Actions
                  </Link>
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="chat-input-area">
              <textarea
                className="chat-input"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Enter to send)"
                rows={2}
                disabled={sending}
              />
              <button
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={!inputValue.trim() || sending}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
