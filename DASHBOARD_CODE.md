# Safe Haven — Team Leader Daily Reflection: Dashboard Code

Generated 2026-11-11 from `ccr-91e528a8-2g8mr8` at commit `b41ab7a`.
Code below is copied verbatim from the repository — do not retype it by hand.

This file exists so the dashboard can be read and reasoned about in a context that has
no access to the repository (another AI session, a review, a vendor). It contains the
**frontend** plus the topic definitions. It does **not** contain the backend
(`server.js`, `src/config.js`, `src/pdf.js`, `src/mailer.js`, `src/store.js`).

---

## Read this before using the code

**The frontend is not standalone.** It needs the Express backend for three things:

1. **Topic data.** `public/index.html` ships with a placeholder comment, not the
   questions. The server replaces it with `window.SAFE_HAVEN = {...}` on each request.
   Copy the HTML to a static host and you get an empty page.
2. **PDF and email.** Both are Node-side (PDFKit, Nodemailer). Neither can run in a
   browser. There is no client-side fallback.
3. **Authentication.** Sign-in is an HMAC-signed httpOnly cookie issued by the server.

To run the frontend standalone you must, at minimum, inline the topic data, resolve
both placeholders, and point the four `fetch()` calls at an absolute backend URL.

## File map

| File | Lines | Role |
| --- | --- | --- |
| `src/topics.js` | 63 | Topic + question definitions (shared with server) |
| `public/index.html` | 102 | Markup shell, two server-filled placeholders |
| `public/styles.css` | 376 | All styling, brand tokens at top |
| `public/app.js` | 627 | All client behaviour |

---

## `src/topics.js`

The four topics and twelve questions. **This is the single source of truth.** The server validates submissions against it, builds the PDF from it, and injects it into the page at request time. Editing this one file changes the form, the validation and the PDF together.

*63 lines.*

```js
'use strict';

/**
 * Canonical topic + question definitions.
 *
 * This is the ONE source of truth. The server validates submissions against it
 * and builds the PDF from it, and it is injected into index.html at request
 * time so the browser renders the same text without a second round trip.
 *
 * To change wording or add a topic, edit only this file.
 */
const TOPICS = [
  {
    id: 'teamwork',
    name: 'Teamwork & Improvement',
    description: 'What worked and what we can improve.',
    questions: [
      'What did we do well together today?',
      'What got in our way that we could handle differently?',
      "What's one change we'll try tomorrow, and who will own it?",
    ],
  },
  {
    id: 'communication',
    name: 'Communication & Support',
    description: 'Observations, cooperation, and support needed.',
    questions: [
      'What did you notice today that the rest of us might have missed?',
      'Where could we have helped each other sooner?',
      'What help or decision do we need before we start tomorrow?',
    ],
  },
  {
    id: 'planning',
    name: 'Planning & Learning',
    description: 'How the day unfolded and what we learned.',
    questions: [
      'Where did today go differently from what we planned?',
      'What did we learn from how we handled it?',
      'What should we do differently next time?',
    ],
  },
  {
    id: 'recognition',
    name: 'Recognition & Follow-Through',
    description: 'Contributions, open items, and commitments.',
    questions: [
      "Who made someone else's job easier today, and how?",
      "What's still open that we need to pick up tomorrow?",
      'What did we agree to follow up on earlier this week, and where does it stand?',
    ],
  },
];

const REFLECTION_PROMPT =
  'Reflect on today’s work and teamwork. Use specific examples, recognize ' +
  'contributions, and identify anything that needs follow-through.';

function getTopic(id) {
  return TOPICS.find((t) => t.id === id) || null;
}

module.exports = { TOPICS, REFLECTION_PROMPT, getTopic };
```

---

## `public/index.html`

Static markup only. Note the two placeholders at the bottom — `__CSP_NONCE__` and `/*__SAFE_HAVEN_BOOTSTRAP__*/` — which Express fills in on every request. **A static copy of this file does not work**: no topics render, because the topic data arrives through that bootstrap comment.

*102 lines.*

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Safe Haven — Team Leader Daily Reflection</title>
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="data:,">
</head>
<body>

<!-- Access gate: shown until the team leader signs in with the shared code. -->
<main id="gate" class="gate" hidden>
  <div class="gate-card">
    <p class="brand-mark">Safe Haven</p>
    <h1 class="gate-title">Team Leader Daily Reflection</h1>
    <p class="gate-note">This form is limited to authorized team leaders and supervisors.</p>
    <form id="gate-form" novalidate>
      <label class="field-label" for="access-code">Access code</label>
      <input id="access-code" name="accessCode" type="password" autocomplete="current-password"
             class="text-input" inputmode="text" spellcheck="false" required>
      <p id="gate-error" class="inline-error" role="alert" hidden></p>
      <button id="gate-submit" type="submit" class="btn btn-primary btn-block">Sign in</button>
    </form>
  </div>
