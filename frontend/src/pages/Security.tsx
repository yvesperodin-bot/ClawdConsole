/**
 * Security Page - Security profiles management
 */
export default function Security() {
  return (
    <div>
      <h1 className="page-title">Security Profiles</h1>
      <span className="badge-placeholder">Coming in Checkpoint E</span>

      <div className="card">
        <h2 className="card-title">Available Profiles</h2>
        <ul className="feature-list">
          <li><strong>AIR-GAPPED</strong> (default) - Complete isolation, no network</li>
          <li><strong>LOCAL-ONLY</strong> - Local AI services only</li>
          <li><strong>CONNECTED</strong> - Allow-list network access</li>
          <li><strong>POWER USER</strong> - Full access with logging</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Profile Changes</h2>
        <ul className="feature-list">
          <li>Confirmation required for all changes</li>
          <li>Optional Admin PIN protection</li>
          <li>All changes logged to audit trail</li>
        </ul>
      </div>
    </div>
  );
}
