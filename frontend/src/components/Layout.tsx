import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { apiGet } from '../services/api';

interface StatusData {
  setup_required?: boolean;
  clawdbot?: {
    connected: boolean;
  };
  network?: {
    allowed: boolean;
  };
}

/**
 * Main application layout
 * - Left sidebar with navigation
 * - Top header with live status indicators
 * - Main content area renders child routes
 */
export default function Layout() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [serverOnline, setServerOnline] = useState(true);

  useEffect(() => {
    fetchStatus();
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    const result = await apiGet<StatusData>('/api/status');
    if (result.error) {
      setServerOnline(false);
    } else {
      setServerOnline(true);
      setStatus(result.data ?? null);
    }
  }

  const clawdbotConnected = status?.clawdbot?.connected ?? false;
  const networkEnabled = status?.network?.allowed ?? false;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Clawd Console</div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            <span className="nav-icon">◉</span>
            Dashboard
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">💬</span>
            Chat
          </NavLink>
          <NavLink to="/approvals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">✓</span>
            Approvals
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📋</span>
            Logs
          </NavLink>
          <NavLink to="/security" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🔒</span>
            Security
          </NavLink>
          <NavLink to="/integrations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🔌</span>
            Integrations
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙</span>
            Settings
          </NavLink>
        </nav>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Header */}
        <header className="header">
          <h1 className="header-title">Clawd Console</h1>
          <div className="header-status">
            <div className="status-indicator">
              <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`}></span>
              <span>Server</span>
            </div>
            <div className="status-indicator">
              <span className={`status-dot ${clawdbotConnected ? 'online' : 'offline'}`}></span>
              <span>ClawdBot</span>
            </div>
            <div className="status-indicator">
              <span className={`status-dot ${networkEnabled ? 'online' : ''}`} style={!networkEnabled ? { backgroundColor: 'var(--color-text-muted)' } : {}}></span>
              <span>{networkEnabled ? 'Network ON' : 'Local Only'}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