</main>

<!-- Dashboard -->
<div id="app" class="page" hidden>
  <header class="page-header">
    <p class="brand-mark">Safe Haven</p>
    <h1 class="page-title">Safe Haven — Team Leader Daily Reflection</h1>
    <p class="page-sub">
      Completed privately at the end of the shift. The report is emailed to your supervisor as a PDF.
    </p>
  </header>

  <main>
    <!-- Top fields -->
    <section class="card" aria-labelledby="shift-details-heading">
      <h2 id="shift-details-heading" class="sr-only">Shift details</h2>
      <div class="field">
        <label class="field-label" for="tl-name">Team leader name</label>
        <input id="tl-name" class="text-input" type="text" autocomplete="name"
               maxlength="200" required>
        <p class="inline-error" data-error-for="tl-name" role="alert" hidden></p>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="field-label" for="work-date">Work date</label>
          <input id="work-date" class="text-input" type="date" required>
          <p class="inline-error" data-error-for="work-date" role="alert" hidden></p>
        </div>
        <div class="field">
          <label class="field-label" for="job-location">
            Job / location <span class="optional">optional</span>
          </label>
          <input id="job-location" class="text-input" type="text" maxlength="200"
                 autocomplete="off">
        </div>
      </div>
    </section>

    <!-- Topic selection -->
    <section aria-labelledby="topics-heading">
      <h2 id="topics-heading" class="section-heading">Choose the topic that best fits today</h2>
      <p class="section-hint">
        Open one topic. The other three stay available until you do, and come back when you close it.
      </p>
      <div id="topics" class="topics"></div>
      <p class="inline-error" data-error-for="topic" role="alert" hidden></p>
    </section>

    <!-- Submit -->
    <section id="submit-section" class="submit-section" hidden>
      <div id="status" class="status" role="status" aria-live="polite" hidden></div>
      <button id="submit-btn" type="button" class="btn btn-primary btn-block">Submit Report</button>
      <p id="submit-hint" class="submit-hint">
        Your answers are saved on this device as you type.
      </p>
    </section>

    <!-- Success -->
    <section id="success" class="success-card" role="status" aria-live="polite" hidden>
      <h2 class="success-title">Report sent</h2>
      <p id="success-detail" class="success-detail"></p>
      <button id="new-report" type="button" class="btn btn-secondary">Start another report</button>
    </section>
  </main>

  <footer class="page-footer">
    <span id="mail-warning" class="mail-warning" hidden></span>
    <button id="sign-out" type="button" class="link-btn">Sign out</button>
  </footer>
</div>

<script nonce="__CSP_NONCE__">/*__SAFE_HAVEN_BOOTSTRAP__*/</script>
<script src="/app.js"></script>
</body>
</html>
```

---

## `public/styles.css`

All styling. Brand colours are the three `--brand-*` tokens at the top; swapping them is the whole re-brand. `[hidden] { display: none !important }` near the top is load-bearing — see the notes at the end of this file.

*376 lines.*

```css
/* Safe Haven — Team Leader Daily Reflection
   Branding swap point: change the --brand-* tokens below to match supplied
   Safe Haven brand colours. Nothing else needs editing. */

:root {
  --brand-ink: #0f5a66;
  --brand-ink-strong: #0b454f;
  --brand-wash: #eef5f6;

  --ink: #1f2a33;
  --ink-soft: #55656f;
  --ink-faint: #7b8893;
  --surface: #ffffff;
  --canvas: #f4f6f7;
  --line: #d6dee3;
  --line-soft: #e6ecef;
  --danger: #a8301f;
  --danger-wash: #fdf1ef;
  --ok: #1d6b4a;
  --ok-wash: #eff7f2;

  --radius: 12px;
  --tap: 48px;
  --shadow: 0 1px 2px rgba(31, 42, 51, .06), 0 4px 14px rgba(31, 42, 51, .05);
}

* { box-sizing: border-box; }

/* An author `display` rule beats the UA stylesheet's [hidden] { display: none },
   so make the hidden attribute authoritative for every element. */
[hidden] { display: none !important; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--canvas);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 17px;
  line-height: 1.55;
}

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ---------- Layout ---------- */
.page {
  max-width: 44rem;
  margin: 0 auto;
  padding: 28px 18px 72px;
}

.page-header { margin-bottom: 26px; }

