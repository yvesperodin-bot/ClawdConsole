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
  supervisorEmail: str(process.env.SUPERVISOR_EMAIL),
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
config.mailConfigured = Boolean(
  config.supervisorEmail && config.smtp.host && config.mailFrom
);

/** Human-readable list of what still needs configuring. */
function missingSettings() {
  const missing = [];
  if (!config.accessCodeConfigured) missing.push('ACCESS_CODE');
  if (!config.sessionSecretProvided) missing.push('SESSION_SECRET');
  if (!config.supervisorEmail) missing.push('SUPERVISOR_EMAIL');
  if (!config.smtp.host) missing.push('SMTP_HOST');
  if (!config.mailFrom) missing.push('MAIL_FROM');
  return missing;
}

module.exports = { config, missingSettings };
