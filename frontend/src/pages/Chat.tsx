/**
 * Chat Page - Local AI conversation interface
 */
export default function Chat() {
  return (
    <div>
      <h1 className="page-title">Chat</h1>
      <span className="badge-placeholder">Coming in Checkpoint E</span>

      <div className="card">
        <h2 className="card-title">Local AI Chat</h2>
        <ul className="feature-list">
          <li>Conversation list (stored locally in SQLite)</li>
          <li>Chat thread with message history</li>
          <li>Input box for sending messages</li>
          <li>Banner: "Local-first AI. Actions require approval."</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Safety Features</h2>
        <ul className="feature-list">
          <li>No auto-actions - all tool calls go through approval</li>
          <li>Conversations stored locally only</li>
          <li>Works with Ollama or LM Studio</li>
        </ul>
      </div>
    </div>
  );
}
