-- Clawd Console Database Schema
-- Local-only SQLite database for persistent state

-- App settings (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Setup wizard completion state
CREATE TABLE IF NOT EXISTS setup_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    workspace_path TEXT NOT NULL,
    security_profile TEXT NOT NULL DEFAULT 'AIR_GAPPED',
    admin_pin_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Security profiles configuration
CREATE TABLE IF NOT EXISTS security_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    allow_network INTEGER NOT NULL DEFAULT 0,
    allow_external_ai INTEGER NOT NULL DEFAULT 0,
    allow_system_access INTEGER NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- Insert default security profiles
INSERT OR IGNORE INTO security_profiles (id, name, description, allow_network, allow_external_ai, allow_system_access, risk_level) VALUES
    ('AIR_GAPPED', 'Air-Gapped', 'Complete isolation. No network access. Maximum security.', 0, 0, 0, 'LOW'),
    ('LOCAL_ONLY', 'Local Only', 'Access to local AI services only. No internet.', 0, 0, 0, 'LOW'),
    ('CONNECTED', 'Connected', 'Allow-list network access. External AI requires approval.', 1, 1, 0, 'MEDIUM'),
    ('POWER_USER', 'Power User', 'Full access with logging. For experienced users.', 1, 1, 1, 'HIGH');

-- Conversations (chat threads)
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Chat messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Proposed actions (require approval)
CREATE TABLE IF NOT EXISTS pending_actions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    action_type TEXT NOT NULL,
    target TEXT NOT NULL,
    summary TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    preview TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    resolved_at TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

-- Audit log (all actions and events)
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL,
    description TEXT NOT NULL,
    details TEXT,
    risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'INFO')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Network access attempts (logged even when blocked)
CREATE TABLE IF NOT EXISTS network_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destination TEXT NOT NULL,
    allowed INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON audit_log(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
