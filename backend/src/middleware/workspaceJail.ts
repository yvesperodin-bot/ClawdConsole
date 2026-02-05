import path from 'path';
import fs from 'fs';
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
 * - URL-encoded traversal attempts
 * - UNC paths (\\server\share)
 * - System directories
 * - Symbolic links pointing outside workspace
 */

/**
 * Decode URL-encoded characters in path
 * Detects attempts to bypass validation using %2e%2e etc.
 */
function decodePathSegments(inputPath: string): string {
  try {
    // Decode multiple times to catch double-encoding
    let decoded = inputPath;
    let prevDecoded = '';
    let iterations = 0;
    const MAX_ITERATIONS = 3;

    while (decoded !== prevDecoded && iterations < MAX_ITERATIONS) {
      prevDecoded = decoded;
      decoded = decodeURIComponent(decoded);
      iterations++;
    }
    return decoded;
  } catch {
    // If decoding fails, return original
    return inputPath;
  }
}

/**
 * Check if path is a UNC path (Windows network share)
 */
function isUNCPath(inputPath: string): boolean {
  // UNC paths start with \\ or //
  return /^(\\\\|\/\/)/.test(inputPath);
}

/**
 * Normalize path separators (convert backslashes to forward slashes)
 */
function normalizeSeparators(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

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

  // Step 1: Decode URL-encoded characters to catch bypass attempts
  const decodedPath = decodePathSegments(requestedPath);

  // Step 2: Check for UNC paths (network shares) - BLOCKED by default
  if (isUNCPath(decodedPath) || isUNCPath(requestedPath)) {
    logAudit('SECURITY', 'UNC_PATH_BLOCKED', `UNC/network path blocked: ${requestedPath}`, { requestedPath }, 'HIGH');
    return {
      allowed: false,
      reason: 'Network paths (UNC) are not allowed. Please use local paths within your workspace.'
    };
  }

  // Step 3: Normalize separators for cross-platform consistency
  const normalizedSeparators = normalizeSeparators(decodedPath);

  // Step 4: Check for path traversal in both original and decoded paths
  if (requestedPath.includes('..') || decodedPath.includes('..') || normalizedSeparators.includes('..')) {
    logAudit('SECURITY', 'PATH_TRAVERSAL_BLOCKED', `Path traversal attempt blocked: ${requestedPath}`, { requestedPath, decodedPath }, 'HIGH');
    return {
      allowed: false,
      reason: 'Path traversal is not allowed. Please use paths within your workspace.'
    };
  }

  // Step 5: Normalize the requested path
  let normalizedPath: string;

  try {
    // Handle both absolute and relative paths
    if (path.isAbsolute(decodedPath)) {
      normalizedPath = path.normalize(decodedPath);
    } else {
      normalizedPath = path.normalize(path.join(workspacePath, decodedPath));
    }
  } catch (error) {
    logAudit('SECURITY', 'PATH_VALIDATION_FAILED', `Invalid path format: ${requestedPath}`, { error: String(error) }, 'HIGH');
    return {
      allowed: false,
      reason: 'The path format is invalid. Please check the path and try again.'
    };
  }

  // Step 6: Check if path is within workspace using relative path check
  const relative = path.relative(workspacePath, normalizedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    logAudit('SECURITY', 'WORKSPACE_ESCAPE_BLOCKED', `Attempted access outside workspace: ${normalizedPath}`, { requestedPath, normalizedPath, workspacePath }, 'HIGH');
    return {
      allowed: false,
      reason: `This path is outside your workspace. Access is restricted to: ${workspacePath}`
    };
  }

  // Step 7: Resolve realpath to check for symlink escapes (if path exists)
  try {
    if (fs.existsSync(normalizedPath)) {
      const realPath = fs.realpathSync(normalizedPath);
      const realRelative = path.relative(workspacePath, realPath);

      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        logAudit('SECURITY', 'SYMLINK_ESCAPE_BLOCKED', `Symlink escape attempt blocked: ${normalizedPath} -> ${realPath}`, { requestedPath, normalizedPath, realPath, workspacePath }, 'HIGH');
        return {
          allowed: false,
          reason: 'This path links to a location outside your workspace. Symlink escapes are not allowed.'
        };
      }
    }
  } catch (error) {
    // If we can't resolve the realpath, the file may not exist yet (which is OK for write operations)
    // But log for awareness
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logAudit('SECURITY', 'REALPATH_CHECK_FAILED', `Could not verify realpath: ${normalizedPath}`, { error: String(error) }, 'MEDIUM');
    }
  }

  // Step 8: Check against blocked system directories
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

  // Step 9: Check against blocked file patterns
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
