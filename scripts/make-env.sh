#!/usr/bin/env bash
#
# Creates .env interactively. The Zoho password is read with echo turned off,
# so it never appears on screen, in your shell history, or in any log.
# Defaults are pre-filled for a paid Zoho Mail account on a custom domain in
# the US data centre; press Enter to accept any default shown in [brackets].
#
#   cd /opt/safe-haven && ./scripts/make-env.sh
#
set -euo pipefail

# Anything this script creates is owner-only from the moment it exists.
umask 077

cd "$(dirname "$0")/.."
TARGET=".env"

if [ -e "$TARGET" ]; then
  printf 'A .env already exists here.\n'
  read -r -p 'Replace it? The old one is kept as .env.bak [y/N]: ' reply
  case "$reply" in
    [yY]|[yY][eE][sS]) cp -p "$TARGET" "$TARGET.bak" ;;
    *) printf 'Left the existing .env alone.\n'; exit 0 ;;
  esac
fi

ask() { # ask VAR "Prompt" "default"
  local __var="$1" __prompt="$2" __default="${3:-}" __input=""
  if [ -n "$__default" ]; then
    read -r -p "$__prompt [$__default]: " __input
    __input="${__input:-$__default}"
  else
    while [ -z "$__input" ]; do read -r -p "$__prompt: " __input; done
  fi
  printf -v "$__var" '%s' "$__input"
}

ask_secret() { # ask_secret VAR "Prompt"
  local __var="$1" __prompt="$2" __a="" __b=""
  while :; do
    read -r -s -p "$__prompt: " __a; printf '\n'
    read -r -s -p "Confirm: " __b; printf '\n'
    if [ -z "$__a" ]; then printf 'Cannot be empty.\n'; continue; fi
    if [ "$__a" != "$__b" ]; then printf 'They did not match. Again.\n'; continue; fi
    break
  done
  printf -v "$__var" '%s' "$__a"
}

rand() { openssl rand -hex "${1:-32}"; }

printf '\nSafe Haven — create .env\n\n'

printf 'Mail (Zoho)\n'
ask SMTP_HOST "  SMTP host" "smtppro.zoho.com"
ask SMTP_PORT "  SMTP port" "587"
if [ "$SMTP_PORT" = "465" ]; then SMTP_SECURE=true; else SMTP_SECURE=false; fi
ask SMTP_USER "  Zoho mailbox that sends the reports (full address)"
printf '    If two-factor is on, use an app-specific password from\n'
printf '    accounts.zoho.com > Security > App Passwords — not the account password.\n'
ask_secret SMTP_PASS "  Password for $SMTP_USER (hidden)"
ask MAIL_FROM "  From address (must be that mailbox or a verified alias)" "$SMTP_USER"
printf '\n  Designated supervisor — the one address every report goes to.\n'
printf '  Team leaders never see or choose this.\n'
ask SUPERVISOR_EMAIL "  Supervisor address" "bflores@misafehaven.com"
ask SUPERVISOR_NAME "  Supervisor name (for the To: line)" "Brenda Flores"
printf '\n  Approved recipients. Reports are refused if the supervisor above is\n'
printf '  not on this list, so an unconfirmed address cannot receive live mail.\n'
ask SUPERVISOR_ALLOWLIST "  Approved addresses (comma separated)" "$SUPERVISOR_EMAIL"
read -r -p "  Optional second recipient, cc (blank for none): " MAIL_CC

printf '\nServer\n'
ask PORT "  Port to listen on" "3000"
ask REPORT_TIMEZONE "  Timezone for report timestamps" "America/New_York"

printf '\nAccess\n'
read -r -p "  Access code for team leaders (blank to generate one): " ACCESS_CODE
if [ -z "$ACCESS_CODE" ]; then
  ACCESS_CODE="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  GENERATED_CODE=1
fi
SESSION_SECRET="$(rand 32)"

cat > "$TARGET" <<ENV
# Safe Haven — Team Leader Daily Reflection
# Written by scripts/make-env.sh on $(date -u '+%Y-%m-%d %H:%M UTC')
# Contains credentials. Keep mode 600. Never commit this file.

PORT=$PORT
TRUST_PROXY=true

ACCESS_CODE=$ACCESS_CODE
SESSION_SECRET=$SESSION_SECRET
SESSION_HOURS=12
COOKIE_SECURE=true

SUPERVISOR_EMAIL=$SUPERVISOR_EMAIL
SUPERVISOR_NAME=$SUPERVISOR_NAME
SUPERVISOR_ALLOWLIST=$SUPERVISOR_ALLOWLIST
MAIL_FROM=$MAIL_FROM
MAIL_CC=$MAIL_CC

SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=$SMTP_SECURE
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS

MAX_REPORTS_PER_HOUR=12
MAX_LOGIN_ATTEMPTS=10

ORG_NAME=Safe Haven
REPORT_TIMEZONE=$REPORT_TIMEZONE
ENV

chmod 600 "$TARGET"

printf '\nWrote %s (mode 600).\n' "$(pwd)/$TARGET"
if [ "${GENERATED_CODE:-0}" = "1" ]; then
  printf '\n  Access code for your team leaders: %s\n' "$ACCESS_CODE"
  printf '  This is the only time it is shown. Give it to them directly,\n'
  printf '  or read it back later with: grep ACCESS_CODE .env\n'
fi
printf '\nNext:\n'
printf '  npm run check:mail           verify Zoho accepts the credentials\n'
printf '  npm run check:mail -- --send email a sample report to the supervisor\n\n'
