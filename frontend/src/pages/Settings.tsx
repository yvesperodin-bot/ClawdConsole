import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiGet } from '../services/api';

/**
 * Settings Page - Application configuration
 */

interface SetupState {
  workspacePath: string;
  securityProfile: string;
  hasAdminPin: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRerunSetup() {
    // First check if PIN is required
    const stateResult = await apiGet<SetupState>('/api/setup/state');
    if (stateResult.data?.hasAdminPin) {
      setShowPinDialog(true);
      return;
    }
    // No PIN required, proceed with reset
    await resetAndNavigate();
  }

  async function resetAndNavigate(pin?: string) {
    setLoading(true);
    setError(null);

    const result = await apiPost<{ success: boolean; error?: string; requires_pin?: boolean }>(
      '/api/setup/reset',
      { admin_pin: pin }
    );

    if (result.data?.success) {
      // Redirect to setup wizard
      navigate('/setup');
    } else if (result.data?.requires_pin) {
      setShowPinDialog(true);
      setLoading(false);
    } else {
      setError(result.data?.error || result.error || 'Failed to reset setup');
      setLoading(false);
    }
  }

  async function handlePinSubmit() {
    if (!adminPin) {
      setError('Please enter your admin PIN');
      return;
    }
    await resetAndNavigate(adminPin);
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      <div className="card">
        <h2 className="card-title">Setup Wizard</h2>
        <p className="text-secondary" style={{ marginBottom: 'var(--spacing-md)' }}>
          Re-run the setup wizard to change your workspace, security profile, or other settings.
        </p>
        <button className="btn btn-secondary" onClick={handleRerunSetup} disabled={loading}>
          {loading ? 'Processing...' : 'Re-run Setup Wizard'}
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">Workspace Configuration</h2>
        <span className="badge-placeholder">Coming in Checkpoint E</span>
        <ul className="feature-list">
          <li>View current workspace path</li>
          <li>Change workspace directory</li>
          <li>Workspace usage statistics</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Admin PIN</h2>
        <span className="badge-placeholder">Coming in Checkpoint E</span>
        <ul className="feature-list">
          <li>Set or change admin PIN</li>
          <li>Required for security profile changes</li>
        </ul>
      </div>

      {/* PIN Dialog */}
      {showPinDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Admin PIN Required</h3>
            <p>Enter your admin PIN to reset the setup wizard.</p>
            <div className="form-group">
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter PIN"
                maxLength={8}
              />
            </div>
            {error && <div className="validation-message invalid">{error}</div>}
            <div className="dialog-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPinDialog(false);
                  setAdminPin('');
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePinSubmit}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
