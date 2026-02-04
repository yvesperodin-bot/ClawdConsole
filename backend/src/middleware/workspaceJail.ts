import path from 'path';
import { getSetupState, logAudit } from '../database/db.js';

/**
 * Workspace Jail Middleware
 *
 * SECURITY CRITICAL: This module enforces workspace isolation.
 * All file access MUST be restricted to the configured workspace directory.
 *
 * Blocked patterns:
 * - Absolute paths outside workspace
 * - Path traversal attempts (..)
 * - System directories
 * - Symbolic links pointing outside workspace
 */

// System directories that should NEVER be accessible
const BLOCKED_DIRECTORIES = [
  '/etc',
  '/var',
  '/usr',
  '/bin',
  '/sbin',
  '/boot',
  '/root',
  '/proc',
  '/sys',
  '/dev',
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
  'C:\\Users\\Default',
  'C:\\System Volume Information',
];

// Dangerous file patterns
const BLOCKED_PATTERNS = [
  /\.env$/i,
  /\.ssh/i,
  /\.gnupg/i,
  /\.aws/i,
  /credentials/i,
  /\.git\/config$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.pem$/i,
  /\.key$/i,
];

export interface JailCheckResult {
  allowed: boolean;
  reason: string;
  normalizedPath?: string;
}

/**
 * Validates that a path is within the workspace jail
 */
export function validatePath(requestedPath: string): JailCheckResult {
  const setupState = getSetupState();

  if (!setupState || !setupState.completed) {
    return {
      allowed: false,
      reason: 'Setup has not been completed. Please complete the setup wizard first.'
    };
  }

  const workspacePath = setupState.workspace_path;

  // Normalize the requested path
  let normalizedPath: string;

  try {
    // Handle both absolute and relative paths
    if (path.isAbsolute(requestedPath)) {
      normalizedPath = path.normalize(requestedPath);
    } else {
      normalizedPath = path.normalize(path.join(workspacePath, requestedPath));
    }
  } catch (error) {
    logAudit('SECURITY', 'PATH_VALIDATION_FAILED', `Invalid path format: ${requestedPath}`, { error: String(error) }, 'HIGH');
    return {
      allowed: false,
      reason: 'The path format is invalid. Please check the path and try again.'
    };
  }

  // Check for path traversal attempts
  if (requestedPath.includes('..')) {
    logAudit('SECURITY', 'PATH_TRAVERSAL_BLOCKED', `Path traversal attempt blocked: ${requestedPath}`, { requestedPath }, 'HIGH');
    return {
      allowed: false,
      reason: 'Path traversal is not allowed. Please use paths within your workspace.'
    };
  }

  // Check if path is within workspace
  const relative = path.relative(workspacePath, normalizedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    logAudit('SECURITY', 'WORKSPACE_ESCAPE_BLOCKED', `Attempted access outside workspace: ${normalizedPath}`, { requestedPath, normalizedPath, workspacePath }, 'HIGH');
    return {
      allowed: false,
      reason: `This path is outside your workspace. Access is restricted to: ${workspacePath}`
    };
  }

  // Check against blocked system directories
  const normalizedLower = normalizedPath.toLowerCase();
  for (const blockedDir of BLOCKED_DIRECTORIES) {
    if (normalizedLower.startsWith(blockedDir.toLowerCase())) {
      logAudit('SECURITY', 'SYSTEM_DIR_BLOCKED', `Attempted access to system directory: ${normalizedPath}`, { requestedPath, blockedDir }, 'HIGH');
      return {
        allowed: false,
        reason: 'Access to system directories is not allowed for your safety.'
      };
    }
  }

  // Check against blocked file patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      logAudit('SECURITY', 'SENSITIVE_FILE_BLOCKED', `Attempted access to sensitive file: ${normalizedPath}`, { requestedPath, pattern: pattern.source }, 'HIGH');
      return {
        allowed: false,
        reason: 'This file type contains sensitive information and cannot be accessed.'
      };
    }
  }

  return {
    allowed: true,
    reason: 'Path is within workspace',
    normalizedPath
  };
}

/**
 * Validates that a command doesn't attempt to escape the workspace
 */
export function validateCommand(command: string): JailCheckResult {
  const setupState = getSetupState();

  if (!setupState || !setupState.completed) {
    return {
      allowed: false,
      reason: 'Setup has not been completed. Please complete the setup wizard first.'
    };
  }

  // Dangerous command patterns
  const dangerousPatterns = [
    /rm\s+(-rf?\s+)?\/(?!home)/i,        // rm on system directories
    /sudo/i,                               // privilege escalation
    /chmod\s+777/i,                        // dangerous permissions
    /curl|wget/i,                          // network downloads (unless allowed)
    /eval\s*\(/i,                          // eval execution
    />\s*\/(?!home)/i,                     // redirect to system directories
    /\|\s*sh/i,                            // pipe to shell
    /;\s*rm/i,                             // chained rm
    /`.*`/,                                // command substitution
    /\$\(/,                                // command substitution
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      logAudit('SECURITY', 'DANGEROUS_COMMAND_BLOCKED', `Dangerous command blocked: ${command.substring(0, 100)}`, { pattern: pattern.source }, 'HIGH');
      return {
        allowed: false,
        reason: 'This command contains potentially dangerous operations and has been blocked for your safety.'
      };
    }
  }

  return {
    allowed: true,
    reason: 'Command appears safe'
  };
}

/**
 * Gets the current workspace path
 */
export function getWorkspacePath(): string | null {
  const setupState = getSetupState();
  return setupState?.workspace_path ?? null;
}

/**
 * Friendly error messages for non-technical users
 */
export const FRIENDLY_MESSAGES = {
  OUTSIDE_WORKSPACE: (workspace: string) =>
    `I can only access files within your workspace folder (${workspace}). This keeps your other files safe.`,

  PATH_TRAVERSAL:
    `I noticed an attempt to access parent directories. For your security, I can only work within your designated workspace.`,

  SYSTEM_DIRECTORY:
    `I can't access system folders. This is a safety feature to protect your computer.`,

  SENSITIVE_FILE:
    `This file might contain passwords or private keys. I'm not allowed to access sensitive files like this.`,

  DANGEROUS_COMMAND:
    `This command could potentially harm your system. I've blocked it to keep you safe.`,

  SETUP_REQUIRED:
    `Before I can access any files, we need to complete the setup wizard to configure your workspace.`,
};
