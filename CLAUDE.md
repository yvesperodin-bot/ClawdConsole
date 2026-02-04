# CLAUDE.md - AI Assistant Guide for Clawd Console

This document provides guidance for AI assistants working with the Clawd Console repository.

## Project Overview

**Repository**: ClawdConsole
**Status**: Active development (Checkpoint E complete)
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

### Checkpoint F: Mock Mode
*Pending*

### Checkpoint G: Final Cleanup
*Pending*

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

---

*This document should be updated as the project evolves.*
