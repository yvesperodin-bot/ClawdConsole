/**
 * Shared TypeScript types for Clawd Console
 */

// Security profile identifiers
export type SecurityProfileId = 'AIR_GAPPED' | 'LOCAL_ONLY' | 'CONNECTED' | 'POWER_USER';

// Risk levels for actions
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Action status
export type ActionStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';

// Message roles
export type MessageRole = 'user' | 'assistant' | 'system';

// Setup state from backend
export interface SetupState {
  id: number;
  completed: boolean;
  completed_at: string | null;
  workspace_path: string;
  security_profile: SecurityProfileId;
  admin_pin_hash: string | null;
  created_at: string;
  updated_at: string;
}

// Security profile definition
export interface SecurityProfile {
  id: SecurityProfileId;
  name: string;
  description: string;
  allow_network: boolean;
  allow_external_ai: boolean;
  allow_system_access: boolean;
  risk_level: RiskLevel | 'CRITICAL';
}

// Dashboard status
export interface DashboardStatus {
  setup_completed: boolean;
  clawdbot_connected: boolean;
  network_enabled: boolean;
  security_profile: SecurityProfileId;
  workspace_path: string;
  pending_approvals: number;
  local_ai_available: boolean;
}

// Conversation
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// Chat message
export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

// Pending action requiring approval
export interface PendingAction {
  id: string;
  conversation_id: string | null;
  action_type: string;
  target: string;
  summary: string;
  risk_level: RiskLevel;
  preview: string | null;
  status: ActionStatus;
  created_at: string;
  resolved_at: string | null;
}

// Audit log entry
export interface AuditLogEntry {
  id: number;
  event_type: string;
  event_category: string;
  description: string;
  details: Record<string, unknown> | null;
  risk_level: RiskLevel | 'INFO' | null;
  created_at: string;
}
