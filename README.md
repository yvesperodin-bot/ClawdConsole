# Safe Haven — Team Leader Daily Reflection

A one-page dashboard where a team leader privately records an end-of-shift
reflection. On submit, the server renders a PDF and emails it to the
supervisor configured on the server.

---

## Quick start

```bash
npm install
cp .env.example .env     # then fill in the values below
npm start                # http://localhost:3000
```

## Settings needed to activate emailing

Everything lives in `.env` on the server. The team leader never types the
supervisor's address or any credential.

| Setting | Required | What it does |
| --- | --- | --- |
| `ACCESS_CODE` | **yes** | Shared code that unlocks the form. Until it is set the form stays locked for everyone. |
| `SESSION_SECRET` | **yes** | Signs the sign-in cookie. Generate with `openssl rand -hex 32`. |
| `SUPERVISOR_EMAIL` | **yes** | Where every report is emailed. |
| `MAIL_FROM` | **yes** | The From address, e.g. `Safe Haven Reports <reports@example.com>`. |
| `SMTP_HOST` | **yes** | Mail server hostname. |
| `SMTP_PORT` | | Default `587`. Use `465` with `SMTP_SECURE=true`. |
| `SMTP_SECURE` | | `true` for implicit TLS (port 465), `false` for STARTTLS (587). |
| `SMTP_USER` / `SMTP_PASS` | | SMTP credentials. Omit both only for a relay that needs no auth. |
| `MAIL_CC` | | Optional second recipient. |
| `REPORT_TIMEZONE` | | IANA zone for the submission timestamp, e.g. `America/New_York`. Default `UTC`. |
| `COOKIE_SECURE` | | Set `true` when served over HTTPS. |
| `TRUST_PROXY` | | Set `true` behind a reverse proxy so rate limits see the real client IP. |
| `MAX_REPORTS_PER_HOUR` | | Reports accepted per IP per hour. Default `12`. |
| `MAX_LOGIN_ATTEMPTS` | | Sign-in attempts per IP per 15 min. Default `10`. |

The server prints which required settings are still missing at startup, and
the dashboard shows a warning if emailing is not configured.

**Gmail / Google Workspace:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`,
`SMTP_SECURE=false`, `SMTP_USER` = the sending account, `SMTP_PASS` = an
[App Password](https://support.google.com/accounts/answer/185833) (not the
account password).

**Microsoft 365:** `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`,
`SMTP_SECURE=false`.

---

## How the form behaves

- **Top fields:** team leader name, work date (defaults to today, editable),
  and an optional job/location.
- **Four topic buttons** start collapsed and available, each showing its name,
  a one-line description, and a dropdown arrow.
- **Opening one topic** reveals its three questions — each question sits
  directly above its own large text box — and greys out and disables the other
  three.
- **Collapsing** the open topic with the same arrow re-enables all four.
- **Answers are kept** for every topic, so collapsing, switching topics, or
  refreshing the page never loses work. Drafts are stored in the browser's
  local storage and flushed immediately when the page is hidden or closed.
- **Only the open topic is submitted.**
- Short answers such as "None today" are accepted; a blank answer is not.

## Reliability

- **Duplicate protection.** The browser attaches a submission id that stays the
  same across retries of the same content. The server remembers completed ids
  (persisted in `data/submissions.json`) and shares in-flight sends, so a double
  click, a browser retry, or a retry after a failure never emails a second copy.
  Changing an answer after a failed send starts a new id, so a genuinely edited
  report is not mistaken for a duplicate.
- **Submit is disabled while sending** and the fields lock, then unlock if the
  send fails.
- **Failures preserve everything.** The draft is only cleared after the email
  service accepts the message. Pressing Submit Report again retries.
- **Offline.** Submitting while offline does not hit the network; the form
  explains that a connection is needed and keeps the draft.

## Protection against unauthorized access and email abuse

- The form and the API are behind a shared access code, exchanged for an
  httpOnly, SameSite=Strict, HMAC-signed session cookie (`SESSION_HOURS`,
  default 12). With no `ACCESS_CODE` set the form is locked, not open.
- Per-IP rate limits on both sign-in and submission.
- API requests require an `X-Safe-Haven` header, which a cross-site page cannot
  send without a CORS preflight this server never grants (CSRF protection).
- Strict Content-Security-Policy with a per-request nonce; no inline styles, no
  third-party scripts, no external fonts or CDNs.
- Field length caps and control-character stripping on all input.
- Credentials and the recipient address are server-side only and never sent to
  the browser.

## The emailed report

Subject: `Safe Haven Daily Reflection — [Work Date] — [Team Leader Name]`

The attached PDF contains the Safe Haven title, the team leader's name and work
date, the job/location when entered, the selected topic, each question followed
by the complete response, the submission timestamp, and a unique report ID
(`SH-YYYYMMDD-XXXXXX`). Long responses wrap within the margins and continue onto
additional pages, with the report ID and page number in the footer of every page.

---

## Project layout

```
server.js              Express app: access control, rate limits, validation, submit
src/topics.js          The four topics and their questions — single source of truth
src/config.js          Environment settings
src/pdf.js             PDF rendering (pdfkit)
src/mailer.js          SMTP delivery (nodemailer)
src/store.js           Duplicate-submission store
public/index.html      The one-page dashboard
public/styles.css      Styling — brand colours are the --brand-* tokens at the top
public/app.js          Accordion behaviour, drafts, validation, submit
scripts/sample-pdf.js  Render a sample PDF to tmp/ without sending mail
scripts/dev-smtp.js    Local SMTP sink for testing (development only)
```

Topic wording lives only in `src/topics.js`. The server validates against it,
builds the PDF from it, and injects it into the page, so editing that one file
updates everything.

Branding: the palette is defined as `--brand-ink`, `--brand-ink-strong`, and
`--brand-wash` at the top of `public/styles.css`. Swap those three values for
the supplied Safe Haven colours; nothing else needs changing.

## Testing without a real mail server

```bash
node scripts/dev-smtp.js 2525        # terminal 1 — writes messages to tmp/inbox/
# in .env: SMTP_HOST=127.0.0.1  SMTP_PORT=2525  SMTP_SECURE=false
npm start                            # terminal 2
npm run check:pdf                    # render a long sample PDF to tmp/
```

## Status of email delivery

PDF generation and email delivery **have been tested end to end** against a
local SMTP server: the message is accepted, the subject matches the required
format, the recipient is the configured supervisor, and the attachment is a
valid multi-page PDF containing the complete responses. Repeated and concurrent
submissions produced exactly one email.

**Before going live you still need to supply real SMTP credentials and the
supervisor's address** in `.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`, `SUPERVISOR_EMAIL`), plus `ACCESS_CODE` and `SESSION_SECRET`.
Delivery against your production mail provider has not been exercised.
