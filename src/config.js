'use strict';

const crypto = require('crypto');

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function int(value, fallback) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(value) {
  const s = String(value ?? '').trim();
  return s === '' ? '' : s;
}

function list(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const config = {
  port: int(process.env.PORT, 3000),
  // Behind a proxy/load balancer set TRUST_PROXY=true so rate limiting sees
  // the real client IP instead of the proxy's.
  trustProxy: bool(process.env.TRUST_PROXY, false),

  // --- Access control -----------------------------------------------------
  accessCode: str(process.env.ACCESS_CODE),
  sessionSecret: str(process.env.SESSION_SECRET) || crypto.randomBytes(32).toString('hex'),
  sessionHours: int(process.env.SESSION_HOURS, 12),
  cookieSecure: bool(process.env.COOKIE_SECURE, false),

  // --- Mail ---------------------------------------------------------------
  // The designated supervisor. Set by an administrator; team leaders never
  // see or choose a recipient.
  supervisorEmail: str(process.env.SUPERVISOR_EMAIL),
  supervisorName: str(process.env.SUPERVISOR_NAME),
  // Addresses reports are permitted to go to. When set, SUPERVISOR_EMAIL must
  // be one of them or the server refuses to send. This keeps a typo, or an
  // edit nobody reviewed, from quietly redirecting reports, and it is how an
  // address stays out of live sending until its owner has confirmed it.
  supervisorAllowlist: list(process.env.SUPERVISOR_ALLOWLIST),
  mailFrom: str(process.env.MAIL_FROM),
  mailCc: str(process.env.MAIL_CC),
  smtp: {
    host: str(process.env.SMTP_HOST),
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: str(process.env.SMTP_USER),
    pass: str(process.env.SMTP_PASS),
  },

  // --- Abuse limits -------------------------------------------------------
  maxReportsPerHour: int(process.env.MAX_REPORTS_PER_HOUR, 12),
  maxLoginAttempts: int(process.env.MAX_LOGIN_ATTEMPTS, 10),

  orgName: str(process.env.ORG_NAME) || 'Safe Haven',
  timezone: str(process.env.REPORT_TIMEZONE) || 'UTC',
};

config.sessionSecretProvided = str(process.env.SESSION_SECRET) !== '';
config.accessCodeConfigured = config.accessCode !== '';

// An allowlist, when present, is authoritative: the designated supervisor must
// be on it.
config.recipientAllowed =
  config.supervisorAllowlist.length === 0 ||
  config.supervisorAllowlist.includes(config.supervisorEmail.toLowerCase());

config.mailConfigured = Boolean(
  config.supervisorEmail && config.smtp.host && config.mailFrom && config.recipientAllowed
);

/** Why sending is unavailable, or '' when it is available. */
config.mailBlockedReason = (() => {
  if (config.mailConfigured) return '';
  if (config.supervisorEmail && !config.recipientAllowed) {
    return `SUPERVISOR_EMAIL (${config.supervisorEmail}) is not in SUPERVISOR_ALLOWLIST, so reports will not be sent. Add it to the allowlist once the recipient has confirmed the address.`;
  }
  return 'Mail is not configured.';
})();

/** The To header: "Name <address>" when a name is configured. */
config.supervisorRecipient = config.supervisorName
  ? `${config.supervisorName} <${config.supervisorEmail}>`
  : config.supervisorEmail;

/** Human-readable list of what still needs configuring. */
function missingSettings() {
  const missing = [];
  if (!config.accessCodeConfigured) missing.push('ACCESS_CODE');
  if (!config.sessionSecretProvided) missing.push('SESSION_SECRET');
  if (!config.supervisorEmail) missing.push('SUPERVISOR_EMAIL');
  if (!config.smtp.host) missing.push('SMTP_HOST');
  if (!config.mailFrom) missing.push('MAIL_FROM');
  if (config.supervisorEmail && !config.recipientAllowed) {
    missing.push('SUPERVISOR_ALLOWLIST (does not include SUPERVISOR_EMAIL)');
  }
  return missing;
}

module.exports = { config, missingSettings };
