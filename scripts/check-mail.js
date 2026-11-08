'use strict';

/**
 * Checks the mail configuration without going through the dashboard.
 *
 *   node scripts/check-mail.js          connect + authenticate only
 *   node scripts/check-mail.js --send   also email a real sample report
 *                                       to SUPERVISOR_EMAIL
 *
 * Run it wherever the app is hosted (or locally with the same .env).
 */
require('dotenv').config();

const { config, missingSettings } = require('../src/config');
const { verifyTransport, sendReportEmail, buildSubject } = require('../src/mailer');
const { renderReportPdf } = require('../src/pdf');
const { TOPICS } = require('../src/topics');

const SEND = process.argv.includes('--send');

function mask(value) {
  if (!value) return '(not set)';
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(Math.max(4, value.length - 4)) + value.slice(-2);
}

function hint(err) {
  const text = `${err.code || ''} ${err.responseCode || ''} ${err.message || ''}`.toLowerCase();
  if (text.includes('535') || text.includes('invalid login') || text.includes('authentication failed')) {
    return [
      'Authentication was rejected. For Zoho this is usually one of:',
      '  - Two-factor is on and SMTP_PASS is the account password. Generate an',
      '    app-specific password at accounts.zoho.com > Security > App Passwords',
      '    and use that instead.',
      '  - SMTP access is switched off. Turn it on in Zoho Mail under',
      '    Settings > Mail Accounts > IMAP/SMTP.',
      '  - Wrong host for the plan: paid custom-domain accounts often need',
      '    smtppro.zoho.com rather than smtp.zoho.com.',
      '  - Wrong region: use smtp.zoho.eu / smtp.zoho.in / smtp.zoho.com.au if',
      '    your account lives in that data centre.',
    ].join('\n');
  }
  if (text.includes('etimedout') || text.includes('econnrefused') || text.includes('enotfound')) {
    return [
      'Could not reach the mail server. Check that:',
      '  - SMTP_HOST and SMTP_PORT are right (587 with SMTP_SECURE=false, or',
      '    465 with SMTP_SECURE=true).',
      '  - Outbound SMTP is allowed from this host. Some platforms block port',
      '    587/465 by default.',
    ].join('\n');
  }
  if (text.includes('553') || text.includes('relay') || text.includes('not allowed')) {
    return [
      'The server refused the From address. Zoho requires MAIL_FROM to be the',
      'authenticated mailbox, or an alias verified on that account.',
    ].join('\n');
  }
  return null;
}

async function main() {
  console.log('Safe Haven — mail check\n');
  console.log('  SMTP_HOST        ', config.smtp.host || '(not set)');
  console.log('  SMTP_PORT        ', config.smtp.port, config.smtp.secure ? '(implicit TLS)' : '(STARTTLS)');
  console.log('  SMTP_USER        ', config.smtp.user || '(not set)');
  console.log('  SMTP_PASS        ', mask(config.smtp.pass));
  console.log('  MAIL_FROM        ', config.mailFrom || '(not set)');
  console.log('  SUPERVISOR_EMAIL ', config.supervisorEmail || '(not set)');
  console.log('  MAIL_CC          ', config.mailCc || '(none)');
  console.log('  REPORT_TIMEZONE  ', config.timezone);
  console.log('');

  const missing = missingSettings().filter((n) => n !== 'ACCESS_CODE' && n !== 'SESSION_SECRET');
  if (missing.length) {
    console.error('Missing required mail settings:', missing.join(', '));
    process.exit(1);
  }

  try {
    await verifyTransport();
    console.log('Connected and authenticated OK.');
  } catch (err) {
    console.error('Could not connect or authenticate:\n  ' + (err.message || err));
    const h = hint(err);
    if (h) console.error('\n' + h);
    process.exit(1);
  }

  if (!SEND) {
    console.log('\nRun again with --send to email a sample report to the supervisor.');
    return;
  }

  const topic = TOPICS[0];
  const now = new Date();
  const workDate = now.toISOString().slice(0, 10);
  const report = {
    reportId: 'SH-' + workDate.replace(/-/g, '') + '-MAILCHK',
    teamLeaderName: 'Mail check',
    workDate,
    workDateLabel: new Date(workDate + 'T00:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    }),
    jobLocation: 'Configuration test',
    topicName: topic.name,
    answers: topic.questions.map((question, i) => ({
      question,
      response:
        i === 1
          ? 'None today.'
          : 'This is a configuration test sent by scripts/check-mail.js. If you are ' +
            'reading it in the attached PDF, Safe Haven report delivery is working: ' +
            'the PDF was generated on the server and sent to the supervisor address ' +
            'configured there. No team leader submitted this report.',
    })),
    submittedAt: now.toISOString(),
    submittedAtLabel: now.toLocaleString('en-US', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: config.timezone,
    }) + ` (${config.timezone})`,
  };

  console.log('\nSubject: ' + buildSubject(report));
  const pdf = await renderReportPdf(report);
  console.log('PDF rendered: %d bytes', pdf.length);

  try {
    const sent = await sendReportEmail(report, pdf);
    console.log('Sent to %s%s', config.supervisorEmail, config.mailCc ? ' (cc ' + config.mailCc + ')' : '');
    console.log('Accepted by the server for: %s', (sent.accepted || []).join(', ') || '(none reported)');
    console.log('Message id: %s', sent.messageId);
    console.log('\nAsk the supervisor to confirm the PDF arrived, then check spam if not.');
  } catch (err) {
    console.error('Send failed:\n  ' + (err.message || err));
    const h = hint(err);
    if (h) console.error('\n' + h);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
