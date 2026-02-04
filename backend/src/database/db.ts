import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file location (in backend directory)
const DB_PATH = path.join(__dirname, '..', '..', 'clawd_console.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  if (!db) return;

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  logAudit('SYSTEM', 'STARTUP', 'Database initialized', null, 'INFO');
}

// Setup state management
export interface SetupState {
  id: number;
  completed: boolean;
  completed_at: string | null;
  workspace_path: string;
  security_profile: string;
  admin_pin_hash: string | null;
  created_at: string;
  updated_at: string;
}

export function getSetupState(): SetupState | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM setup_state WHERE id = 1').get() as any;
  if (!row) return null;
  return {
    ...row,
    completed: Boolean(row.completed)
  };
}

export function createSetupState(workspacePath: string): SetupState {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO setup_state (id, workspace_path, completed)
    VALUES (1, ?, 0)
  `).run(workspacePath);

  logAudit('SETUP', 'CONFIGURATION', 'Setup state created', { workspacePath }, 'INFO');
  return getSetupState()!;
}

export function completeSetup(
  workspacePath: string,
  securityProfile: string,
  adminPinHash: string | null
): SetupState {
  const db = getDatabase();
  db.prepare(`
    UPDATE setup_state
    SET completed = 1,
        completed_at = datetime('now', 'localtime'),
        workspace_path = ?,
        security_profile = ?,
        admin_pin_hash = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run(workspacePath, securityProfile, adminPinHash);

  logAudit('SETUP', 'COMPLETED', 'Setup wizard completed', { workspacePath, securityProfile }, 'INFO');
  return getSetupState()!;
}

export function updateSecurityProfile(profile: string, adminPinHash?: string): void {
  const db = getDatabase();
  const currentState = getSetupState();

  db.prepare(`
    UPDATE setup_state
    SET security_profile = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run(profile);

  logAudit('SECURITY', 'PROFILE_CHANGE', `Security profile changed from ${currentState?.security_profile} to ${profile}`, {
    from: currentState?.security_profile,
    to: profile
  }, 'MEDIUM');
}

// Security profiles
export interface SecurityProfile {
  id: string;
  name: string;
  description: string;
  allow_network: boolean;
  allow_external_ai: boolean;
  allow_system_access: boolean;
  risk_level: string;
}

export function getSecurityProfiles(): SecurityProfile[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM security_profiles').all() as any[];
  return rows.map(row => ({
    ...row,
    allow_network: Boolean(row.allow_network),
    allow_external_ai: Boolean(row.allow_external_ai),
    allow_system_access: Boolean(row.allow_system_access)
  }));
}

export function getSecurityProfile(id: string): SecurityProfile | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM security_profiles WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    ...row,
    allow_network: Boolean(row.allow_network),
    allow_external_ai: Boolean(row.allow_external_ai),
    allow_system_access: Boolean(row.allow_system_access)
  };
}

// Conversations
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function createConversation(id: string, title: string): Conversation {
  const db = getDatabase();
  db.prepare('INSERT INTO conversations (id, title) VALUES (?, ?)').run(id, title);
  logAudit('CHAT', 'CONVERSATION_CREATED', `New conversation: ${title}`, { id }, 'INFO');
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation;
}

export function getConversations(): Conversation[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as Conversation[];
}

export function getConversation(id: string): Conversation | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | null;
}

// Messages
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export function addMessage(id: string, conversationId: string, role: string, content: string): Message {
  const db = getDatabase();
  db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(id, conversationId, role, content);
  db.prepare('UPDATE conversations SET updated_at = datetime("now", "localtime") WHERE id = ?').run(conversationId);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message;
}

export function getMessages(conversationId: string): Message[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId) as Message[];
}

// Pending Actions
export interface PendingAction {
  id: string;
  conversation_id: string | null;
  action_type: string;
  target: string;
  summary: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  preview: string | null;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  created_at: string;
  resolved_at: string | null;
}

export function createPendingAction(
  id: string,
  actionType: string,
  target: string,
  summary: string,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  preview: string | null,
  conversationId: string | null = null
): PendingAction {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO pending_actions (id, conversation_id, action_type, target, summary, risk_level, preview)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, conversationId, actionType, target, summary, riskLevel, preview);

  logAudit('ACTION', 'PROPOSED', summary, { id, actionType, target, riskLevel }, riskLevel);
  return db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id) as PendingAction;
}

export function getPendingActions(): PendingAction[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM pending_actions WHERE status = "PENDING" ORDER BY created_at DESC').all() as PendingAction[];
}

export function resolveAction(id: string, approved: boolean): PendingAction {
  const db = getDatabase();
  const status = approved ? 'APPROVED' : 'DENIED';

  db.prepare(`
    UPDATE pending_actions
    SET status = ?, resolved_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(status, id);

  const action = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id) as PendingAction;
  logAudit('ACTION', status, `Action ${status.toLowerCase()}: ${action.summary}`, { id, actionType: action.action_type }, action.risk_level);

  return action;
}

// Audit logging
export interface AuditLogEntry {
  id: number;
  event_type: string;
  event_category: string;
  description: string;
  details: string | null;
  risk_level: string | null;
  created_at: string;
}

export function logAudit(
  eventType: string,
  eventCategory: string,
  description: string,
  details: any | null,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'INFO' | null = 'INFO'
): void {
  const db = getDatabase();
  const detailsJson = details ? JSON.stringify(details) : null;

  db.prepare(`
    INSERT INTO audit_log (event_type, event_category, description, details, risk_level)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventType, eventCategory, description, detailsJson, riskLevel);
}

export function getAuditLog(
  limit: number = 100,
  category?: string,
  riskLevel?: string
): AuditLogEntry[] {
  const db = getDatabase();
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params: any[] = [];

  if (category) {
    query += ' AND event_category = ?';
    params.push(category);
  }

  if (riskLevel) {
    query += ' AND risk_level = ?';
    params.push(riskLevel);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params) as AuditLogEntry[];
}

// Network logging
export function logNetworkAttempt(destination: string, allowed: boolean, reason: string | null): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO network_log (destination, allowed, reason)
    VALUES (?, ?, ?)
  `).run(destination, allowed ? 1 : 0, reason);

  logAudit('NETWORK', allowed ? 'ALLOWED' : 'BLOCKED', `Network access ${allowed ? 'allowed' : 'blocked'}: ${destination}`, { destination, reason }, allowed ? 'INFO' : 'MEDIUM');
}

// Export audit log
export function exportAuditLog(format: 'json' | 'csv'): string {
  const logs = getAuditLog(10000);

  if (format === 'json') {
    return JSON.stringify(logs, null, 2);
  }

  // CSV format
  const headers = ['id', 'event_type', 'event_category', 'description', 'details', 'risk_level', 'created_at'];
  const rows = logs.map(log =>
    headers.map(h => {
      const value = log[h as keyof AuditLogEntry];
      if (value === null) return '';
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return String(value);
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// Close database on exit
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

process.on('exit', closeDatabase);
process.on('SIGINT', () => { closeDatabase(); process.exit(); });
process.on('SIGTERM', () => { closeDatabase(); process.exit(); });
