import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../services/api';

/**
 * Dashboard Page - Status overview
 */

interface StatusData {
  setup_required?: boolean;
  clawdbot?: {
    connected: boolean;
    version?: string;
    status_message: string;
  };
  local_ai?: {
    available: boolean;
    providers: Array<{ name: string; models: number }>;
  };
  network?: {
    allowed: boolean;
    status: string;
    status_message: string;
  };
  security?: {
    profile_id: string;
    profile_name: string;
    risk_level: string;
  };
  workspace?: {
    path: string;
  };
  pending_approvals?: {
    count: number;
    actions: Array<{
      id: string;
      type: string;
      summary: string;
      risk_level: string;
    }>;
  };
  last_health_check?: string | null;
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);

  useEffect(() => {
    fetchStatus();
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    const result = await apiGet<StatusData>('/api/status');
    if (result.error) {
      setError(result.error);
    } else {
      setStatus(result.data ?? null);
      setError(null);
    }
    setLoading(false);
  }

  async function runHealthCheck() {
    setRunningHealthCheck(true);
    await apiPost('/api/setup/run-health-check', {});
    await fetchStatus();
    setRunningHealthCheck(false);
  }

  function formatLastHealthCheck(timestamp: string | null | undefined): string {
    if (!timestamp) return 'Never';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <div className="card">
          <p className="text-secondary">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <div className="card">
          <p style={{ color: 'var(--color-danger)' }}>
            Unable to connect to server: {error}
          </p>
        </div>
      </div>
    );
  }

  if (status?.setup_required) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <div className="card">
          <h2 className="card-title">Welcome to Clawd Console</h2>
          <p className="text-secondary" style={{ marginBottom: 'var(--spacing-md)' }}>
            Please complete the setup wizard to get started.
          </p>
          <a href="/setup" className="btn btn-primary">Start Setup</a>
        </div>
      </div>
    );
  }

  const riskClass = status?.security?.risk_level?.toLowerCase() || 'low';

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="card">
        <h2 className="card-title">System Status</h2>
        <div className="status-grid">
          <StatusItem
            label="ClawdBot"
            value={status?.clawdbot?.connected ? `Connected${status.clawdbot.version ? ` (v${status.clawdbot.version})` : ''}` : 'Not Running'}
            connected={status?.clawdbot?.connected ?? false}
          />
          <StatusItem
            label="Local AI"
            value={status?.local_ai?.available
              ? `${status.local_ai.providers.map(p => p.name).join(', ')}`
              : 'Not Available'}
            connected={status?.local_ai?.available ?? false}
          />
          <StatusItem
            label="Network"
            value={status?.network?.status ?? 'DISABLED'}
            connected={false}
            neutral={true}
          />
          <StatusItem
            label="Pending Approvals"
            value={String(status?.pending_approvals?.count ?? 0)}
            connected={true}
            neutral={true}
            highlight={(status?.pending_approvals?.count ?? 0) > 0}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Security Profile</h2>
        <div className="profile-display">
          <span className="profile-name-large">{status?.security?.profile_name ?? 'Unknown'}</span>
          <span className={`risk-badge risk-${riskClass}`}>
            {status?.security?.risk_level ?? 'UNKNOWN'} RISK
          </span>
        </div>
        <p className="text-secondary" style={{ marginTop: 'var(--spacing-sm)' }}>
          {status?.network?.status_message}
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Workspace</h2>
        <p className="text-secondary">
          <strong>Path:</strong>{' '}
          <code className="workspace-path">{status?.workspace?.path ?? 'Not configured'}</code>
        </p>
        <p className="text-muted" style={{ marginTop: 'var(--spacing-sm)', fontSize: '13px' }}>
          AI can only access files within this folder.
        </p>
      </div>

      <div className="card">
        <div className="card-header-row">
          <h2 className="card-title">Health Check</h2>
          <span className="text-muted">{formatLastHealthCheck(status?.last_health_check)}</span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={runHealthCheck}
          disabled={runningHealthCheck}
        >
          {runningHealthCheck ? 'Running...' : 'Run Health Check'}
        </button>
      </div>

      {(status?.pending_approvals?.count ?? 0) > 0 && (
        <div className="card card-warning">
          <h2 className="card-title">Pending Approvals</h2>
          <p className="text-secondary" style={{ marginBottom: 'var(--spacing-sm)' }}>
            {status?.pending_approvals?.count} action{(status?.pending_approvals?.count ?? 0) !== 1 ? 's' : ''} waiting for your review.
          </p>
          <ul className="action-preview-list">
            {status?.pending_approvals?.actions.map(action => (
              <li key={action.id} className={`action-preview risk-${action.risk_level.toLowerCase()}`}>
                <span className="action-type">{action.type}</span>
                <span className="action-summary">{action.summary}</span>
              </li>
            ))}
          </ul>
          <a href="/approvals" className="btn btn-primary" style={{ marginTop: 'var(--spacing-md)' }}>
            Review Approvals
          </a>
        </div>
      )}
    </div>
  );
}

function StatusItem({
  label,
  value,
  connected,
  neutral = false,
  highlight = false,
}: {
  label: string;
  value: string;
  connected: boolean;
  neutral?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`status-item ${highlight ? 'status-highlight' : ''}`}>
      <span className="status-label">{label}</span>
      <span className="status-value">
        {!neutral && (
          <span
            className={`status-dot ${connected ? 'online' : 'offline'}`}
            style={{ marginRight: '8px' }}
          />
        )}
        {value}
      </span>
    </div>
  );
}
