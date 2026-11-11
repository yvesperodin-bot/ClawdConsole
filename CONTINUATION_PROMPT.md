# Continuation prompt — Safe Haven Daily Reflection

Copy everything below the line into a new AI session to pick this project up.
It is written to be read by an assistant that has never seen this codebase.

---

You are continuing work on **Safe Haven — Team Leader Daily Reflection**, a small
internal web application. Read this whole brief before proposing or writing anything.

## What the application is

A Safe Haven team leader privately fills in one short reflection at the end of a shift.
The server renders it as a PDF and emails it to a designated supervisor, who reviews it
for accountability, coaching and follow-through. There is one crew today.

The form is one page:

- Team leader name; work date (defaults to today, editable); optional job/location.
- Four collapsed topic buttons, each with a name, a one-line description and a dropdown
  arrow. Opening one reveals its three questions — each question sits directly above its
  own large textarea — and **greys out and disables the other three**. Collapsing the open
  topic re-enables all four. Answers are kept for every topic, so collapsing, switching
  and refreshing never lose work. Only the open topic is submitted.
- A Submit Report button below the third question of the open topic.

The four topics are **Teamwork & Improvement**, **Communication & Support**,
**Planning & Learning**, and **Recognition & Follow-Through**. Each has exactly three
questions. They are defined once in `src/topics.js` and injected into the page by the
server, so that file is the single source of truth for the form, the validation and the
PDF. The exact wording is fixed and is not yours to change.

## Where the code is

- **Repository:** `yvesperodin-bot/ClawdConsole`
- **Branch:** `ccr-91e528a8-2g8mr8` — all work goes here, never to `main`
- **Last commit at handoff:** `b41ab7a`

If you cannot clone the repository, the frontend is reproduced in full in
`DASHBOARD_CODE.md`, and `README.md` and `DEPLOY.md` cover setup and deployment.

## Stack

Node.js ≥18, Express 4, PDFKit (PDF), Nodemailer (SMTP), dotenv. Four direct
dependencies. The frontend is plain HTML, CSS and ES5-style JavaScript in an IIFE.
**No build step, no bundler, no framework, no TypeScript, no CSS preprocessor, and no
external requests from the browser** — no CDN, no web fonts, no analytics. Keep it that
way unless the user asks otherwise; the simplicity is deliberate.

```
server.js          Express: routes, auth, rate limiting, validation, submit pipeline
src/topics.js      4 topics x 3 questions — single source of truth
src/config.js      Environment parsing and derived flags
src/pdf.js         PDFKit rendering
src/mailer.js      Nodemailer transport and message assembly
src/store.js       Duplicate-submission ledger
public/            index.html, styles.css, app.js
scripts/           make-env.sh, check-mail.js, sample-pdf.js, dev-smtp.js
deploy/            systemd unit, nginx config
```

`npm start` runs it on port 3000. In production, systemd runs it as an unprivileged user
behind nginx, which terminates TLS; the app binds `127.0.0.1` only.

## How it works, briefly

**Frontend.** `state = { activeTopic, responses, attempt, sending }`. `render()` is the
only function that touches topic DOM; single-topic exclusivity falls out of `activeTopic`
being one value. Answers live in `state.responses` for all four topics. Drafts persist to
`localStorage` under `safeHaven.reflection.draft.v1`, debounced 250 ms for typing and
flushed synchronously on `pagehide`/`beforeunload`/`visibilitychange`. Four `fetch` calls:
`/api/session`, `/api/login`, `/api/logout`, `/api/report`, each sending `X-Safe-Haven: 1`.

**Backend.** Sign-in exchanges a shared access code for a stateless HMAC-signed,
httpOnly, `SameSite=Strict` cookie — no session store. Every API route requires the
`X-Safe-Haven` header, which a cross-origin page cannot send without a CORS preflight
that is never granted; that is the CSRF defense. Per-IP rate limits: 10 sign-ins per
15 min, 12 reports per hour. Submissions carry a client-generated `submissionId`; the
server keeps completed ids in `data/submissions.json` and shares in-flight promises, so
repeated clicks, retries and concurrent requests produce exactly one email. Report ids
look like `SH-20261108-7A31CD`.

**Questions are never taken from the request.** The client sends `topicId` plus three
strings; the server pairs them with its own canonical question text.

**Nothing is retained.** The PDF is generated, emailed, and discarded. `data/submissions.json`
holds only metadata — ids, name, date, topic, timestamp, message id, byte count. No answer
text is stored or logged. There is no database, no archive and no way to retrieve a past
report except from the supervisor's mailbox.

## Recipient configuration — read carefully

Reports go to one designated supervisor set by an administrator. **Team leaders never see
or choose a recipient**; there is no recipient field anywhere in the form and the address
is never sent to the browser. Three settings:

- `SUPERVISOR_EMAIL` — the designated recipient
- `SUPERVISOR_NAME` — display name on the To: line
- `SUPERVISOR_ALLOWLIST` — addresses reports are permitted to reach

