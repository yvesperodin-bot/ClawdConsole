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
