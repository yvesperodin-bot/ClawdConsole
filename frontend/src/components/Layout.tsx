import { NavLink, Outlet } from 'react-router-dom';

/**
 * Main application layout
 * - Left sidebar with navigation
 * - Top header with status area
 * - Main content area renders child routes
 */
export default function Layout() {
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
              <span className="status-dot offline"></span>
              <span>ClawdBot</span>
            </div>
            <div className="status-indicator">
              <span className="status-dot online"></span>
              <span>Local Mode</span>
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