If the designated supervisor is not on the allowlist the server refuses to send, logs the
reason at startup, and tells the team leader the report could not be sent while keeping
their answers. The check runs again in the mailer immediately before dispatch.

Current configuration: **Brenda Flores `<bflores@misafehaven.com>` is the designated
supervisor and the only approved recipient.** **Yves Perodin `<yperodin@misafehaven.com>`
is deliberately excluded** — he has not confirmed his address for live sending. Do not add
it to the allowlist unless the user explicitly confirms.

## Verification status — be precise about this

**Tested and passing** (Chromium via Playwright, plus a local SMTP sink):

- 43 UI checks: collapse/expand exclusivity, greying and disabling, re-enabling on
  collapse, drafts surviving collapse/switch/refresh, only the active topic submitted,
  one request per double-click, success and reset behaviour, no horizontal scroll at
  390 px or 1180 px.
- 15 failure-path checks: offline handling, send failure preserving answers and draft,
  retry succeeding and reusing the same submission id.
- PDF: 7-page sample verified complete, correct footers, nothing clipped.
- 8 submission attempts with one id produced exactly 1 email; 5 concurrent produced 1.
- Recipient guard: designating the unapproved address sent 0 emails.

**Never verified:**

- **Zoho SMTP delivery.** Never attempted — the development container had no outbound
  SMTP. `smtppro.zoho.com:587` STARTTLS is a documented expectation, not a tested fact.
- `deploy/nginx.conf` and `deploy/safe-haven.service` were written but never executed.
- Chromium only. No Safari, Firefox, or real iOS/Android device.
- No concurrent multi-user or load testing. No screen-reader testing.

**Known gap:** the test suites were written in a scratch directory and are **not in the
repository**. The results above are real but not reproducible from a clone. Committing
them is useful unfinished work.

## Three fixes that must not be reintroduced

Each was a real bug. They look like harmless details.

1. **`[hidden] { display: none !important }`** in `styles.css`. `.gate` sets
   `display: grid`, which beats the browser's `[hidden]` rule, so without this the
   sign-in card stays on screen after signing in.
2. **The synchronous draft flush** on `pagehide`/`beforeunload`/`visibilitychange`. A
   refresh within the 250 ms debounce window used to lose the last keystrokes.
3. **The bottom-margin guard in `src/pdf.js`** around the footer write. Without setting
   `doc.page.margins.bottom = 0` and restoring it, PDFKit treats each footer as overflow
   and appends a blank page — a 7-page report became 14 with footers on the blanks.

## Open decisions that need the user, not you

Do not decide these yourself; ask.

1. Hostname for the app — no value chosen yet.
2. Whether outbound SMTP (port 587) is open from the VPS. This blocks everything else.
3. The real Zoho sending mailbox, and confirmation of host/port/TLS.
4. Whether two-factor is on for that mailbox (decides app-specific password).
5. Confirmation of Yves's address for live sending.
6. Embed the form in Zoho Sites, or host it on its own subdomain and link to it.
7. Zoho Creator as a database — recommended as a later phase, after live email works.
8. Retention policy: today answer text exists only in a mailbox. Storing it is a
   governance decision as much as a technical one.

## If Zoho Sites packaging comes up

The frontend ports well — no framework, no build, no external requests — but it cannot be
the whole application: PDFKit and Nodemailer are Node-only, so **a backend must keep
running**. A previous Safe Haven Zoho Sites deployment was reportedly corrupted by
~10,000-character hard line breaks. Measured here: the longest line in any source file is
135 characters, and an inlined single-file bundle has exactly one line over 300 — the
topic JSON at 1,378 characters. Minifying would collapse `app.js` to 20,000–30,000
characters on one line and reproduce that failure. Do not minify; pretty-print the topic
blob instead. `DASHBOARD_CODE.md` has the full analysis.

The simplest safe deployment is a subdomain running the existing app unchanged, linked
from Zoho Sites. Embedding requires CORS, `SameSite=None` cookies (which Safari blocks by
default, so likely a move to bearer tokens), and CSS scoping.

## How to work on this

- Work on branch `ccr-91e528a8-2g8mr8`. Commit with clear messages. Do not push to `main`.
- Never put credentials in code, chat or a command line. `.env` is gitignored and must
  stay that way. `scripts/make-env.sh` takes the password with echo off; use it.
- Do not change the topics, the questions, the layout, or the single-topic-at-a-time
  behaviour without being asked. The user is still evaluating the design.
- Keep server-side validation authoritative. Client-side validation is for UX only.
- When you report status, distinguish what you tested from what you assume. The user has
  asked for that distinction explicitly and repeatedly.
- `npm run check:mail` verifies SMTP credentials and prints them with the password masked;
  `npm run check:mail -- --send` emails a real sample report. `npm run check:pdf` renders a
  long sample PDF without sending anything.