.brand-mark {
  margin: 0 0 6px;
  font-size: .8rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--brand-ink);
}

.page-title {
  margin: 0 0 8px;
  font-size: 1.6rem;
  line-height: 1.25;
  font-weight: 700;
  color: var(--ink);
}

.page-sub {
  margin: 0;
  color: var(--ink-soft);
  font-size: .98rem;
  max-width: 34rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
  margin-bottom: 30px;
}

.section-heading {
  margin: 0 0 6px;
  font-size: 1.1rem;
  font-weight: 700;
}

.section-hint {
  margin: 0 0 16px;
  color: var(--ink-soft);
  font-size: .94rem;
}

/* ---------- Fields ---------- */
.field { margin-bottom: 18px; }
.field:last-child { margin-bottom: 0; }

.field-row { display: grid; gap: 18px; }

@media (min-width: 40rem) {
  .field-row { grid-template-columns: 1fr 1fr; }
  .field-row .field { margin-bottom: 0; }
}

.field-label {
  display: block;
  margin-bottom: 7px;
  font-size: .95rem;
  font-weight: 650;
  color: var(--ink);
}

.optional {
  font-weight: 400;
  color: var(--ink-faint);
  font-size: .85rem;
}

.text-input {
  display: block;
  width: 100%;
  min-height: var(--tap);
  padding: 11px 13px;
  font: inherit;
  font-size: 1rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  appearance: none;
}

textarea.text-input {
  min-height: 9.5rem;
  resize: vertical;
  line-height: 1.6;
}

.text-input:focus-visible,
.topic-toggle:focus-visible,
.btn:focus-visible,
.link-btn:focus-visible {
  outline: 3px solid var(--brand-ink);
  outline-offset: 2px;
}

.text-input[aria-invalid="true"] { border-color: var(--danger); }

.inline-error {
  margin: 7px 0 0;
  color: var(--danger);
  font-size: .9rem;
  font-weight: 600;
}

/* ---------- Topics ---------- */
.topics { display: flex; flex-direction: column; gap: 14px; }

