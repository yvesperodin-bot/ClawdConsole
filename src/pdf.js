'use strict';

const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 56; // ~0.78in
const INK = '#1f2a33';
const MUTED = '#5c6b7a';
const RULE = '#d4dde4';
const ACCENT = '#0f5a66';

/**
 * Render the reflection report to a PDF Buffer.
 *
 * Layout is pure text flow (no absolute Y positioning for body content), so
 * pdfkit wraps long responses and spills onto as many pages as needed without
 * clipping. Page footers are drawn at the end via buffered pages.
 */
function renderReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      bufferPages: true,
      margins: {
        top: PAGE_MARGIN,
        bottom: PAGE_MARGIN + 24, // leave room for the footer
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      info: {
        Title: `Safe Haven Daily Reflection — ${report.workDateLabel} — ${report.teamLeaderName}`,
        Author: report.teamLeaderName,
        Subject: `Safe Haven Daily Reflection (${report.topicName})`,
        Keywords: `Safe Haven, daily reflection, ${report.reportId}`,
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const contentWidth = doc.page.width - PAGE_MARGIN * 2;

    // ---- Title block ----------------------------------------------------
    doc
      .fillColor(ACCENT)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('Safe Haven', { width: contentWidth });

    doc
      .fillColor(INK)
      .font('Helvetica')
      .fontSize(13)
      .text('Team Leader Daily Reflection', { width: contentWidth });

    doc.moveDown(0.7);
    ruleAtCursor(doc, contentWidth);
    doc.moveDown(0.9);

    // ---- Details --------------------------------------------------------
    detailRow(doc, 'Team leader', report.teamLeaderName, contentWidth);
    detailRow(doc, 'Work date', report.workDateLabel, contentWidth);
    if (report.jobLocation) {
      detailRow(doc, 'Job / location', report.jobLocation, contentWidth);
    }
    detailRow(doc, 'Topic', report.topicName, contentWidth);
    detailRow(doc, 'Submitted', report.submittedAtLabel, contentWidth);
    detailRow(doc, 'Report ID', report.reportId, contentWidth);

    doc.moveDown(0.6);
    ruleAtCursor(doc, contentWidth);
    doc.moveDown(1.1);

    // ---- Questions and responses ---------------------------------------
    report.answers.forEach((item, index) => {
      // Keep a question from being orphaned at the very bottom of a page:
      // if there isn't room for the question plus a line of response, break.
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y > bottom - 72) doc.addPage();

      doc
        .fillColor(MUTED)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`QUESTION ${index + 1}`, { width: contentWidth, characterSpacing: 0.8 });

      doc.moveDown(0.25);
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(item.question, { width: contentWidth, lineGap: 1.5 });

      doc.moveDown(0.45);
      doc
        .fillColor(INK)
        .font('Helvetica')
        .fontSize(11.5)
        .text(item.response, {
          width: contentWidth,
          lineGap: 3,
          align: 'left',
        });

      if (index < report.answers.length - 1) {
        doc.moveDown(1.1);
      }
    });

    // ---- Footers on every page -----------------------------------------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      // Writing inside the bottom margin would make pdfkit append a blank
      // page, so drop the margin for the duration of the footer write.
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          `Safe Haven Daily Reflection · ${report.reportId} · Page ${i - range.start + 1} of ${range.count}`,
          PAGE_MARGIN,
          doc.page.height - PAGE_MARGIN - 4,
          { width: contentWidth, align: 'center', lineBreak: false }
        );
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}

function ruleAtCursor(doc, width) {
  const y = doc.y;
  doc
    .save()
    .strokeColor(RULE)
    .lineWidth(1)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + width, y)
    .stroke()
    .restore();
  doc.y = y;
}

function detailRow(doc, label, value, width) {
  const labelWidth = 104;
  const startY = doc.y;

  doc
    .fillColor(MUTED)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(label, PAGE_MARGIN, startY, { width: labelWidth, lineBreak: false });

  doc
    .fillColor(INK)
    .font('Helvetica')
    .fontSize(11)
    .text(value, PAGE_MARGIN + labelWidth, startY, {
      width: width - labelWidth,
      lineGap: 1.5,
    });

  doc.x = PAGE_MARGIN;
  doc.moveDown(0.35);
}

module.exports = { renderReportPdf };
