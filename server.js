'use strict';

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const { config, missingSettings } = require('./src/config');
const { TOPICS, REFLECTION_PROMPT, getTopic } = require('./src/topics');
const { renderReportPdf } = require('./src/pdf');
const { sendReportEmail } = require('./src/mailer');
const store = require('./src/store');

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', true);

const PUBLIC_DIR = path.join(__dirname, 'public');
const COOKIE_NAME = 'sh_session';
const MAX_FIELD = 200;
const MAX_RESPONSE = 6000;

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  // Per-request nonce so the bootstrap <script> in index.html can stay inline
  // while the policy remains strict (no 'unsafe-inline').
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "style-src 'self'",
      `script-src 'self' 'nonce-${res.locals.cspNonce}'`,
      "img-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
    ].join('; ')
  );
  next();
});

app.use(express.json({ limit: '256kb' }));

// ---------------------------------------------------------------------------
// Rate limiting (in-memory sliding window, keyed by client IP)
// ---------------------------------------------------------------------------
const buckets = new Map();

function rateLimit({ key, limit, windowMs }) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const id = `${key}:${ip}`;
    const now = Date.now();
    const hits = (buckets.get(id) || []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        ok: false,
        error: 'Too many attempts. Please wait a few minutes and try again.',
        retryAfter,
      });
    }
    hits.push(now);
    buckets.set(id, hits);
    next();
  };
}

// Housekeeping so the maps do not grow without bound.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, hits] of buckets) {
    const kept = hits.filter((t) => t > cutoff);
    if (kept.length === 0) buckets.delete(id);
    else buckets.set(id, kept);
  }
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Session cookie (HMAC-signed, httpOnly). No external session store needed.
// ---------------------------------------------------------------------------
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.', 2);
  const expected = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function isAuthenticated(req) {
  // With no ACCESS_CODE configured the form is locked, not open: an
  // unconfigured deployment must not sit on the internet accepting reports.
  if (!config.accessCodeConfigured) return false;
  return verify(readCookie(req, COOKIE_NAME)) !== null;
}

function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false, error: 'Sign in again to continue.', reauth: true });
  }
  next();
}

// A custom header cannot be sent cross-origin without a CORS preflight, which
// this server never grants — together with SameSite=Strict this blocks CSRF.
function requireSameOrigin(req, res, next) {
  if (req.get('X-Safe-Haven') !== '1') {
    return res.status(403).json({ ok: false, error: 'Request rejected.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Page + static assets
// ---------------------------------------------------------------------------
const indexTemplate = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

app.get(['/', '/index.html'], (req, res) => {
  const bootstrap = JSON.stringify({
    topics: TOPICS,
    reflectionPrompt: REFLECTION_PROMPT,
    orgName: config.orgName,
  }).replace(/</g, '\\u003c');
  const injected = indexTemplate
    .replace('__CSP_NONCE__', res.locals.cspNonce)
    .replace('/*__SAFE_HAVEN_BOOTSTRAP__*/', `window.SAFE_HAVEN = ${bootstrap};`);
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(injected);
});

app.use(
  express.static(PUBLIC_DIR, {
    index: false,
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  })
);

// ---------------------------------------------------------------------------
// Session endpoints
// ---------------------------------------------------------------------------
app.get('/api/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    authenticated: isAuthenticated(req),
    accessCodeConfigured: config.accessCodeConfigured,
    mailConfigured: config.mailConfigured,
  });
});

app.post(
  '/api/login',
  requireSameOrigin,
  rateLimit({ key: 'login', limit: config.maxLoginAttempts, windowMs: 15 * 60 * 1000 }),
  (req, res) => {
    if (!config.accessCodeConfigured) {
      return res.status(503).json({
        ok: false,
        error:
          'This dashboard is not configured yet. An administrator must set ACCESS_CODE on the server.',
      });
    }

    const supplied = String(req.body?.accessCode ?? '');
    const a = crypto.createHash('sha256').update(supplied).digest();
    const b = crypto.createHash('sha256').update(config.accessCode).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ ok: false, error: 'That access code is not recognized.' });
    }

    const maxAgeMs = config.sessionHours * 60 * 60 * 1000;
    const token = sign({ exp: Date.now() + maxAgeMs });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.cookieSecure,
      maxAge: maxAgeMs,
      path: '/',
    });
    res.json({ ok: true, mailConfigured: config.mailConfigured });
  }
);

