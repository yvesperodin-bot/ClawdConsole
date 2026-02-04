import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';

/**
 * Logs Page - Audit trail viewer
 */

interface LogEntry {
  id: number;
  event_type: string;
  event_category: string;
  description: string;
  details: Record<string, unknown> | null;
  risk_level: string | null;
  created_at: string;
}

interface LogStats {
  total: number;
  by_category: Array<{ event_category: string; count: number }>;
  by_risk_level: Array<{ risk_level: string; count: number }>;
  alerts_24h: number;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    loadCategories();
    loadStats();
    loadLogs();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [selectedCategory, selectedRiskLevel]);

  async function loadCategories() {
    const result = await apiGet<{ categories: string[] }>('/api/logs/categories');
    if (result.data) {
      setCategories(result.data.categories);
    }
  }

  async function loadStats() {
    const result = await apiGet<LogStats>('/api/logs/stats');
    if (result.data) {
      setStats(result.data);
    }
  }

  async function loadLogs() {
    setLoading(true);
    let url = '/api/logs?limit=200';
    if (selectedCategory) {
      url += `&category=${encodeURIComponent(selectedCategory)}`;
    }
    if (selectedRiskLevel) {
      url += `&risk_level=${encodeURIComponent(selectedRiskLevel)}`;
    }

    const result = await apiGet<{ logs: LogEntry[] }>(url);
    if (result.data) {
      setLogs(result.data.logs);
    }
    setLoading(false);
  }

  function exportLogs(format: 'json' | 'csv') {
    // Open export URL in new tab/window to trigger download
    window.open(`/api/logs/export?format=${format}`, '_blank');
  }

  function formatTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  }

  function getRiskClass(riskLevel: string | null): string {
    if (!riskLevel) return '';
    return `risk-${riskLevel.toLowerCase()}`;
  }

  return (
    <div>
      <div className="page-header-row">
        <h1 className="page-title">Logs</h1>
        <div className="export-buttons">
          <button className="btn btn-secondary btn-small" onClick={() => exportLogs('json')}>
            Export JSON
          </button>
          <button className="btn btn-secondary btn-small" onClick={() => exportLogs('csv')}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="logs-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Events</div>
          </div>
          <div className="stat-card stat-warning">
            <div className="stat-value">{stats.alerts_24h}</div>
            <div className="stat-label">Alerts (24h)</div>
          </div>
          {stats.by_risk_level.filter(r => r.risk_level === 'HIGH').map(r => (
            <div key={r.risk_level} className="stat-card stat-danger">
              <div className="stat-value">{r.count}</div>
              <div className="stat-label">High Risk</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="log-filters card">
        <div className="filter-group">
          <label>Category</label>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Risk Level</label>
          <select
            value={selectedRiskLevel}
            onChange={e => setSelectedRiskLevel(e.target.value)}
          >
            <option value="">All Levels</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>
        </div>

        <button
          className="btn btn-secondary btn-small"
          onClick={() => {
            setSelectedCategory('');
            setSelectedRiskLevel('');
          }}
        >
          Clear Filters
        </button>
      </div>

      {/* Log entries */}
      <div className="log-entries">
        {loading ? (
          <div className="card">
            <p className="text-secondary">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="card">
            <p className="text-secondary">No log entries found.</p>
          </div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Category</th>
                <th>Event</th>
                <th>Description</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <>
                  <tr
                    key={log.id}
                    className={`log-row ${expandedLog === log.id ? 'expanded' : ''} ${getRiskClass(log.risk_level)}`}
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <td className="log-time">{formatTime(log.created_at)}</td>
                    <td>
                      <span className="category-badge">{log.event_category}</span>
                    </td>
                    <td className="log-event">{log.event_type}</td>
                    <td className="log-description">{log.description}</td>
                    <td>
                      {log.risk_level && (
                        <span className={`risk-indicator-small ${getRiskClass(log.risk_level)}`}>
                          {log.risk_level}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedLog === log.id && log.details && (
                    <tr key={`${log.id}-details`} className="log-details-row">
                      <td colSpan={5}>
                        <div className="log-details">
                          <strong>Details:</strong>
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="log-footer text-muted">
        Showing {logs.length} entries. All events are logged locally for your privacy.
      </div>
    </div>
  );
}
