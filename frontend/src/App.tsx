/**
 * Clawd Console - Main Application
 *
 * Local-first AI control interface.
 * Routes are defined here and rendered through the Layout component.
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Approvals from './pages/Approvals';
import Logs from './pages/Logs';
import Security from './pages/Security';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import SetupWizard from './pages/SetupWizard';
import { apiGet } from './services/api';

interface SetupState {
  setupComplete: boolean;
}

function App() {
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetup();
  }, []);

  async function checkSetup() {
    const result = await apiGet<SetupState>('/api/setup/state');
    if (result.data) {
      setSetupState(result.data);
    } else {
      // If we can't reach the backend, assume setup not complete
      setSetupState({ setupComplete: false });
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--color-bg, #f5f6f8)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Clawd Console</h1>
          <p style={{ color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Setup wizard route - always accessible */}
        <Route path="/setup" element={<SetupWizard />} />

        {/* Protected routes - redirect to setup if not complete */}
        <Route
          path="/"
          element={
            setupState?.setupComplete ? (
              <Layout />
            ) : (
              <Navigate to="/setup" replace />
            )
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="logs" element={<Logs />} />
          <Route path="security" element={<Security />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