app.post('/api/logout', requireSameOrigin, (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function validate(body) {
  const errors = {};

  const teamLeaderName = cleanText(body?.teamLeaderName, MAX_FIELD);
  if (!teamLeaderName) errors.teamLeaderName = 'Enter the team leader’s name.';

  const workDate = cleanText(body?.workDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    errors.workDate = 'Choose a work date.';
  } else {
    const [y, m, d] = workDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== m - 1 ||
      dt.getUTCDate() !== d
    ) {
      errors.workDate = 'That date is not valid.';
    }
  }

  const jobLocation = cleanText(body?.jobLocation, MAX_FIELD); // optional

  const topic = getTopic(cleanText(body?.topicId, 64));
  if (!topic) errors.topicId = 'Open a topic and answer its three questions.';

  const responses = [];
  if (topic) {
    const supplied = Array.isArray(body?.responses) ? body.responses : [];
    topic.questions.forEach((question, i) => {
      const response = cleanText(supplied[i], MAX_RESPONSE);
      if (!response) errors[`response${i}`] = `Answer question ${i + 1}.`;
      responses.push({ question, response });
    });
  }

  const submissionId = cleanText(body?.submissionId, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(submissionId)) {
    errors.submissionId = 'Reload the page and try again.';
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0,
    value: { teamLeaderName, workDate, jobLocation, topic, responses, submissionId },
  };
}

function formatWorkDate(workDate) {
  const [y, m, d] = workDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTimestamp(date) {
  try {
    return `${date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: config.timezone,
    })} (${config.timezone})`;
  } catch {
    return `${date.toISOString()} (UTC)`;
  }
}

function makeReportId(workDate) {
  const compact = workDate.replace(/-/g, '');
  return `SH-${compact}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Submit: validate -> PDF -> email
// ---------------------------------------------------------------------------
app.post(
  '/api/report',
  requireSameOrigin,
  requireAuth,
  rateLimit({ key: 'report', limit: config.maxReportsPerHour, windowMs: 60 * 60 * 1000 }),
  async (req, res) => {
    const { valid, errors, value } = validate(req.body);
    if (!valid) {
      return res.status(400).json({ ok: false, error: 'Please complete the form.', errors });
    }

    // Already sent under this submission id — return the original result so a
    // double click or a client retry never produces a second email.
    const previous = store.getCompleted(value.submissionId);
    if (previous) {
      return res.json({ ...previous, ok: true, duplicate: true });
    }

    // A concurrent request with the same id joins the send in progress.
    const existing = store.getInFlight(value.submissionId);
    if (existing) {
      try {
        const result = await existing;
        return res.json({ ...result, ok: true, duplicate: true });
      } catch {
        return res.status(502).json({
          ok: false,
          error: 'The email service did not accept the report. Your answers are saved — try again.',
          retryable: true,
        });
      }
    }

    if (!config.mailConfigured) {
      return res.status(503).json({
        ok: false,
        error: config.recipientAllowed
          ? 'Emailing is not configured on the server yet. Your answers are saved — an administrator must set SUPERVISOR_EMAIL, MAIL_FROM and SMTP_HOST.'
          : 'Reports are not being sent because the configured supervisor address has not been approved. Your answers are saved — contact an administrator.',
        retryable: true,
      });
    }

    const submittedAt = new Date();
    const report = {
      reportId: makeReportId(value.workDate),
      teamLeaderName: value.teamLeaderName,
      workDate: value.workDate,
      workDateLabel: formatWorkDate(value.workDate),
      jobLocation: value.jobLocation,
      topicId: value.topic.id,
      topicName: value.topic.name,
      answers: value.responses,
      submittedAt: submittedAt.toISOString(),
      submittedAtLabel: formatTimestamp(submittedAt),
    };

    const work = (async () => {
      const pdf = await renderReportPdf(report);
      const sent = await sendReportEmail(report, pdf);
      return store.markCompleted(value.submissionId, {
        reportId: report.reportId,
        topicName: report.topicName,
        workDate: report.workDate,
        teamLeaderName: report.teamLeaderName,
        submittedAt: report.submittedAt,
        submittedAtLabel: report.submittedAtLabel,
        messageId: sent.messageId,
        pdfBytes: pdf.length,
      });
    })();

    store.setInFlight(value.submissionId, work);

    try {
      const result = await work;
      console.log(
        '[report] sent %s (%s, %d bytes) to %s',
        result.reportId,
        result.topicName,
        result.pdfBytes,
        config.supervisorEmail
      );
      return res.json({ ...result, ok: true });
    } catch (err) {
      console.error('[report] failed: %s', err && err.stack ? err.stack : err);
      return res.status(502).json({
        ok: false,
        error:
          'The email service did not accept the report. Your answers are saved — you can retry.',
        retryable: true,
      });
    }
  }
);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mailConfigured: config.mailConfigured });
});

app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.use((err, req, res, _next) => {
  console.error('[error]', err && err.stack ? err.stack : err);
  res.status(500).json({ ok: false, error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    const missing = missingSettings();
    console.log(`Safe Haven reflection dashboard → http://localhost:${config.port}`);
    console.log(
      config.mailConfigured
        ? `Reports email to: ${config.supervisorRecipient}`
        : `Emailing is NOT configured — submissions will be refused. ${config.mailBlockedReason}`
    );
    if (missing.length) {
      console.log(`Missing settings in .env: ${missing.join(', ')}`);
    }
  });
}

module.exports = app;
