'use strict';

const nodemailer = require('nodemailer');
const { config } = require('./config');

let transporter = null;

function getTransporter() {
  if (!config.mailConfigured) return null;
  if (transporter) return transporter;

  const options = {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
  };
  if (config.smtp.user) {
    options.auth = { user: config.smtp.user, pass: config.smtp.pass };
  }
  transporter = nodemailer.createTransport(options);
  return transporter;
}

/** Subject line format required by the spec. */
function buildSubject(report) {
  return `Safe Haven Daily Reflection — ${report.workDateLabel} — ${report.teamLeaderName}`;
}

function buildBody(report) {
  const lines = [
    'Safe Haven — Team Leader Daily Reflection',
    '',
    `Team leader: ${report.teamLeaderName}`,
    `Work date:   ${report.workDateLabel}`,
  ];
  if (report.jobLocation) lines.push(`Job/location: ${report.jobLocation}`);
  lines.push(
    `Topic:       ${report.topicName}`,
    `Submitted:   ${report.submittedAtLabel}`,
    `Report ID:   ${report.reportId}`,
    '',
    'The full reflection is attached as a PDF.'
  );
  return lines.join('\n');
}

function attachmentName(report) {
  const safeName = report.teamLeaderName
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'team-leader';
  return `safe-haven-reflection-${report.workDate}-${safeName}.pdf`;
}

/**
 * Email the report PDF to the administratively configured supervisor.
 * Throws if mail is not configured or the send is rejected.
 */
async function sendReportEmail(report, pdfBuffer) {
  const tx = getTransporter();
  if (!tx) {
    const err = new Error('Email is not configured on the server.');
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }

  const message = {
    from: config.mailFrom,
    to: config.supervisorEmail,
    subject: buildSubject(report),
    text: buildBody(report),
    attachments: [
      {
        filename: attachmentName(report),
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };
  if (config.mailCc) message.cc = config.mailCc;

  const info = await tx.sendMail(message);
  return { messageId: info.messageId, accepted: info.accepted || [] };
}

async function verifyTransport() {
  const tx = getTransporter();
  if (!tx) return { ok: false, reason: 'not configured' };
  await tx.verify();
  return { ok: true };
}

module.exports = { sendReportEmail, verifyTransport, buildSubject, attachmentName };
