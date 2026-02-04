# CLAUDE.md - AI Assistant Guide for Clawd Console

This document provides guidance for AI assistants working with the Clawd Console repository.

## Project Overview

**Repository**: ClawdConsole
**Status**: Active development (Checkpoint B complete)
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
│   │   │   └── Settings.tsx       # App settings
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

### Checkpoint D: First-Run Setup Wizard UI + Persistence
*Pending*

### Checkpoint E: Dashboard + Chat + Actions + Security + Logs UI
*Pending*

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

---

*This document should be updated as the project evolves.*
