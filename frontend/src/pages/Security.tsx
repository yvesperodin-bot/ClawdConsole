import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../services/api';

/**
 * Security Page - Security profiles management
 */

interface SecurityProfile {
  id: string;
  name: string;
  description: string;
  allow_network: boolean;
  allow_external_ai: boolean;
  allow_system_access: boolean;
  risk_level: string;
  is_current: boolean;
}

interface CurrentProfile {
  profile: SecurityProfile;
  has_admin_pin: boolean;
  warnings: string[];
}

interface SecurityReport {
  generated_at: string;
  profile: {
    id: string;
    name: string;
    risk_level: string;
    permissions: {
      network_access: boolean;
      external_ai: boolean;
      system_access: boolean;
    };
  };
  workspace: { path: string; enforced: boolean };
  authentication: { admin_pin_enabled: boolean };
  allowlists: { domains: string[] };
  statistics: {
    pending_approvals: number;
    last_24h: {
      approved_actions: number;
      denied_actions: number;
      security_violations: number;
    };
  };
  recent_security_events: Array<{
    type: string;
    description: string;
    time: string;
  }>;
  warnings: string[];
  compliance: {
    offline_mode: boolean;
    localhost_only: boolean;
    human_in_loop: boolean;
    audit_trail: boolean;
  };
}

