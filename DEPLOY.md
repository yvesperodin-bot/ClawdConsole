# Deploying Safe Haven on your own server

Target: a Linux VPS (Ubuntu/Debian shown), nginx in front for HTTPS, systemd
keeping the app running, Zoho Mail for delivery.

Nothing here asks you to type a password into a chat window, a URL, or a
command line. The one secret — your Zoho mailbox password — is typed once into
a prompt with echo turned off, straight into a file only the service account
can read.

---

## 1. What you need before starting

| Item | Where it comes from | Example |
| --- | --- | --- |
| A hostname pointing at the server | Your DNS | `reflection.safehaven.com` |
| The Zoho mailbox that sends reports | A real mailbox on your domain, or a verified alias on it | `reports@safehaven.com` |
| Its password | Zoho. **If two-factor is on, an app-specific password**, from accounts.zoho.com → Security → App Passwords | — |
| The supervisor's address | You | `supervisor@safehaven.com` |
| Timezone for timestamps | You | `America/New_York` |

Check this in Zoho before you start: **Settings → Mail Accounts → IMAP/SMTP**,
and make sure SMTP access is enabled for that mailbox. A disabled toggle is the
most common cause of an authentication failure.

Your account is a paid custom-domain plan in the US data centre, so:

```
SMTP_HOST=smtppro.zoho.com     # paid custom-domain accounts use smtppro, not smtp
SMTP_PORT=587
SMTP_SECURE=false              # STARTTLS on 587
```

If 587 is blocked by your host, use `SMTP_PORT=465` with `SMTP_SECURE=true`.

---

## 2. Install

```bash
# Node 18 or newer
node -v

sudo adduser --system --group --home /opt/safe-haven safehaven
sudo -u safehaven git clone -b ccr-91e528a8-2g8mr8 \
  https://github.com/yvesperodin-bot/ClawdConsole.git /opt/safe-haven
cd /opt/safe-haven
sudo -u safehaven npm ci --omit=dev
```

## 3. Enter the credentials

```bash
sudo -u safehaven ./scripts/make-env.sh
```

It asks for the mailbox, the password (hidden, entered twice), the supervisor's
address and the timezone. It generates `SESSION_SECRET` and, unless you supply
one, the team leaders' access code — which it prints once at the end. It writes
`/opt/safe-haven/.env` as mode 600 owned by `safehaven`, and `.env` is
gitignored so it can never be committed.

To change a setting later, edit that file and `sudo systemctl restart safe-haven`.

## 4. Verify Zoho accepts the credentials — before going live

```bash
sudo -u safehaven npm run check:mail
```

This connects and authenticates only. On failure it names the likely Zoho
cause (app password needed, SMTP access disabled, wrong host for the plan,
wrong region, From address refused).

Then send a real one to the supervisor:

```bash
sudo -u safehaven npm run check:mail -- --send
```

## 5. Run it

```bash
sudo cp deploy/safe-haven.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now safe-haven
sudo systemctl status safe-haven
journalctl -u safe-haven -f
```

The app binds `127.0.0.1:3000` behind nginx, never the public interface.

## 6. HTTPS

Edit `deploy/nginx.conf` and replace `reflection.example.com` with your
hostname, then:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/safe-haven
sudo ln -s /etc/nginx/sites-available/safe-haven /etc/nginx/sites-enabled/
sudo certbot --nginx -d reflection.safehaven.com
sudo nginx -t && sudo systemctl reload nginx
```

`TRUST_PROXY=true` and `COOKIE_SECURE=true` are already set by the setup
script, which is what you want behind nginx with TLS.

## 7. Hand it to the team leaders

Give them the URL and the access code. They sign in once; the session lasts
12 hours (`SESSION_HOURS`).

---

## Operating notes

**Logs.** `journalctl -u safe-haven -f`. Each accepted report logs its report ID,
topic, PDF size and recipient. No answer text is logged.

**Duplicate protection across restarts.** Completed submission ids are kept in
`/opt/safe-haven/data/submissions.json` (last 500). Keep that file through
upgrades and the protection survives restarts.

**Updating.**

```bash
cd /opt/safe-haven
sudo -u safehaven git pull
sudo -u safehaven npm ci --omit=dev
sudo systemctl restart safe-haven
```

**Backups.** `.env` holds the only secrets; `data/submissions.json` holds the
duplicate record. Reports themselves live in the supervisor's mailbox, not on
the server — nothing on this machine stores an answer after the email is sent.

**If Zoho starts rejecting mail.** Run `npm run check:mail` first; it separates
a credential problem from a network one. Zoho app passwords are revoked when
the account password changes, so a working deployment that suddenly fails to
authenticate usually needs a new app password.

**Sending limits.** Zoho enforces a per-day send limit per mailbox depending on
plan. One report per shift is far below any of them, but if Safe Haven grows to
many crews on one mailbox, move to ZeptoMail (Zoho's transactional service) and
change only the three `SMTP_*` values.
