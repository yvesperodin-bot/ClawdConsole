/**
 * Settings Page - Application configuration
 */
export default function Settings() {
  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <span className="badge-placeholder">Coming in Checkpoint E</span>

      <div className="card">
        <h2 className="card-title">Workspace Configuration</h2>
        <ul className="feature-list">
          <li>View current workspace path</li>
          <li>Change workspace directory</li>
          <li>Workspace usage statistics</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Setup Wizard</h2>
        <ul className="feature-list">
          <li>Re-run the first-time setup wizard</li>
          <li>Reset all settings to defaults</li>
          <li>Health check and diagnostics</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Admin PIN</h2>
        <ul className="feature-list">
          <li>Set or change admin PIN</li>
          <li>Required for security profile changes</li>
        </ul>
      </div>
    </div>
  );
}
