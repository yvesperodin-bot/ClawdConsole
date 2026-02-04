/**
 * Clawd Console - Main Application
 *
 * Local-first AI control interface.
 * Routes are defined here and rendered through the Layout component.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Approvals from './pages/Approvals';
import Logs from './pages/Logs';
import Security from './pages/Security';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
