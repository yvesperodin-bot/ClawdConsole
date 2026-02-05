import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../services/api';

/**
 * Approvals Page - Action approval panel
 * Shows pending actions requiring user approval before execution.
 */

interface PendingAction {
  id: string;
  action_type: string;
  target: string;
  summary: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  preview: string | null;
  created_at: string;
}

interface HistoryAction {
  id: string;
  action_type: string;
  target: string;
  summary: string;
  risk_level: string;
  status: string;
  result_summary: string | null;
  deny_reason: string | null;
  created_at: string;
  resolved_at: string;
}

export default function Approvals() {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);
  const [pinDialogAction, setPinDialogAction] = useState<PendingAction | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ summary: string; updatedFiles?: string[] } | null>(null);

  useEffect(() => {
    loadPendingActions();
    // Poll every 5 seconds for new actions
    const interval = setInterval(loadPendingActions, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadPendingActions() {
    const result = await apiGet<{ actions: PendingAction[] }>('/api/actions/pending');
    if (result.data) {
      setPendingActions(result.data.actions);
    }
    setLoading(false);
  }

  async function loadHistory() {
    const result = await apiGet<{ actions: HistoryAction[] }>('/api/actions/history?limit=50');
    if (result.data) {
      setHistory(result.data.actions);
    }
  }

  async function approveAction(id: string, adminPin?: string) {
    setProcessing(id);
    setPinError(null);

    const result = await apiPost<{
      success: boolean;
      requires_pin?: boolean;
      error?: string;
      message?: string;
      result?: { summary: string; updated_files?: string[] };
    }>(
      `/api/actions/${id}/approve`,
      adminPin ? { admin_pin: adminPin } : {}
    );

    // Check if PIN is required
    if (result.data?.requires_pin) {
      const action = pendingActions.find(a => a.id === id);
      if (action) {
        setPinDialogAction(action);
        setPinValue('');
      }
      setProcessing(null);
      return;
    }

    // Check for PIN error
    if (result.error?.includes('PIN') || result.error?.includes('Invalid')) {
      setPinError(result.error);
      setProcessing(null);
      return;
    }

    // Success - show result if available
    if (result.data?.success && result.data?.result) {
      setLastResult({
        summary: result.data.result.summary,
        updatedFiles: result.data.result.updated_files,
      });
    }

    // Close PIN dialog if open
    setPinDialogAction(null);
    setPinValue('');

    // Reload to get updated list
    await loadPendingActions();
    if (showHistory) await loadHistory();

    setProcessing(null);
    setSelectedAction(null);
  }

  async function handlePinSubmit() {
    if (!pinDialogAction || !pinValue.trim()) return;
    await approveAction(pinDialogAction.id, pinValue.trim());
  }

  function closePinDialog() {
    setPinDialogAction(null);
    setPinValue('');
    setPinError(null);
  }

  function dismissResult() {
    setLastResult(null);
  }

  async function denyAction(id: string) {
    setProcessing(id);
    const result = await apiPost<{ success: boolean }>(
      `/api/actions/${id}/deny`,
      {}
    );
    if (result.data?.success || result.error) {
      await loadPendingActions();
      if (showHistory) await loadHistory();
    }
    setProcessing(null);
    setSelectedAction(null);
  }

  function toggleHistory() {
    if (!showHistory) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  }

  function formatActionType(type: string): string {
    const typeMap: Record<string, string> = {
      FILE_READ: 'Read File',
      FILE_WRITE: 'Write File',
      FILE_DELETE: 'Delete File',
      COMMAND_EXECUTE: 'Run Command',
      NETWORK_REQUEST: 'Network Request',
    };
    return typeMap[type] || type;
  }

  function formatTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Approvals</h1>
        <div className="card">
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* PIN Dialog */}
      {pinDialogAction && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Admin PIN Required</h3>
            <p>
              Command execution requires your admin PIN for security.
            </p>
            <div className="dialog-action-summary">
              <strong>{formatActionType(pinDialogAction.action_type)}:</strong>{' '}
              {pinDialogAction.summary}
            </div>
            <div className="form-group">
              <label htmlFor="admin-pin">Admin PIN</label>
              <input
                type="password"
                id="admin-pin"
                value={pinValue}
                onChange={e => setPinValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                placeholder="Enter your admin PIN"
                autoFocus
              />
              {pinError && <div className="error-message">{pinError}</div>}
            </div>
            <div className="dialog-buttons">
              <button className="btn btn-secondary" onClick={closePinDialog}>
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handlePinSubmit}
                disabled={!pinValue.trim() || processing === pinDialogAction.id}
              >
                {processing === pinDialogAction.id ? 'Verifying...' : 'Approve with PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result notification */}
      {lastResult && (
        <div className="result-notification">
          <div className="result-content">
            <strong>Action completed:</strong> {lastResult.summary}
            {lastResult.updatedFiles && lastResult.updatedFiles.length > 0 && (
              <div className="result-files">
                Updated files: {lastResult.updatedFiles.join(', ')}
              </div>
            )}
          </div>
          <button className="btn btn-link btn-small" onClick={dismissResult}>
            Dismiss
          </button>
        </div>
      )}

      <div className="page-header-row">
        <h1 className="page-title">Approvals</h1>
        <button
          className="btn btn-secondary btn-small"
          onClick={toggleHistory}
        >
          {showHistory ? 'Hide History' : 'Show History'}
        </button>
      </div>

      <div className="approval-notice">
        <strong>Human-in-the-loop:</strong> All AI actions require your explicit approval before
        they run. Review each action carefully before approving.
      </div>

      {pendingActions.length === 0 ? (
        <div className="card">
          <div className="empty-approvals">
            <h3>No Pending Actions</h3>
            <p className="text-secondary">
              When the AI proposes actions (file changes, commands, etc.), they will appear here
              for your review before execution.
            </p>
          </div>
        </div>
      ) : (
        <div className="pending-actions">
          <h2 className="section-title">
            Pending Actions ({pendingActions.length})
          </h2>
          {pendingActions.map(action => (
            <div
              key={action.id}
              className={`action-card risk-${action.risk_level.toLowerCase()} ${selectedAction?.id === action.id ? 'expanded' : ''}`}
            >
              <div
                className="action-card-header"
                onClick={() => setSelectedAction(selectedAction?.id === action.id ? null : action)}
              >
                <div className="action-info">
                  <span className={`risk-indicator risk-${action.risk_level.toLowerCase()}`}>
                    {action.risk_level}
                  </span>
                  <span className="action-type-badge">
                    {formatActionType(action.action_type)}
                  </span>
                  <span className="action-summary-text">{action.summary}</span>
                </div>
                <span className="action-time">{formatTime(action.created_at)}</span>
              </div>

              {selectedAction?.id === action.id && (
                <div className="action-card-details">
                  <div className="action-detail">
                    <label>Target:</label>
                    <code>{action.target}</code>
                  </div>
                  {action.preview && (
                    <div className="action-detail">
                      <label>Preview:</label>
                      <pre className="action-preview-code">{action.preview}</pre>
                    </div>
                  )}
                  <div className="action-buttons">
                    <button
                      className="btn btn-danger"
                      onClick={() => denyAction(action.id)}
                      disabled={processing === action.id}
                    >
                      Deny
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={() => approveAction(action.id)}
                      disabled={processing === action.id}
                    >
                      {processing === action.id ? 'Processing...' : 'Approve'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showHistory && (
        <div className="action-history">
          <h2 className="section-title">Recent History</h2>
          {history.length === 0 ? (
            <div className="card">
              <p className="text-secondary">No action history yet.</p>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Summary</th>
                  <th>Result</th>
                  <th>Risk</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {history.map(action => (
                  <tr key={action.id} className={`status-${action.status.toLowerCase()}`}>
                    <td>
                      <span className={`status-badge status-${action.status.toLowerCase()}`}>
                        {action.status}
                      </span>
                    </td>
                    <td>{formatActionType(action.action_type)}</td>
                    <td className="summary-cell">{action.summary}</td>
                    <td className="result-cell">
                      {action.status === 'APPROVED' && action.result_summary && (
                        <span className="result-summary" title={action.result_summary}>
                          {action.result_summary.length > 30
                            ? action.result_summary.substring(0, 30) + '...'
                            : action.result_summary}
                        </span>
                      )}
                      {action.status === 'DENIED' && action.deny_reason && (
                        <span className="deny-reason" title={action.deny_reason}>
                          {action.deny_reason.length > 30
                            ? action.deny_reason.substring(0, 30) + '...'
                            : action.deny_reason}
                        </span>
                      )}
                      {!action.result_summary && !action.deny_reason && (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`risk-indicator-small risk-${action.risk_level.toLowerCase()}`}>
                        {action.risk_level}
                      </span>
                    </td>
                    <td>{formatTime(action.resolved_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
