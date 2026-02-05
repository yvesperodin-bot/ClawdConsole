# Clawd Console

A **local-first AI control interface** for managing ClawdBot with a human-in-the-loop design.

## Local-Only Guarantee

Clawd Console is designed to run entirely on your local machine:

- **No internet required** - Works offline by default
- **No telemetry** - We never collect or send any data
- **localhost only** - Backend binds to 127.0.0.1 exclusively
- **Your data stays yours** - SQLite database stored locally

## Getting Started

### Prerequisites

- **Node.js 18 or later** - Download from nodejs.org (LTS version recommended)

---

### Recommended (Most Users)

The simplest way to get started. No command line required.

**Step 1: Install Node.js** (one time)
- Download from nodejs.org
- Run the installer (default options are fine)

**Step 2: Install Clawd Console** (one time)
- Download and extract this repository
- Double-click `scripts\install.cmd`
- Wait for setup to complete

**Step 3: Launch**
- Double-click `scripts\run.cmd`
- Your browser opens automatically

That's it! The setup wizard will guide you through initial configuration.

> **Offline installation?** See [docs/OFFLINE_INSTALL.md](docs/OFFLINE_INSTALL.md) for USB transfer instructions.

---

### Advanced (Builders & Power Users)

For developers who want to modify the code or run with hot reload.

**First-time setup:**
```bash
git clone <repository-url>
cd ClawdConsole
npm run install:all
```

**Development mode (hot reload):**
```bash
npm run dev
```
Opens at http://localhost:5173 (frontend) with API at http://localhost:3001

**Production mode:**
```bash
npm run build
npm run start:prod
```
Opens at http://localhost:3001 (single server)

**Run servers independently:**
```bash
npm run dev:backend   # Backend only (localhost:3001)
npm run dev:frontend  # Frontend only (localhost:5173)
```

---

### First Run

On first launch, you'll be guided through a setup wizard that:
1. Checks your environment
2. Configures your workspace directory
3. Connects to ClawdBot (if available)
4. Detects local AI providers (Ollama, LM Studio)
5. Selects your security profile
6. Optionally sets an admin PIN

## Safety Model

### Human-in-the-Loop

**No AI action executes without your explicit approval.**

When ClawdBot proposes actions (file changes, commands, etc.), they appear in the Approvals queue. You must review and approve each action before it runs.

### Security Profiles

| Profile | Network | External AI | System Access | Risk |
|---------|---------|-------------|---------------|------|
| **Air Gapped** (default) | Blocked | Blocked | Blocked | LOW |
| **Local Only** | Blocked | Blocked | Blocked | LOW |
| **Connected** | Allow-list | With approval | Blocked | MEDIUM |
| **Power User** | Full | Full | Full | HIGH |

You can change profiles at any time from the Security page. Higher-risk profiles require confirmation (and PIN if set).

### Workspace Jail

All file operations are restricted to your configured workspace directory. The system blocks:
- Path traversal attempts (`../`)
- System directories (`/etc`, `/var`, etc.)
- UNC/network paths
- Symbolic links escaping the workspace
- Sensitive files (`.env`, credentials, keys)

### Admin PIN

Optional but recommended. When set, your PIN is required to:
- Approve command execution actions
- Change to higher-risk security profiles
- Re-run the setup wizard

## Architecture

```
ClawdConsole/
├── backend/          # Express + SQLite API server
│   ├── data/         # Database and settings (created on first run)
│   └── src/
│       ├── database/ # SQLite schema and operations
│       ├── routes/   # API endpoints
│       ├── services/ # ClawdBot, local AI integration
│       └── middleware/ # Workspace jail enforcement
├── frontend/         # React + Vite UI
│   └── src/
│       ├── components/ # Shared components
│       ├── pages/      # Route pages
│       └── services/   # API client
├── scripts/          # Windows launchers
│   ├── install.cmd   # One-time setup (double-click)
│   └── run.cmd       # Start application (double-click)
├── docs/             # Additional documentation
└── CLAUDE.md         # AI assistant guide
```

## License

MIT

---

**Built for safety, designed for trust.**
