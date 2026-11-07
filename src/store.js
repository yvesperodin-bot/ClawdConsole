'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'submissions.json');
const MAX_ENTRIES = 500;

/**
 * Idempotency store keyed by the client-generated submission id.
 *
 * - Completed sends are remembered (and persisted across restarts) so a repeat
 *   click, a browser retry, or a resend of the same draft returns the original
 *   report instead of emailing the supervisor twice.
 * - In-flight sends are tracked as promises so two concurrent requests with the
 *   same id share one send rather than racing.
 */
const completed = new Map(); // submissionId -> { reportId, submittedAt, ... }
const inFlight = new Map(); // submissionId -> Promise

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry && entry.submissionId) completed.set(entry.submissionId, entry);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[store] could not read %s: %s', FILE, err.message);
    }
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const entries = [...completed.values()].slice(-MAX_ENTRIES);
    fs.writeFileSync(FILE, JSON.stringify(entries, null, 2));
  } catch (err) {
    console.warn('[store] could not write %s: %s', FILE, err.message);
  }
}

function getCompleted(submissionId) {
  return completed.get(submissionId) || null;
}

function markCompleted(submissionId, record) {
  const entry = { submissionId, ...record };
  completed.set(submissionId, entry);
  if (completed.size > MAX_ENTRIES) {
    const oldest = completed.keys().next().value;
    completed.delete(oldest);
  }
  persist();
  return entry;
}

function getInFlight(submissionId) {
  return inFlight.get(submissionId) || null;
}

function setInFlight(submissionId, promise) {
  inFlight.set(submissionId, promise);
  const clear = () => inFlight.delete(submissionId);
  promise.then(clear, clear);
  return promise;
}

load();

module.exports = { getCompleted, markCompleted, getInFlight, setInFlight };