export default function Security() {
  const [profiles, setProfiles] = useState<SecurityProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState<string[]>([]);
  const [adminPin, setAdminPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    loadProfiles();
    loadCurrentProfile();
  }, []);

  async function loadProfiles() {
    const result = await apiGet<{ profiles: SecurityProfile[] }>('/api/security/profiles');
    if (result.data) {
      setProfiles(result.data.profiles);
    }
    setLoading(false);
  }

  async function loadCurrentProfile() {
    const result = await apiGet<CurrentProfile>('/api/security/current');
    if (result.data) {
      setCurrentProfile(result.data);
    }
  }

  async function changeProfile(profileId: string, pin?: string, confirmed?: boolean) {
    setProcessing(true);
    setError(null);

    const result = await apiPost<{
      success?: boolean;
      error?: string;
      requires_pin?: boolean;
      requires_confirmation?: boolean;
      warnings?: string[];
      message?: string;
    }>('/api/security/profile', {
      profile_id: profileId,
      admin_pin: pin,
      confirm: confirmed,
    });

    if (result.data?.requires_pin) {
      setSelectedProfile(profileId);
      setShowPinDialog(true);
      setProcessing(false);
      return;
    }

    if (result.data?.requires_confirmation) {
      setSelectedProfile(profileId);
      setConfirmWarnings(result.data.warnings || []);
      setShowConfirmDialog(true);
      setProcessing(false);
      return;
    }

    if (result.data?.success) {
      await loadProfiles();
      await loadCurrentProfile();
      resetDialogs();
    } else {
      setError(result.data?.message || result.error || 'Failed to change profile');
    }

    setProcessing(false);
  }

  function resetDialogs() {
    setShowPinDialog(false);
    setShowConfirmDialog(false);
    setAdminPin('');
    setSelectedProfile(null);
    setConfirmWarnings([]);
    setError(null);
  }

  async function handlePinSubmit() {
    if (!adminPin || !selectedProfile) {
      setError('Please enter your admin PIN');
      return;
    }
    await changeProfile(selectedProfile, adminPin, true);
  }

  async function handleConfirm() {
    if (!selectedProfile) return;
    // If PIN required and not yet provided, show PIN dialog
    if (currentProfile?.has_admin_pin && !adminPin) {
      setShowConfirmDialog(false);
      setShowPinDialog(true);
      return;
    }
    await changeProfile(selectedProfile, adminPin, true);
  }

  function getRiskClass(riskLevel: string): string {
    const level = riskLevel.toLowerCase();
    if (level === 'critical') return 'high';
    return level;
  }

  async function loadReport() {
    setLoadingReport(true);
    const result = await apiGet<{ report: SecurityReport }>('/api/security/report');
    if (result.data) {
      setReport(result.data.report);
      setShowReportDialog(true);
    }
    setLoadingReport(false);
  }

  function exportReportJSON() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatReportTime(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Security Profiles</h1>
        <div className="card">
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Security Profiles</h1>

      {/* Current profile display */}
      {currentProfile && (
        <div className="card current-profile-card">
          <div className="current-profile-header">
            <h2 className="card-title">Current Profile</h2>
            <span className={`risk-badge risk-${getRiskClass(currentProfile.profile.risk_level)}`}>
              {currentProfile.profile.risk_level} RISK
            </span>
          </div>
          <div className="current-profile-name">{currentProfile.profile.name}</div>
          <p className="text-secondary">{currentProfile.profile.description}</p>

          <div className="profile-permissions">
            <PermissionItem
              label="Network Access"
              allowed={currentProfile.profile.allow_network}
            />
            <PermissionItem
              label="External AI"
              allowed={currentProfile.profile.allow_external_ai}
            />
            <PermissionItem
              label="System Access"
              allowed={currentProfile.profile.allow_system_access}
            />
          </div>

          {currentProfile.warnings.length > 0 && (
            <div className="profile-warnings">
              {currentProfile.warnings.map((warning, i) => (
                <div key={i} className="warning-item">{warning}</div>
              ))}
            </div>
          )}

          <div className="pin-status">
            {currentProfile.has_admin_pin ? (
              <span className="pin-enabled">Admin PIN enabled - profile changes are protected</span>
            ) : (
              <span className="pin-disabled">No admin PIN - consider adding one in Settings</span>
            )}
          </div>

          <div className="card-actions" style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-secondary"
              onClick={loadReport}
              disabled={loadingReport}
            >
              {loadingReport ? 'Loading...' : 'View Security Posture Report'}
            </button>
          </div>
        </div>
      )}

      {/* Available profiles */}
      <h2 className="section-title">Available Profiles</h2>
      <p className="text-secondary" style={{ marginBottom: 'var(--spacing-md)' }}>
        Select a different profile to change your security settings. Changes take effect immediately.
      </p>

      <div className="security-profiles-grid">
        {profiles.map(profile => (
          <div
            key={profile.id}
            className={`security-profile-card ${profile.is_current ? 'current' : ''}`}
          >
            <div className="profile-card-header">
              <h3>{profile.name}</h3>
              <span className={`risk-indicator risk-${getRiskClass(profile.risk_level)}`}>
                {profile.risk_level}
              </span>
            </div>
            <p className="profile-card-description">{profile.description}</p>

            <div className="profile-card-features">
              <div className={`feature-indicator ${profile.allow_network ? 'allowed' : 'blocked'}`}>
                {profile.allow_network ? 'Network: On' : 'Network: Off'}
              </div>
              <div className={`feature-indicator ${profile.allow_external_ai ? 'allowed' : 'blocked'}`}>
                {profile.allow_external_ai ? 'External AI: On' : 'External AI: Off'}
              </div>
            </div>

            {profile.is_current ? (
              <div className="profile-current-badge">Current Profile</div>
            ) : (
              <button
                className="btn btn-secondary btn-full"
                onClick={() => changeProfile(profile.id)}
                disabled={processing}
              >
                Switch to {profile.name}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* PIN Dialog */}
      {showPinDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Admin PIN Required</h3>
            <p>Enter your admin PIN to change security profile.</p>
            <div className="form-group">
              <input
                type="password"
                value={adminPin}
                onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter PIN"
                maxLength={8}
                autoFocus
              />
            </div>
            {error && <div className="validation-message invalid">{error}</div>}
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={resetDialogs}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePinSubmit}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="dialog-overlay">
          <div className="dialog dialog-wide">
            <h3>Confirm Profile Change</h3>
            <p>You are switching to a higher risk profile. Please review the warnings below:</p>
            <div className="confirm-warnings">
              {confirmWarnings.map((warning, i) => (
                <div key={i} className="warning-item">{warning}</div>
              ))}
            </div>
            {error && <div className="validation-message invalid">{error}</div>}
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={resetDialogs}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirm}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'I Understand, Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Report Dialog */}
      {showReportDialog && report && (
        <div className="dialog-overlay">
          <div className="dialog dialog-report">
            <div className="report-header">
              <h3>Security Posture Report</h3>
              <span className="report-time">Generated: {formatReportTime(report.generated_at)}</span>
            </div>

            <div className="report-section">
              <h4>Profile</h4>
              <div className="report-grid">
                <div className="report-item">
                  <span className="report-label">Active Profile</span>
                  <span className="report-value">{report.profile.name}</span>
                </div>
                <div className="report-item">
                  <span className="report-label">Risk Level</span>
                  <span className={`report-value risk-indicator risk-${getRiskClass(report.profile.risk_level)}`}>
                    {report.profile.risk_level}
                  </span>
                </div>
              </div>
            </div>

            <div className="report-section">
              <h4>Permissions</h4>
              <div className="report-permissions">
                <div className={`report-permission ${report.profile.permissions.network_access ? 'allowed' : 'blocked'}`}>
                  Network: {report.profile.permissions.network_access ? 'Allowed' : 'Blocked'}
                </div>
                <div className={`report-permission ${report.profile.permissions.external_ai ? 'allowed' : 'blocked'}`}>
                  External AI: {report.profile.permissions.external_ai ? 'Allowed' : 'Blocked'}
                </div>
                <div className={`report-permission ${report.profile.permissions.system_access ? 'allowed' : 'blocked'}`}>
                  System Access: {report.profile.permissions.system_access ? 'Allowed' : 'Blocked'}
                </div>
              </div>
            </div>

            <div className="report-section">
              <h4>Configuration</h4>
              <div className="report-grid">
                <div className="report-item">
                  <span className="report-label">Workspace</span>
                  <code className="report-value">{report.workspace.path}</code>
                </div>
                <div className="report-item">
                  <span className="report-label">Admin PIN</span>
                  <span className="report-value">{report.authentication.admin_pin_enabled ? 'Enabled' : 'Not Set'}</span>
                </div>
              </div>
            </div>

            <div className="report-section">
              <h4>Statistics (Last 24 Hours)</h4>
              <div className="report-stats">
                <div className="report-stat">
                  <span className="stat-number">{report.statistics.pending_approvals}</span>
                  <span className="stat-label">Pending</span>
                </div>
                <div className="report-stat">
                  <span className="stat-number success">{report.statistics.last_24h.approved_actions}</span>
                  <span className="stat-label">Approved</span>
                </div>
                <div className="report-stat">
                  <span className="stat-number warning">{report.statistics.last_24h.denied_actions}</span>
                  <span className="stat-label">Denied</span>
                </div>
                <div className="report-stat">
                  <span className="stat-number danger">{report.statistics.last_24h.security_violations}</span>
                  <span className="stat-label">Violations</span>
                </div>
              </div>
            </div>

            <div className="report-section">
              <h4>Compliance</h4>
              <div className="report-compliance">
                <div className={`compliance-item ${report.compliance.offline_mode ? 'pass' : 'warn'}`}>
                  {report.compliance.offline_mode ? '✓' : '!'} Offline Mode
                </div>
                <div className="compliance-item pass">✓ Localhost Only</div>
                <div className="compliance-item pass">✓ Human-in-the-Loop</div>
                <div className="compliance-item pass">✓ Audit Trail</div>
              </div>
            </div>

            {report.warnings.length > 0 && (
              <div className="report-section">
                <h4>Warnings</h4>
                <div className="report-warnings">
                  {report.warnings.map((w, i) => (
                    <div key={i} className="warning-item">{w}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={exportReportJSON}>
                Export JSON
              </button>
              <button className="btn btn-primary" onClick={() => setShowReportDialog(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionItem({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <div className={`permission-item ${allowed ? 'allowed' : 'blocked'}`}>
      <span className="permission-icon">{allowed ? '✓' : '✗'}</span>
      <span className="permission-label">{label}</span>
      <span className="permission-status">{allowed ? 'Allowed' : 'Blocked'}</span>
    </div>
  );
}
