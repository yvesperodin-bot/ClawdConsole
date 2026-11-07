'use strict';

/**
 * Renders a sample report PDF to tmp/sample-report.pdf so the layout — in
 * particular wrapping and multi-page overflow — can be eyeballed without
 * sending any email.  Run with:  npm run check:pdf
 */
const fs = require('fs');
const path = require('path');
const { renderReportPdf } = require('../src/pdf');
const { TOPICS } = require('../src/topics');

const long = Array.from({ length: 24 }, (_, i) =>
  `Paragraph ${i + 1}: ` +
  'This is a deliberately long response used to confirm that text wraps inside ' +
  'the page margins and continues onto additional pages instead of being cut ' +
  'off at the bottom. ' +
  'It mentions specific examples, names the people who helped, and records the ' +
  'follow-through that is still open so the supervisor can act on it.'
).join('\n\n');

const topic = TOPICS[0];

renderReportPdf({
  reportId: 'SH-20261107-ABC123',
  teamLeaderName: 'Sample Team Leader',
  workDate: '2026-11-07',
  workDateLabel: 'Saturday, November 7, 2026',
  jobLocation: 'Riverside site — Bay 3',
  topicName: topic.name,
  answers: [
    { question: topic.questions[0], response: long },
    { question: topic.questions[1], response: 'None today.' },
    { question: topic.questions[2], response: long },
  ],
  submittedAtLabel: 'Nov 7, 2026, 6:12 PM (UTC)',
}).then((buffer) => {
  const out = path.join(__dirname, '..', 'tmp', 'sample-report.pdf');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buffer);
  console.log('Wrote %s (%d bytes)', out, buffer.length);
});
