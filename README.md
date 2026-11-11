# Safe Haven — Team Leader Daily Reflection

A one-page dashboard where a team leader privately records an end-of-shift reflection.
On submit, the server renders a PDF and emails it to the supervisor configured on the
server. One crew, one short form, one email per shift.

```
npm install
./scripts/make-env.sh    # prompts for settings; the password is never echoed
npm run check:mail       # confirm the mail server accepts the credentials
npm start                # http://localhost:3000
```

Deploying to a server: **[DEPLOY.md](DEPLOY.md)**.
Handing the project to another developer or AI session: **[CONTINUATION_PROMPT.md](CONTINUATION_PROMPT.md)**.
The dashboard's frontend code, annotated: **[DASHBOARD_CODE.md](DASHBOARD_CODE.md)**.

> **Status:** the application is built and tested. PDF generation and emailing work
> against a local test mail server. **Delivery through Zoho has never been tested**, and
> the app is not yet hosted anywhere. See [Verification status](#verification-status).

---

## How the form behaves

- **Top fields:** team leader name, work date (defaults to today, editable), and an
  optional job/location.
- **Four topic buttons** start collapsed and available, each showing its name, a one-line
  description, and a dropdown arrow.
- **Opening one topic** reveals its three questions — each question sits directly above
  its own large text box — and greys out and disables the other three.
- **Collapsing** the open topic with the same arrow re-enables all four.
- **Answers are kept** for every topic, so collapsing, switching topics, or refreshing
  the page never loses work. Drafts are stored in the browser's local storage and flushed
  immediately when the page is hidden or closed.
- **Only the open topic is submitted.**
- Short answers such as "None today" are accepted; a blank answer is not.

The four topics are Teamwork & Improvement, Communication & Support, Planning & Learning,
and Recognition & Follow-Through. They are defined once in `src/topics.js`, which the
server validates against, builds the PDF from, and injects into the page — so editing
that one file changes the form, the validation and the PDF together.

## The emailed report

Subject: `Safe Haven Daily Reflection — [Work Date] — [Team Leader Name]`

The attached PDF contains the Safe Haven title, the team leader's name and work date, the
job/location when entered, the selected topic, each question followed by the complete
response, the submission timestamp, and a unique report ID (`SH-YYYYMMDD-XXXXXX`). Long
responses wrap within the margins and continue onto additional pages, with the report ID
and page number in the footer of every page.

---

## Configuration

Everything lives in `.env` on the server. Team leaders never type the supervisor's
address or any credential. `.env.example` documents every setting.

### Required

| Setting | What it does |
| --- | --- |
| `ACCESS_CODE` | Shared code that unlocks the form. Until it is set the form stays locked for everyone. |
| `SESSION_SECRET` | Signs the sign-in cookie. Generate with `openssl rand -hex 32`. |
| `SUPERVISOR_EMAIL` | The designated supervisor who receives every report. |
| `MAIL_FROM` | The From address. Must be the authenticated mailbox or a verified alias. |
| `SMTP_HOST` | Mail server hostname. |

### Supervisor assignment

Reports go to one designated supervisor, set by an administrator. There is no recipient
field anywhere in the form, and the address is never sent to the browser.

| Setting | What it does |
| --- | --- |
| `SUPERVISOR_EMAIL` | The designated recipient. Change it and restart to reassign. |
| `SUPERVISOR_NAME` | Display name on the To: line. |
| `SUPERVISOR_ALLOWLIST` | Comma-separated addresses reports are permitted to reach. Leave blank to allow any. |

`SUPERVISOR_ALLOWLIST` is a safety catch. If the designated supervisor is not on it, the
server refuses to send, logs why at startup, and tells the team leader the report could
not be sent — keeping their answers intact. A mistyped or unreviewed address cannot
quietly redirect reports. The check runs again in the mailer immediately before each
send, not only at startup.

This is also how an address stays out of live sending until its owner has confirmed it:
leave it off the allowlist, and the server will refuse to mail there.

### Mail and everything else

| Setting | Default | What it does |
| --- | --- | --- |
| `SMTP_PORT` | `587` | Use `465` with `SMTP_SECURE=true`. |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (465), `false` for STARTTLS (587). |
| `SMTP_USER` / `SMTP_PASS` | — | SMTP credentials. Omit both only for a relay needing no auth. |
| `MAIL_CC` | — | Optional second standing recipient. |
| `REPORT_TIMEZONE` | `UTC` | IANA zone for the submission timestamp. |
| `SESSION_HOURS` | `12` | How long a sign-in lasts. |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS. |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy so rate limits see the real client IP. |
| `MAX_REPORTS_PER_HOUR` | `12` | Reports accepted per IP per hour. |
| `MAX_LOGIN_ATTEMPTS` | `10` | Sign-in attempts per IP per 15 minutes. |
| `PORT` | `3000` | Port to listen on. |
| `ORG_NAME` | `Safe Haven` | Organisation name shown on the page. |

The server prints which required settings are still missing at startup, and the dashboard
shows a warning if emailing is not configured.

### Zoho Mail

A paid custom-domain account uses `SMTP_HOST=smtppro.zoho.com` (the free plan uses
`smtp.zoho.com`), `SMTP_PORT=587`, `SMTP_SECURE=false`. Swap in the regional host for a
non-US data centre (`smtppro.zoho.eu`, `.in`, `.com.au`).

Two things to check in Zoho, because both cause an identical-looking authentication
failure: SMTP access must be enabled under Settings → Mail Accounts → IMAP/SMTP, and if
two-factor is on, `SMTP_PASS` must be an app-specific password from accounts.zoho.com →
Security → App Passwords. Zoho revokes app passwords when the account password changes.

**Gmail / Google Workspace:** `smtp.gmail.com:587`, `SMTP_SECURE=false`, with an
[App Password](https://support.google.com/accounts/answer/185833).
**Microsoft 365:** `smtp.office365.com:587`, `SMTP_SECURE=false`.

---

## Reliability

- **Duplicate protection.** The browser attaches a submission id that stays the same
  across retries of the same content. The server remembers completed ids (persisted in
  `data/submissions.json`) and shares in-flight sends, so a double click, a browser retry,
  or a retry after a failure never emails a second copy. Changing an answer after a failed
  send starts a new id, so a genuinely edited report is not mistaken for a duplicate.
- **Submit is disabled while sending** and the fields lock, then unlock if the send fails.
- **Failures preserve everything.** The draft is cleared only after the email service
  accepts the message. Pressing Submit Report again retries.
- **Offline.** Submitting while offline does not hit the network; the form explains that a
  connection is needed and keeps the draft.

## Security

- The form and the API are behind a shared access code, exchanged for an httpOnly,
  `SameSite=Strict`, HMAC-signed session cookie. With no `ACCESS_CODE` set the form is
  locked, not open.
- Per-IP rate limits on both sign-in and submission.
- API requests require an `X-Safe-Haven` header, which a cross-site page cannot send
  without a CORS preflight this server never grants.
- Strict Content-Security-Policy with a per-request nonce. No inline styles, no
  third-party scripts, no external fonts or CDNs — the browser makes zero outside requests.
- Field length caps and control-character stripping on all input.
- Questions are never taken from the request: the client sends a topic id and three
  strings, and the server pairs them with its own canonical question text.
- Credentials and the recipient address are server-side only and never sent to the browser.

## What is stored

| Data | Where | Persistent |
| --- | --- | --- |
| In-progress draft | Browser local storage | Per-device; cleared after a successful send |
| Session | HMAC cookie | Until it expires |
| Submission metadata | `data/submissions.json` (last 500) | Yes |
| Rate-limit counters | Process memory | No — reset on restart |
| **Report answers and the PDF** | **The supervisor's mailbox only** | — |

There is no database. The PDF is generated, emailed and discarded; no answer text is
stored on the server or written to the log. Logs record only the report ID, topic, PDF
size and recipient. This means **there is currently no way to retrieve a past report**
other than from the supervisor's mailbox.

---

## Verification status

**Tested and passing** — 43 UI checks and 15 failure-path checks in Chromium via
Playwright, plus a local SMTP sink: collapse/expand exclusivity, greying and disabling,
re-enabling on collapse, drafts surviving collapse, switching and refresh, only the active
topic submitted, one request per double-click, offline handling, send failure preserving
answers and draft, retry reusing the same submission id. Eight submission attempts with
one id produced exactly one email; five concurrent produced one. A 7-page sample PDF was
verified complete with correct footers. Designating an address absent from the allowlist
sent zero emails.

**Never verified:** delivery through Zoho — never attempted, because the development
environment had no outbound SMTP. The `deploy/` configs were written but never executed.
Chromium only; no Safari, Firefox or real mobile device. No load or screen-reader testing.

**Known gap:** the test suites are not yet in the repository, so the results above are
real but not reproducible from a clone.

### Checking a real mail setup

```bash
npm run check:mail                   # connect + authenticate only
npm run check:mail -- --send         # email a sample report to the supervisor
```

It prints the resolved settings with the password masked and, on failure, names the likely
cause rather than echoing the raw SMTP error. Its output is safe to paste into a ticket.

### Testing without a real mail server

```bash
node scripts/dev-smtp.js 2525        # terminal 1 — writes messages to tmp/inbox/
# in .env: SMTP_HOST=127.0.0.1  SMTP_PORT=2525  SMTP_SECURE=false
npm start                            # terminal 2
npm run check:pdf                    # render a long sample PDF to tmp/
```

---

## Project layout

```
server.js              Express app: access control, rate limits, validation, submit
src/topics.js          The four topics and their questions — single source of truth
src/config.js          Environment settings and derived flags
src/pdf.js             PDF rendering (pdfkit)
src/mailer.js          SMTP delivery (nodemailer)
src/store.js           Duplicate-submission store
public/index.html      The one-page dashboard
public/styles.css      Styling — brand colours are the --brand-* tokens at the top
public/app.js          Accordion behaviour, drafts, validation, submit
scripts/make-env.sh    Interactive .env setup; takes the password without echoing it
scripts/check-mail.js  Verify SMTP credentials, optionally send a sample report
scripts/sample-pdf.js  Render a sample PDF to tmp/ without sending mail
scripts/dev-smtp.js    Local SMTP sink for testing (development only)
deploy/                systemd unit and nginx config for a VPS
```

Node.js 18 or newer. Four direct dependencies: express, pdfkit, nodemailer, dotenv. No
build step, no bundler, no framework.

Branding: the palette is `--brand-ink`, `--brand-ink-strong` and `--brand-wash` at the top
of `public/styles.css`. Swap those three values for the supplied Safe Haven colours;
nothing else needs changing.
