/**
 * Integrations Page - External services configuration
 */
export default function Integrations() {
  return (
    <div>
      <h1 className="page-title">Integrations</h1>
      <span className="badge-placeholder">Coming in Checkpoint E</span>

      <div className="card">
        <h2 className="card-title">Local AI Providers</h2>
        <ul className="feature-list">
          <li>Ollama detection and configuration</li>
          <li>LM Studio detection and configuration</li>
          <li>Model selection for local inference</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">External Services (Disabled by Default)</h2>
        <ul className="feature-list">
          <li>Cloud LLMs (OpenAI, Claude) - requires CONNECTED profile</li>
          <li>All external access OFF by default</li>
          <li>Requires explicit user action to enable</li>
          <li>Visibly indicated when active</li>
        </ul>
      </div>
    </div>
  );
}
