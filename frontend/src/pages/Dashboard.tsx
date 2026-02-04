/**
 * Dashboard Page - Status overview
 */
export default function Dashboard() {
  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <span className="badge-placeholder">Coming in Checkpoint E</span>

      <div className="card">
        <h2 className="card-title">Status Overview</h2>
        <ul className="feature-list">
          <li>ClawdBot connection status (connected / not running)</li>
          <li>Network state indicator (OFF by default)</li>
          <li>Active security profile display</li>
          <li>Workspace path information</li>
          <li>Pending approvals counter</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Quick Actions</h2>
        <ul className="feature-list">
          <li>New Chat button</li>
          <li>Security settings shortcut</li>
          <li>View logs shortcut</li>
          <li>Re-run Setup Wizard option</li>
        </ul>
      </div>
    </div>
  );
}