.topic {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.topic.is-open { border-color: var(--brand-ink); box-shadow: 0 0 0 1px var(--brand-ink), var(--shadow); }

.topic.is-disabled { opacity: .45; box-shadow: none; background: #fbfcfc; }

.topic-toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 68px;
  padding: 16px 18px;
  background: none;
  border: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.topic.is-disabled .topic-toggle { cursor: not-allowed; }

.topic-toggle:hover:not(:disabled) { background: var(--brand-wash); }

.topic-text { flex: 1 1 auto; min-width: 0; }

.topic-name {
  display: block;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ink);
}

.topic-desc {
  display: block;
  margin-top: 3px;
  font-size: .92rem;
  color: var(--ink-soft);
}

.topic-arrow {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  color: var(--brand-ink);
  transition: transform .18s ease;
}

.topic.is-open .topic-arrow { transform: rotate(180deg); }

@media (prefers-reduced-motion: reduce) {
  .topic-arrow { transition: none; }
}

.topic-arrow svg { display: block; }

.topic-panel {
  padding: 4px 18px 22px;
  border-top: 1px solid var(--line-soft);
}

.topic-prompt {
  margin: 18px 0 22px;
  padding: 14px 16px;
  background: var(--brand-wash);
  border-left: 3px solid var(--brand-ink);
  border-radius: 8px;
  color: var(--ink);
  font-size: .96rem;
}

.question-block { margin-bottom: 24px; }
.question-block:last-child { margin-bottom: 0; }

.question-label {
  display: block;
  margin-bottom: 9px;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.45;
  color: var(--ink);
}

.question-number {
  display: block;
  font-size: .78rem;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 4px;
}

/* ---------- Buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--tap);
  padding: 12px 22px;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 650;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-block { width: 100%; }

.btn-primary { background: var(--brand-ink); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--brand-ink-strong); }

.btn-secondary {
  background: var(--surface);
  color: var(--brand-ink);
  border-color: var(--brand-ink);
}

.btn:disabled { opacity: .55; cursor: not-allowed; }

.link-btn {
  background: none;
  border: 0;
  padding: 8px 4px;
  font: inherit;
  font-size: .92rem;
  color: var(--ink-soft);
  text-decoration: underline;
  cursor: pointer;
}

/* ---------- Submit / status ---------- */
.submit-section { margin-top: 30px; }

.submit-hint {
  margin: 12px 0 0;
  font-size: .9rem;
  color: var(--ink-faint);
  text-align: center;
}

.status {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 10px;
  font-size: .96rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.status.is-error { background: var(--danger-wash); color: var(--danger); border-color: #f0cdc6; }
.status.is-info { background: var(--brand-wash); color: var(--brand-ink-strong); border-color: #cfe1e4; }

.success-card {
  margin-top: 30px;
  padding: 24px 20px;
  background: var(--ok-wash);
  border: 1px solid #c9e3d6;
  border-radius: var(--radius);
  text-align: center;
}

.success-title { margin: 0 0 8px; font-size: 1.25rem; color: var(--ok); }
.success-detail { margin: 0 0 18px; color: var(--ink-soft); font-size: .95rem; }

.page-footer {
  margin-top: 44px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.mail-warning { font-size: .88rem; color: var(--danger); font-weight: 600; }

/* ---------- Access gate ---------- */
.gate {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 18px;
}

.gate-card {
  width: 100%;
  max-width: 24rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 28px 24px;
}

.gate-title { margin: 0 0 10px; font-size: 1.3rem; font-weight: 700; }
.gate-note { margin: 0 0 22px; color: var(--ink-soft); font-size: .93rem; }
.gate-card .btn { margin-top: 18px; }
```

---

## `public/app.js`

All client behaviour: accordion, draft persistence, validation, submit, retry and offline handling. Plain ES5-style JavaScript in an IIFE — no framework, no build step, no external dependency.

*627 lines.*

```js
/* Safe Haven — Team Leader Daily Reflection (client)
   Single page: access gate, shift details, four collapsible topics, submit. */
(function () {
  'use strict';

  var BOOT = window.SAFE_HAVEN || { topics: [], reflectionPrompt: '' };
  var TOPICS = BOOT.topics || [];
  var DRAFT_KEY = 'safeHaven.reflection.draft.v1';

  var el = {
    gate: document.getElementById('gate'),
    gateForm: document.getElementById('gate-form'),
    gateCode: document.getElementById('access-code'),
    gateError: document.getElementById('gate-error'),
    gateSubmit: document.getElementById('gate-submit'),
    app: document.getElementById('app'),
    name: document.getElementById('tl-name'),
    date: document.getElementById('work-date'),
    location: document.getElementById('job-location'),
    topics: document.getElementById('topics'),
    submitSection: document.getElementById('submit-section'),
    submitBtn: document.getElementById('submit-btn'),
    submitHint: document.getElementById('submit-hint'),
    status: document.getElementById('status'),
    success: document.getElementById('success'),
    successDetail: document.getElementById('success-detail'),
    newReport: document.getElementById('new-report'),
    signOut: document.getElementById('sign-out'),
    mailWarning: document.getElementById('mail-warning'),
  };

  /* ------------------------------------------------------------------ state */
  var state = {
    activeTopic: null,
    // responses are kept for EVERY topic, so collapsing or switching topics
    // never throws away what was typed.
    responses: {},
    // One attempt id per distinct payload; reused across retries so the server
    // can reject duplicates, replaced when the content actually changes.
    attempt: null,
    sending: false,
  };
  var panels = {};
  var toggles = {};
  var cards = {};

  /* ------------------------------------------------------------- utilities */
  function todayISO() {
    var d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID().replace(/-/g, '');
    }
    var bytes = new Uint8Array(16);
    (window.crypto || {}).getRandomValues
      ? window.crypto.getRandomValues(bytes)
      : bytes.forEach(function (_, i) { bytes[i] = Math.floor(Math.random() * 256); });
    return Array.prototype.map
      .call(bytes, function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function show(node, visible) {
    if (node) node.hidden = !visible;
  }

  function setFieldError(key, message) {
    var node = document.querySelector('[data-error-for="' + key + '"]');
    if (!node) return;
    node.textContent = message || '';
    node.hidden = !message;
  }

  function clearErrors() {
    var nodes = document.querySelectorAll('.inline-error[data-error-for]');
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].textContent = '';
      nodes[i].hidden = true;
    }
    [el.name, el.date].forEach(function (f) { f.removeAttribute('aria-invalid'); });
    var areas = el.topics.querySelectorAll('textarea');
    for (var j = 0; j < areas.length; j += 1) areas[j].removeAttribute('aria-invalid');
  }

  function setStatus(message, kind) {
    if (!message) {
      show(el.status, false);
      el.status.textContent = '';
      return;
    }
    el.status.textContent = message;
    el.status.className = 'status ' + (kind === 'error' ? 'is-error' : 'is-info');
    show(el.status, true);
  }

  /* ---------------------------------------------------------------- drafts */
  var saveTimer = null;

  function writeDraft() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          teamLeaderName: el.name.value,
          workDate: el.date.value,
          jobLocation: el.location.value,
          activeTopic: state.activeTopic,
          responses: state.responses,
          attempt: state.attempt,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      /* storage unavailable (private mode / full) — typing still works */
    }
  }

  /**
   * Typing is debounced so we are not writing on every keystroke, but any
   * pending write is flushed synchronously when the page is hidden or
   * unloaded, so a refresh immediately after typing never loses work.
   */
  function saveDraft(immediate) {
    if (immediate) {
      writeDraft();
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeDraft, 250);
  }

  function flushDraft() {
    if (saveTimer !== null) writeDraft();
  }

  function clearDraft() {
    // Cancelling the pending write stops a queued draft from resurrecting
    // the report we just submitted.
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) { /* ignore */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  /* ------------------------------------------------------------ topic view */
  var CHEVRON =
    '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
    '<path d="M4.5 7.5 10 13l5.5-5.5" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function buildTopics() {
    TOPICS.forEach(function (topic) {
      state.responses[topic.id] = ['', '', ''];

      var card = document.createElement('section');
      card.className = 'topic';
      card.dataset.topic = topic.id;

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'topic-toggle';
      toggle.id = 'toggle-' + topic.id;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'panel-' + topic.id);
      toggle.innerHTML =
        '<span class="topic-text">' +
        '<span class="topic-name"></span>' +
        '<span class="topic-desc"></span>' +
        '</span><span class="topic-arrow">' + CHEVRON + '</span>';
      toggle.querySelector('.topic-name').textContent = topic.name;
      toggle.querySelector('.topic-desc').textContent = topic.description;
      toggle.addEventListener('click', function () { onToggle(topic.id); });

      var panel = document.createElement('div');
      panel.className = 'topic-panel';
      panel.id = 'panel-' + topic.id;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', toggle.id);
      panel.hidden = true;

      var prompt = document.createElement('p');
      prompt.className = 'topic-prompt';
      prompt.textContent = BOOT.reflectionPrompt;
      panel.appendChild(prompt);

      topic.questions.forEach(function (question, index) {
        var block = document.createElement('div');
        block.className = 'question-block';

        var areaId = 'resp-' + topic.id + '-' + index;

        var label = document.createElement('label');
        label.className = 'question-label';
        label.setAttribute('for', areaId);
        var num = document.createElement('span');
        num.className = 'question-number';
        num.textContent = 'Question ' + (index + 1);
        label.appendChild(num);
        label.appendChild(document.createTextNode(question));

        var area = document.createElement('textarea');
        area.className = 'text-input';
        area.id = areaId;
        area.rows = 5;
        area.maxLength = 6000;
        area.setAttribute('aria-describedby', 'submit-hint');
        area.addEventListener('input', function () {
          state.responses[topic.id][index] = area.value;
          setFieldError(areaId, '');
          area.removeAttribute('aria-invalid');
          saveDraft();
        });

        // Question sits directly above its own text box.
        block.appendChild(label);
        block.appendChild(area);

        var error = document.createElement('p');
        error.className = 'inline-error';
        error.setAttribute('data-error-for', areaId);
        error.setAttribute('role', 'alert');
        error.hidden = true;
        block.appendChild(error);

        panel.appendChild(block);
      });

      card.appendChild(toggle);
      card.appendChild(panel);
      el.topics.appendChild(card);

      cards[topic.id] = card;
      toggles[topic.id] = toggle;
      panels[topic.id] = panel;
    });
  }

  function onToggle(topicId) {
    if (state.sending) return;
    if (state.activeTopic === topicId) collapse();
    else expand(topicId);
  }

  function expand(topicId) {
    state.activeTopic = topicId;
    render();
    setFieldError('topic', '');
    // Move the submit block so it always sits below the expanded questions.
    panels[topicId].appendChild(el.submitSection);
    show(el.submitSection, true);
    show(el.success, false);
    setStatus('');
    saveDraft(true);
    var first = panels[topicId].querySelector('textarea');
    if (first) first.focus({ preventScroll: true });
  }

  function collapse() {
    var previous = state.activeTopic;
    state.activeTopic = null;
    show(el.submitSection, false);
    setStatus('');
    render();
    saveDraft(true);
    if (previous && toggles[previous]) toggles[previous].focus({ preventScroll: true });
  }

  function render() {
    TOPICS.forEach(function (topic) {
      var isActive = state.activeTopic === topic.id;
      var isLocked = state.activeTopic !== null && !isActive;

      cards[topic.id].classList.toggle('is-open', isActive);
      cards[topic.id].classList.toggle('is-disabled', isLocked);
      toggles[topic.id].disabled = isLocked || state.sending;
      toggles[topic.id].setAttribute('aria-expanded', isActive ? 'true' : 'false');
      panels[topic.id].hidden = !isActive;

      // Keep collapsed answers out of the tab order without losing their value.
      var areas = panels[topic.id].querySelectorAll('textarea');
      for (var i = 0; i < areas.length; i += 1) {
        areas[i].value = state.responses[topic.id][i] || '';
        areas[i].disabled = !isActive;
      }
    });
  }

  /* ------------------------------------------------------------- restoring */
  function restore() {
    el.date.value = todayISO();
    var draft = loadDraft();
    if (!draft) return;

    if (typeof draft.teamLeaderName === 'string') el.name.value = draft.teamLeaderName;
    if (typeof draft.workDate === 'string' && draft.workDate) el.date.value = draft.workDate;
    if (typeof draft.jobLocation === 'string') el.location.value = draft.jobLocation;

    if (draft.responses) {
      TOPICS.forEach(function (topic) {
        var saved = draft.responses[topic.id];
        if (Array.isArray(saved)) {
          state.responses[topic.id] = [0, 1, 2].map(function (i) {
            return typeof saved[i] === 'string' ? saved[i] : '';
          });
        }
      });
    }

    if (draft.attempt && draft.attempt.id) state.attempt = draft.attempt;

    if (draft.activeTopic && panels[draft.activeTopic]) {
      state.activeTopic = draft.activeTopic;
      panels[state.activeTopic].appendChild(el.submitSection);
      show(el.submitSection, true);
    }
    render();
  }

  /* -------------------------------------------------------------- submit */
  function collectPayload() {
    return {
      teamLeaderName: el.name.value.trim(),
      workDate: el.date.value,
      jobLocation: el.location.value.trim(),
      topicId: state.activeTopic,
      // Only the currently expanded topic is submitted.
      responses: state.activeTopic
        ? state.responses[state.activeTopic].map(function (r) { return String(r || '').trim(); })
        : [],
    };
  }

  function validate(payload) {
    clearErrors();
    var firstBad = null;

    if (!payload.teamLeaderName) {
      setFieldError('tl-name', 'Enter the team leader’s name.');
      el.name.setAttribute('aria-invalid', 'true');
      firstBad = firstBad || el.name;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.workDate)) {
      setFieldError('work-date', 'Choose a work date.');
      el.date.setAttribute('aria-invalid', 'true');
      firstBad = firstBad || el.date;
    }
    if (!payload.topicId) {
      setFieldError('topic', 'Open a topic and answer its three questions.');
      firstBad = firstBad || el.topics;
    } else {
      payload.responses.forEach(function (response, index) {
        if (response) return;
        var id = 'resp-' + payload.topicId + '-' + index;
        setFieldError(id, 'Answer question ' + (index + 1) + '. Short answers such as “None today” are fine.');
        var area = document.getElementById(id);
        if (area) area.setAttribute('aria-invalid', 'true');
        firstBad = firstBad || area;
      });
    }

    if (firstBad) {
      firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (typeof firstBad.focus === 'function') firstBad.focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  function setSending(sending) {
    state.sending = sending;
    el.submitBtn.disabled = sending;
    el.submitBtn.textContent = sending ? 'Sending…' : 'Submit Report';
    el.name.disabled = sending;
    el.date.disabled = sending;
    el.location.disabled = sending;
    TOPICS.forEach(function (topic) {
      var locked = sending || (state.activeTopic !== null && state.activeTopic !== topic.id);
      toggles[topic.id].disabled = locked;
    });
    if (state.activeTopic) {
      var areas = panels[state.activeTopic].querySelectorAll('textarea');
      for (var i = 0; i < areas.length; i += 1) areas[i].disabled = sending;
    }
  }

  async function submit() {
    if (state.sending) return; // guards against repeated clicks
    var payload = collectPayload();
    if (!validate(payload)) return;

    if (navigator.onLine === false) {
      setStatus(
        'You appear to be offline. Your answers are saved on this device — reconnect to the internet and press Submit Report again.',
        'error'
      );
      return;
    }

    // Stable id across retries of the same content; a new id once the content
    // changes, so an edited report is never mistaken for a duplicate.
    var fingerprint = JSON.stringify(payload);
    if (!state.attempt || state.attempt.fingerprint !== fingerprint) {
      state.attempt = { id: newId(), fingerprint: fingerprint };
    }
    payload.submissionId = state.attempt.id;
    saveDraft(true);

    setSending(true);
    setStatus('Generating the PDF and emailing your supervisor…', 'info');

    var response;
    var body;
    try {
      response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Safe-Haven': '1' },
        body: JSON.stringify(payload),
      });
      body = await response.json().catch(function () { return {}; });
    } catch (err) {
      setSending(false);
      setStatus(
        'Could not reach the server. Your answers are saved — check your connection and press Submit Report to retry.',
        'error'
      );
      return;
    }

    setSending(false);

    if (response.ok && body.ok) {
      onSuccess(body);
      return;
    }

    if (response.status === 401 && body.reauth) {
      setStatus('Your session expired. Sign in again — your answers are saved.', 'error');
      showGate();
      return;
    }

    if (response.status === 400 && body.errors) {
      applyServerErrors(body.errors);
      setStatus(body.error || 'Please complete the form.', 'error');
      return;
    }

    setStatus(
      (body.error ||
        'The report could not be sent. Your answers are saved — press Submit Report to retry.') +
        '',
      'error'
    );
  }

  function applyServerErrors(errors) {
    clearErrors();
    var map = { teamLeaderName: 'tl-name', workDate: 'work-date', topicId: 'topic' };
    Object.keys(errors).forEach(function (key) {
      var match = /^response(\d)$/.exec(key);
      if (match && state.activeTopic) {
        setFieldError('resp-' + state.activeTopic + '-' + match[1], errors[key]);
        return;
      }
      if (map[key]) setFieldError(map[key], errors[key]);
    });
  }

  function onSuccess(result) {
    // Submitted draft is cleared only after the email service accepted it.
    clearDraft();
    state.attempt = null;
    state.responses = {};
    TOPICS.forEach(function (topic) { state.responses[topic.id] = ['', '', '']; });
    state.activeTopic = null;

    el.name.value = '';
    el.location.value = '';
    el.date.value = todayISO();

    show(el.submitSection, false);
    setStatus('');
    clearErrors();
    render();

    var parts = ['Report ' + (result.reportId || '') + ' was emailed to your supervisor.'];
    if (result.duplicate) {
      parts.push('This report had already been sent, so no duplicate was emailed.');
    }
    if (result.submittedAtLabel) parts.push('Submitted ' + result.submittedAtLabel + '.');
    el.successDetail.textContent = parts.join(' ');
    show(el.success, true);
    el.success.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.newReport.focus({ preventScroll: true });
  }

  /* ----------------------------------------------------------------- gate */
  function showGate() {
    show(el.gate, true);
    show(el.app, false);
    el.gateCode.value = '';
    el.gateCode.focus({ preventScroll: true });
  }

  function showApp(session) {
    show(el.gate, false);
    show(el.app, true);
    if (session && session.mailConfigured === false) {
      el.mailWarning.textContent =
        'Emailing is not configured on the server yet — submissions will be refused.';
      show(el.mailWarning, true);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    el.gateError.hidden = true;
    el.gateSubmit.disabled = true;
    el.gateSubmit.textContent = 'Signing in…';
    try {
      var response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Safe-Haven': '1' },
        body: JSON.stringify({ accessCode: el.gateCode.value }),
      });
      var body = await response.json().catch(function () { return {}; });
      if (response.ok && body.ok) {
        showApp(body);
        return;
      }
      el.gateError.textContent = body.error || 'Could not sign in.';
      el.gateError.hidden = false;
    } catch (err) {
      el.gateError.textContent = 'Could not reach the server. Check your connection.';
      el.gateError.hidden = false;
    } finally {
      el.gateSubmit.disabled = false;
      el.gateSubmit.textContent = 'Sign in';
    }
  }

  async function signOut() {
    try {
      await fetch('/api/logout', { method: 'POST', headers: { 'X-Safe-Haven': '1' } });
    } catch (err) { /* ignore */ }
    showGate();
  }

  /* ----------------------------------------------------------------- init */
  function updateOfflineHint() {
    if (navigator.onLine === false) {
      el.submitHint.textContent =
        'You are offline. Your answers are saved on this device; a connection is needed to submit.';
    } else {
      el.submitHint.textContent = 'Your answers are saved on this device as you type.';
    }
  }

  async function init() {
    buildTopics();
    restore();
    render();

    el.name.addEventListener('input', function () {
      setFieldError('tl-name', '');
      el.name.removeAttribute('aria-invalid');
      saveDraft();
    });
    el.date.addEventListener('input', function () {
      setFieldError('work-date', '');
      el.date.removeAttribute('aria-invalid');
      saveDraft();
    });
    el.location.addEventListener('input', saveDraft);
    el.submitBtn.addEventListener('click', submit);
    el.newReport.addEventListener('click', function () {
      show(el.success, false);
      el.name.focus({ preventScroll: true });
    });
    el.signOut.addEventListener('click', signOut);
    el.gateForm.addEventListener('submit', signIn);
    window.addEventListener('online', updateOfflineHint);
    window.addEventListener('offline', updateOfflineHint);
    window.addEventListener('pagehide', flushDraft);
    window.addEventListener('beforeunload', flushDraft);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushDraft();
    });
    updateOfflineHint();

    try {
      var response = await fetch('/api/session', { headers: { 'X-Safe-Haven': '1' } });
      var session = await response.json();
      if (session.authenticated) showApp(session);
      else showGate();
    } catch (err) {
      showGate();
      el.gateError.textContent = 'Could not reach the server. Check your connection.';
      el.gateError.hidden = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

---

## How the pieces fit together

```
GET /                     Express reads public/index.html from disk, then:
                            __CSP_NONCE__                 -> per-request nonce
                            /*__SAFE_HAVEN_BOOTSTRAP__*/  -> window.SAFE_HAVEN = {...}
                          and sends the result with Cache-Control: no-store

GET /styles.css           express.static
GET /app.js               express.static

app.js boot               init() -> buildTopics() from window.SAFE_HAVEN
                                 -> restore() from localStorage
                                 -> render()
                                 -> GET /api/session -> show gate or dashboard

Submit                    validate() -> POST /api/report -> onSuccess()/error
```

### State model

One object drives everything:

```js
state = {
  activeTopic: null,        // id of the open topic, or null
  responses:   {},          // { topicId: [a, b, c] } for EVERY topic, not just the open one
  attempt:     null,        // { id, fingerprint } — idempotency key for submission
  sending:     false        // guards against repeated clicks
}
```

`render()` is the only function that touches topic DOM. Exclusivity falls out of
`activeTopic` being a single value — there is no code path that opens two topics.
Answers are kept for all four topics, which is why collapsing and switching never lose
work.

### Idempotency

`attempt.fingerprint` is `JSON.stringify(payload)`. On submit, if the fingerprint
matches the stored one the same `attempt.id` is reused, so the server recognises a
retry and does not send a second email. If the content changed, a new id is generated,
so a genuinely edited report is not mistaken for a duplicate.

---

## Three fixes that must not be reintroduced

Each of these was a real bug found during testing. They look like harmless details.

**1. `[hidden] { display: none !important }` in `styles.css`.**
`.gate` sets `display: grid`, and an author `display` rule beats the browser
stylesheet's `[hidden] { display: none }`. Without the `!important` rule the sign-in
card stays on screen after signing in, stacked above the dashboard.

**2. The synchronous draft flush on `pagehide` / `beforeunload` / `visibilitychange`.**
Typing is debounced 250 ms. A refresh inside that window lost the last keystrokes.
Structural changes (expand, collapse, submit) call `saveDraft(true)` and write
immediately; the flush covers the rest.

**3. (Backend, `src/pdf.js`, noted here because it is easy to "tidy away".)**
Page footers are drawn after all content via `bufferedPageRange()`. The bottom margin
must be set to `0` around that write and restored afterwards, or PDFKit treats the
footer as overflow and appends a blank page per page — a 7-page report became 14 pages
with the footers on the blanks.

---

## Packaging for a static host (e.g. Zoho Sites)

Measured line lengths, which matter if the target editor hard-wraps long lines:

| File | Longest line | Lines |
| --- | --- | --- |
| `public/index.html` | 101 chars | 102 |
| `public/styles.css` | 106 chars | 376 |
| `public/app.js` | 135 chars | 627 |
| Inlined single-file bundle | **1,378 chars** | 1,220 |

The single long line in a bundle is the injected topic JSON, emitted on one line. It is
the only line over 300 characters. Two things would make it dangerous:

- **Minification.** Collapses `app.js` to one line of roughly 20,000–30,000 characters.
  Do not minify for a host that wraps lines.
- **More topics.** The blob grows linearly: 4 topics ≈ 1,378 chars, 16 ≈ 5,500, 25 ≈ 8,600.
  Pretty-printing it (`JSON.stringify(data, null, 2)`) turns it into ~60 short lines and
  removes the risk entirely.

Other changes a static build needs: inline the CSS and JS, scope all CSS under a
wrapper class so it cannot leak into the host page, drop `__CSP_NONCE__`, point the
four `fetch()` calls at an absolute URL, and add `credentials: 'include'`. The backend
then needs a CORS allowlist and `SameSite=None; Secure` cookies — note that Safari
blocks third-party cookies by default, so cookie auth may fail on iPhones and a bearer
token in `localStorage` is the safer choice for a cross-origin deployment.
