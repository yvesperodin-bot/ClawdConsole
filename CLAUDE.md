# CLAUDE.md - AI Assistant Guide for Clawd Console

This document provides guidance for AI assistants working with the Clawd Console repository.

## Project Overview

**Repository**: ClawdConsole
**Status**: Active development (Checkpoint G complete)
**Purpose**: Local-first AI control interface for ClawdBot

### Non-Negotiable Principles

1. **Offline-first by default** - No internet access required
2. **Human-in-the-loop** - All actions must be proposed → approved → logged
3. **Local-only** - localhost communication only, no telemetry
4. **Explainability** - UI explains what is happening, no jargon
5. **Security by design** - Workspace jail enforced, audit trail for everything

## Repository Structure

```
ClawdConsole/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   ├── schema.sql         # SQLite schema
│   │   │   └── db.ts              # Database operations
│   │   ├── routes/
│   │   │   ├── setup.ts           # Setup wizard API
│   │   │   ├── status.ts          # Dashboard status API
│   │   │   ├── chat.ts            # Conversations API
│   │   │   ├── actions.ts         # Action approval API
│   │   │   ├── security.ts        # Security profiles API
│   │   │   └── logs.ts            # Audit log API
│   │   ├── middleware/
│   │   │   └── workspaceJail.ts   # Path security enforcement
│   │   ├── services/
│   │   │   ├── clawdbot.ts        # ClawdBot communication
│   │   │   └── localAI.ts         # Ollama/LM Studio detection
│   │   └── index.ts               # Express server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.tsx         # App layout with sidebar
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Status overview
│   │   │   ├── Chat.tsx           # Local AI chat
│   │   │   ├── Approvals.tsx      # Action approval panel
│   │   │   ├── Logs.tsx           # Audit trail viewer
│   │   │   ├── Security.tsx       # Security profiles
│   │   │   ├── Integrations.tsx   # AI provider config
│   │   │   ├── Settings.tsx       # App settings
│   │   │   ├── SetupWizard.tsx    # First-run setup orchestrator
│   │   │   └── setup/             # Setup wizard step components
│   │   │       ├── types.ts       # Shared types
│   │   │       ├── StepWelcome.tsx
│   │   │       ├── StepEnvironment.tsx
│   │   │       ├── StepWorkspace.tsx
│   │   │       ├── StepClawdBot.tsx
│   │   │       ├── StepLocalAI.tsx
│   │   │       ├── StepSecurity.tsx
│   │   │       ├── StepPin.tsx
│   │   │       ├── StepHealth.tsx
│   │   │       ├── StepComplete.tsx
│   │   │       └── index.ts       # Exports
│   │   ├── services/
│   │   │   └── api.ts             # Fetch wrapper (local only)
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript types
│   │   ├── App.tsx                # Router setup
│   │   ├── main.tsx               # Entry point
│   │   └── index.css              # Global styles
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── package.json                    # Root workspace runner
├── .gitignore
├── README.md
└── CLAUDE.md
```

## Build & Development

### Prerequisites

- Node.js >= 18.0.0

### Setup

```bash
# Clone and install
git clone <repository-url>
cd ClawdConsole
npm run install:all
```

### Running the Project

```bash
# Development (runs both backend and frontend)
npm run dev

# Backend only (localhost:3001)
npm run dev:backend

# Frontend only (localhost:5173)
npm run dev:frontend
```

### URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api
- API proxy: Frontend /api/* → Backend

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI Style | Clean, minimal, desktop-like |
| Backend | Node.js + Express |
| Database | SQLite (local file) |
| Routing | React Router v6 |

## Key Components

### Backend Services

- **db.ts**: All SQLite operations (setup state, conversations, actions, logs)
- **workspaceJail.ts**: Path validation, blocks traversal and system directories
- **clawdbot.ts**: Communication with ClawdBot at localhost:7331
- **localAI.ts**: Detects Ollama (11434) and LM Studio (1234)

### Frontend Services

- **api.ts**: Fetch wrapper using relative paths only (/api/*)
- **Layout.tsx**: Sidebar navigation + header + content area
- **Pages**: Placeholder components for each route

## API Endpoints

| Route | Purpose |
|-------|---------|
| `/api/setup/*` | Setup wizard state |
| `/api/status/*` | Dashboard status |
| `/api/chat/*` | Conversations and messages |
| `/api/actions/*` | Pending action approval |
| `/api/security/*` | Security profile management |
| `/api/logs/*` | Audit log access |

## Security Profiles

| Profile | Network | External AI | Risk |
|---------|---------|-------------|------|
| AIR_GAPPED (default) | No | No | LOW |
| LOCAL_ONLY | No | No | LOW |
| CONNECTED | Allow-list | With approval | MEDIUM |
| POWER_USER | Full | Full | HIGH |

## Development Guidelines

### Code Style

- TypeScript strict mode
- Functional components with hooks
- No external network calls in frontend (use /api/* proxy)
- All file access through workspace jail

### For AI Assistants

1. **Read files before modifying**
2. **Never add cloud/telemetry/analytics**
3. **All actions require human approval**
4. **Keep UI language calm and non-technical**
5. **Log all security-relevant events**

---

## Checkpoint Progress

### Checkpoint A: Backend Entrypoint + Run Scripts ✓
- Express server on localhost:3001
- Root package.json with dev/build scripts
- SQLite database initialization

### Checkpoint B: Frontend Shell + Routing ✓
**What changed:**
- Added react-router-dom for routing
- Created Layout.tsx with sidebar navigation and header
- Created 7 placeholder pages (Dashboard, Chat, Approvals, Logs, Security, Integrations, Settings)
- Added api.ts fetch wrapper (relative paths only)
- Added types/index.ts with TypeScript definitions
- Added index.css with clean, desktop-like styles

**Files added/updated:**
- `frontend/src/components/Layout.tsx`
- `frontend/src/pages/*.tsx` (7 files)
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/index.css`
- `frontend/src/App.tsx` (updated with routes)
- `frontend/src/main.tsx` (added CSS import)

**How to run:**
```bash
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

**Verified working:**
- Routing works (all 7 pages accessible)
- Sidebar navigation active states
- No external network calls
- TypeScript compiles without errors

### Checkpoint C: SQLite Wiring + API Integration ✓
**What changed:**
- Added `app_settings` table to SQLite schema
- Added `getSetting`, `setSetting`, `getAllSettings` functions to db.ts
- Added `/api/health` endpoint returning `{ ok, version, uptime }`
- Reduced ClawdBot health check timeout to 1000ms (fast fail)
- Dashboard now fetches live status from `/api/status`
- Layout header shows live connection indicators (Server, ClawdBot, Network)
- Added CSS for status grid display

**Files added/updated:**
- `backend/src/database/schema.sql` (added app_settings table)
- `backend/src/database/db.ts` (added settings functions)
- `backend/src/services/clawdbot.ts` (reduced timeout to 1000ms)
- `backend/src/index.ts` (added /api/health, fixed PORT type)
- `frontend/src/pages/Dashboard.tsx` (live status display)
- `frontend/src/components/Layout.tsx` (live header indicators)
- `frontend/src/index.css` (status grid styles)

**How to run:**
```bash
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

**Verified working:**
- SQLite database created at `backend/clawd_console.db`
- `/api/health` returns `{ ok: true, version: "1.0.0", uptime: N }`
- `/api/status` returns ClawdBot status, network state, profile, workspace
- Dashboard displays live status with auto-refresh (10s)
- Header shows green/red dots for Server and ClawdBot status
- All API calls use relative /api/* paths (through Vite proxy)
- Localhost-only: backend binds to 127.0.0.1:3001

### Checkpoint D: First-Run Setup Wizard UI + Persistence ✓
**What changed:**
- Added multi-step Setup Wizard with 9 steps:
  1. Welcome & explanation
  2. Environment check (OS, RAM, disk)
  3. Workspace selection with validation
  4. ClawdBot detection
  5. Local AI detection (Ollama/LM Studio)
  6. Security profile selection
  7. Optional Admin PIN setup
  8. Health check
  9. Completion confirmation
- Added `/api/setup/state` endpoint for wizard state
- Added `/api/setup/pin/verify` endpoint for PIN verification
- Added `/api/setup/run-health-check` endpoint
- App redirects to `/setup` if setup not complete
- Settings page has "Re-run Setup Wizard" button
- PIN required to reset if admin PIN was set
- All wizard data persisted to SQLite (setup_state + app_settings)

**Files added/updated:**
- `frontend/src/pages/SetupWizard.tsx` (new - 700+ lines)
- `frontend/src/pages/Settings.tsx` (updated with re-run button)
- `frontend/src/App.tsx` (setup state check + redirect)
- `frontend/src/index.css` (wizard styles, dialog styles)
- `backend/src/routes/setup.ts` (added state/pin/health endpoints)

**How to run:**
```bash
npm run dev
# First run: redirects to http://localhost:5173/setup
# After setup: http://localhost:5173
```

**Verified working:**
- Fresh start shows setup wizard (mandatory)
- All 9 wizard steps navigate correctly
- Workspace path validation works
- Security profile selection works
- PIN setup (optional) works with bcrypt hashing (upgraded from SHA-256 in E)
- Setup completion stores all settings
- Re-run setup from Settings page works
- PIN required for reset if PIN was set
- TypeScript compiles without errors
- No external network calls

### Checkpoint E: Dashboard + Chat + Actions + Security + Logs UI ✓
**What changed:**

**Part A - SetupWizard Refactoring:**
- Extracted 9 step components into `frontend/src/pages/setup/` directory
- Created shared `types.ts` with interfaces for wizard data
- SetupWizard.tsx now a thin orchestrator (imports from ./setup)
- No behavior changes, improved maintainability

**Part B - PIN Security Upgrade:**
- Replaced SHA-256 with bcrypt (10 rounds) for admin PIN hashing
- Added automatic migration: legacy SHA-256 hashes upgraded to bcrypt on next verification
- Added `updateSetupPinHash()` function to db.ts
- Backend routes now use async handlers for bcrypt

**E1 - Enhanced Dashboard:**
- Shows current security profile with risk level badge
- Displays workspace path with explanation
- Shows last health check timestamp (relative time)
- Local AI status display (Ollama/LM Studio)
- Run Health Check button
- Pending approvals preview card (when actions pending)

**E2 - Chat UI:**
- Conversation sidebar with list/create/delete
- Main chat area with message history
- Message input with Enter-to-send
- Optimistic UI updates for sending
- Error handling with system messages
- Safety notice banner

**E3 - Action Approval Panel:**
- List of pending actions with risk indicators
- Expandable action cards showing target/preview
- Approve and Deny buttons
- Action history table (toggle view)
- Auto-refresh every 5 seconds

**E4 - Security Profiles Page:**
- Current profile display with permissions grid
- All 4 profiles shown in card grid
- PIN gate for profile changes
- Confirmation dialog for risk upgrades
- Warning messages for high-risk profiles

**E5 - Logs UI:**
- Stats cards (total events, 24h alerts, high risk count)
- Filter by category and risk level
- Expandable log entries with JSON details
- Export to JSON and CSV
- Clickable rows to expand details

**Files added:**
- `frontend/src/pages/setup/*.tsx` (10 component files)
- `frontend/src/pages/setup/types.ts`
- `frontend/src/pages/setup/index.ts`

**Files updated:**
- `backend/package.json` (added bcrypt)
- `backend/src/routes/setup.ts` (bcrypt, async handlers)
- `backend/src/routes/status.ts` (lastHealthCheckAt)
- `backend/src/database/db.ts` (updateSetupPinHash)
- `frontend/src/pages/SetupWizard.tsx` (refactored)
- `frontend/src/pages/Dashboard.tsx` (enhanced)
- `frontend/src/pages/Chat.tsx` (full implementation)
- `frontend/src/pages/Approvals.tsx` (full implementation)
- `frontend/src/pages/Security.tsx` (full implementation)
- `frontend/src/pages/Logs.tsx` (full implementation)
- `frontend/src/index.css` (many new styles)

**How to run:**
```bash
npm run dev
# Complete setup wizard on first run
# Then explore Dashboard, Chat, Approvals, Security, Logs
```

**Verified working:**
- SetupWizard refactored into 10 components
- PIN hashing upgraded to bcrypt with migration
- Dashboard shows all status info
- Chat creates/displays conversations and messages
- Approvals shows pending actions with approve/deny
- Security shows profiles with PIN-protected switching
- Logs displays filterable audit trail with export
- TypeScript compiles without errors
- All APIs use relative /api/* paths

### Checkpoint F: ClawdBot Integration + Action Persistence ✓
**What changed:**

**F1 - ClawdBot Client Rewrite:**
- Complete rewrite of `clawdbot.ts` with strict API contract
- Endpoints: GET /health, POST /chat, POST /actions/approve, POST /actions/deny
- Proper timeouts: 1000ms health, 5000ms chat, 10000ms action execution
- Type definitions: `ProposedAction`, `ClawdBotChatResponse`, `ClawdBotActionResult`
- Friendly error messages for common connection issues

**F2 - Chat Route Integration:**
- Messages forwarded to ClawdBot when reachable
- Graceful offline mode with calm system messages
- proposedActions from ClawdBot persisted to pending_actions table
- Path validation for file operations before persisting

**F3 - Database Schema Updates:**
- Added `clawd_action_id` to link Console actions to ClawdBot actions
- Added `result_summary` to store execution results
- Added `deny_reason` to store denial reasons
- New functions: `getPendingAction()`, `approveActionWithResult()`, `denyActionWithReason()`

**F4 - Frontend Integration:**
- Chat.tsx shows proposed actions banner when actions pending
- Link to Approvals page from chat
- ClawdBot availability status indicator
- Approvals.tsx shows PIN dialog for command actions
- Approvals history shows result_summary and deny_reason
- Result notification after successful action execution

**F5 - Security Checks (Non-negotiable):**
- FILE_* actions: Workspace jail validation
- RUN_COMMAND: Requires POWER_USER profile + PIN verification
- NETWORK_REQUEST: Requires CONNECTED profile
- All security violations logged to audit trail
- Actions auto-denied if security checks fail

**Files updated:**
- `backend/src/services/clawdbot.ts` (complete rewrite)
- `backend/src/database/schema.sql` (added 3 new fields)
- `backend/src/database/db.ts` (added 3 new functions)
- `backend/src/routes/chat.ts` (ClawdBot integration)
- `backend/src/routes/actions.ts` (security-gated approval)
- `frontend/src/pages/Chat.tsx` (proposed actions banner)
- `frontend/src/pages/Approvals.tsx` (PIN dialog, results display)
- `frontend/src/index.css` (new component styles)

**API Contract with ClawdBot (localhost:7331):**
```
GET  /health                -> { ok, version? }
POST /chat                  -> { conversationId, response, proposedActions?[] }
POST /actions/approve       -> { ok, resultSummary, updatedFiles? }
POST /actions/deny          -> { ok }
```

**Security Flow:**
1. ClawdBot proposes action via chat response
2. Console persists to pending_actions with clawd_action_id
3. User reviews in Approvals page
4. On approve: security checks → profile validation → PIN if command → forward to ClawdBot
5. On deny: reason stored → best-effort forward to ClawdBot
6. All steps logged to audit trail

**How to run:**
```bash
npm run dev
# Chat with ClawdBot, review proposed actions in Approvals
# Without ClawdBot: offline mode with calm messaging
```

**Verified working:**
- ClawdBot integration with strict API contract
- proposedActions persisted from chat responses
- Security-gated action approval (workspace jail, profiles, PIN)
- Frontend shows proposed actions and results
- TypeScript compiles without errors
- All security checks enforced

### Checkpoint G: Hardening + UX Polish + Packaging Readiness ✓
**What changed:**

**G1 - Repository Hygiene:**
- Enhanced `.gitignore` with comprehensive exclusions
- Verified no artifacts (node_modules, dist, db) committed
- All tracked files are source code only

**G2 - Reliability + Rate Limits:**
- Added in-flight locks for chat messages (per conversation)
- Added in-flight locks for action approvals (per action)
- Prevents double-send/double-approve from rapid clicks
- Locks auto-expire after 30 seconds
- Returns friendly "Already processing…" response

**G3 - Stronger Path Validation:**
- URL-encoded traversal detection (`%2e%2e`)
- UNC path rejection (`\\server\share`)
- Symlink escape detection (realpath resolution)
- Mixed slash normalization
- Added unit tests for workspace jail edge cases

**G4 - Security Posture Report:**
- New endpoint: `GET /api/security/report`
- Returns: active profile, workspace, PIN status, allowlists, 24h stats
- Frontend: "View Security Posture Report" modal in Security page
- Export to JSON functionality

**G5 - Approvals UX Improvements:**
- "What happens when you approve" explanation per action type
- Dangerous action warnings (red callout for commands)
- Toast notifications after approve/deny
- Auto-focus on next pending action
- Warning-colored approve button for high-impact actions

**G6 - Documentation Polish:**
- Added comprehensive README.md at repo root
- Added Release Checklist section (below)
- Added Threat Model Summary section (below)

**Files added:**
- `backend/src/middleware/workspaceJail.test.ts` (unit tests)

**Files updated:**
- `.gitignore` (enhanced exclusions)
- `backend/src/routes/chat.ts` (in-flight locks)
- `backend/src/routes/actions.ts` (in-flight locks)
- `backend/src/routes/security.ts` (report endpoint)
- `backend/src/middleware/workspaceJail.ts` (stronger validation)
- `frontend/src/pages/Security.tsx` (report dialog)
- `frontend/src/pages/Approvals.tsx` (UX improvements)
- `frontend/src/index.css` (new component styles)
- `README.md` (full documentation)
- `CLAUDE.md` (this file)

**Verified working:**
- TypeScript compiles without errors
- No artifacts in git
- In-flight locks prevent double operations
- Security report generates and exports
- Approvals show explanations and toasts
- Documentation complete

### Checkpoint H: Windows-Friendly Shipping Experience ✓
**What changed:**

**H1 - Production Run Mode:**
- Backend now serves built frontend as static files in production mode
- Added `npm run start:prod` for production mode (NODE_ENV=production)
- Frontend build served at http://localhost:3001 (single port)
- CORS only enabled in development mode (Vite proxy)
- SPA fallback for client-side routing

**H2 - Double-Click Launchers:**
- `scripts/run.cmd` - Windows launcher (double-click to start)
- `scripts/run.ps1` - PowerShell script with:
  - Node.js detection with friendly install instructions
  - Dependency check with redirect to install.cmd
  - Port-in-use detection with helpful message
  - Auto-open browser after startup
  - Log rotation (keeps last 5 logs in logs/ folder)
- `scripts/install.cmd` - One-time setup launcher
- `scripts/install.ps1` - PowerShell installer that:
  - Installs all dependencies (npm ci or npm install)
  - Builds the application
  - Provides clear success/failure messages

**H3 - Data Directory Standardization:**
- Database moved to `backend/data/clawd_console.db`
- Data directory auto-created on first run
- CLAWD_DATA_DIR env var override supported
- Works correctly when started from any directory

**H4 - Offline/USB Install Documentation:**
- Created `docs/OFFLINE_INSTALL.md` with:
  - Recommended (Most Users) path: pre-built transfer
  - Advanced paths: npm cache strategy, minimal transfer, direct node
  - Troubleshooting section
  - Security notes

**H5 - README Getting Started Update:**
- Recommended lane now uses double-click workflow
- Step 1: Install Node.js (one time)
- Step 2: Double-click install.cmd
- Step 3: Double-click run.cmd
- Advanced lane preserved for developers
- Added link to offline install docs

**H6 - Documentation:**
- Updated CLAUDE.md with Checkpoint H
- Updated architecture diagram with scripts/ and docs/

**Files added:**
- `scripts/run.cmd` (Windows launcher)
- `scripts/run.ps1` (PowerShell runner)
- `scripts/install.cmd` (Setup launcher)
- `scripts/install.ps1` (PowerShell installer)
- `docs/OFFLINE_INSTALL.md` (Offline installation guide)

**Files updated:**
- `backend/src/index.ts` (static file serving, production mode)
- `backend/src/database/db.ts` (data directory, CLAWD_DATA_DIR)
- `package.json` (start:prod script, cross-env dependency)
- `.gitignore` (data directory, logs directory)
- `README.md` (two-lane Getting Started)
- `CLAUDE.md` (this file)

**Verified working:**
- Production mode runs without Vite
- Double-click launchers work
- Database created under backend/data/
- Backend binds to 127.0.0.1 only
- No external network calls
- Friendly error messages (no stack traces)

---

## Release Checklist

Before releasing, verify the following:

- [ ] **Offline Mode**: App works without internet connection
- [ ] **Localhost Binding**: Backend only binds to 127.0.0.1:3001
- [ ] **No Telemetry**: No analytics, tracking, or external calls
- [ ] **Setup Wizard**: First-run wizard completes successfully
- [ ] **Actions Gate**: No action executes without user approval
- [ ] **Workspace Jail**: File operations restricted to workspace
- [ ] **PIN Protection**: Admin PIN protects sensitive operations
- [ ] **Audit Trail**: All security events logged
- [ ] **Build Clean**: `npm run build` succeeds with no warnings
- [ ] **No Secrets**: No credentials, keys, or .env files committed

---

## Threat Model Summary

### Trust Boundaries

Clawd Console operates within a local-first trust model:

1. **User → Console**: Full trust. The user controls all settings, approves all actions, and has physical access to the machine.

2. **Console → ClawdBot**: Partial trust. ClawdBot (localhost:7331) can propose actions, but every action must pass through the Console's security checks and user approval before execution.

3. **Console → File System**: Restricted. All file operations are confined to the user-configured workspace directory. System directories, sensitive files, and symlink escapes are blocked.

4. **Console → Network**: Profile-controlled. Network access is blocked by default (AIR_GAPPED profile). Only CONNECTED and POWER_USER profiles allow network operations, and only with explicit approval.

### Key Mitigations

- **Human-in-the-loop**: No AI action executes automatically. Every proposed action requires explicit user approval.

- **Workspace jail**: Path traversal, UNC paths, symlink escapes, and system directory access are blocked at the middleware level.

- **Security profiles**: Risk is tiered. Users must consciously upgrade to higher-risk profiles, with warnings and PIN verification.

- **PIN gating**: Critical operations (command execution, profile upgrades, setup reset) require admin PIN when configured.

- **Audit logging**: Every security-relevant event is logged with timestamp, category, and risk level for forensic review.

### Out of Scope

This version does not protect against:
- Physical access attacks (user has full machine access)
- Malicious ClawdBot implementations (trust extends to localhost:7331)
- Supply chain attacks on npm dependencies (standard Node.js risk)
- Memory-level attacks (SQLite data is not encrypted at rest)

For production deployments, consider additional hardening based on your threat model.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-04 | Initial CLAUDE.md created | AI Assistant |
| 2026-02-04 | Checkpoint A: Backend + run scripts | AI Assistant |
| 2026-02-04 | Checkpoint B: Frontend shell + routing | AI Assistant |
| 2026-02-04 | Checkpoint C: SQLite wiring + API integration | AI Assistant |
| 2026-02-04 | Checkpoint D: First-Run Setup Wizard | AI Assistant |
| 2026-02-04 | Checkpoint E: Full UI implementation + bcrypt | AI Assistant |
| 2026-02-05 | Checkpoint F: ClawdBot integration + action persistence | AI Assistant |
| 2026-02-05 | Checkpoint G: Hardening + UX polish + packaging readiness | AI Assistant |
| 2026-02-05 | Checkpoint H: Windows-friendly shipping experience | AI Assistant |

---

*This document should be updated as the project evolves.*
