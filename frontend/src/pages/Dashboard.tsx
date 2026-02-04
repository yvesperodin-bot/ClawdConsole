import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';

/**
 * Dashboard Page - Status overview
 */

interface StatusData {
  setup_required?: boolean;
  clawdbot?: {
    connected: boolean;
    status_message: string;
  };
  network?: {
    allowed: boolean;
    status: string;
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
  };
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <span className="badge-placeholder">Setup Wizard coming in Checkpoint D</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="card">
        <h2 className="card-title">System Status</h2>
        <div className="status-grid">
          <StatusItem
            label="ClawdBot"
            value={status?.clawdbot?.connected ? 'Connected' : 'Not Running'}
            connected={status?.clawdbot?.connected ?? false}
          />
          <StatusItem
            label="Network"
            value={status?.network?.status ?? 'DISABLED'}
            connected={false}
            neutral={true}
          />
          <StatusItem
            label="Security Profile"
            value={status?.security?.profile_name ?? 'Unknown'}
            connected={true}
            neutral={true}
          />
          <StatusItem
            label="Pending Approvals"
            value={String(status?.pending_approvals?.count ?? 0)}
            connected={true}
            neutral={true}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Workspace</h2>
        <p className="text-secondary">
          <strong>Path:</strong> {status?.workspace?.path ?? 'Not configured'}
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Quick Actions</h2>
        <p className="text-muted">Coming in Checkpoint E</p>
      </div>
    </div>
  );
}

function StatusItem({
  label,
  value,
  connected,
  neutral = false,
}: {
  label: string;
  value: string;
  connected: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="status-item">
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
