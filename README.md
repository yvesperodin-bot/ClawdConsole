# Clawd Console

A **local-first AI control interface** for managing ClawdBot with a human-in-the-loop design.

## Local-Only Guarantee

Clawd Console is designed to run entirely on your local machine:

- **No internet required** - Works offline by default
- **No telemetry** - We never collect or send any data
- **localhost only** - Backend binds to 127.0.0.1 exclusively
- **Your data stays yours** - SQLite database stored locally

## Quick Start

### Prerequisites

- Node.js >= 18.0.0

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ClawdConsole

# Install dependencies
npm run install:all

# Start development servers
npm run dev
```

Access the application:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

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
└── CLAUDE.md         # AI assistant guide
```

## Development

```bash
# Run backend only
npm run dev:backend

# Run frontend only
npm run dev:frontend

# Build for production
npm run build
```

## License

MIT

---

**Built for safety, designed for trust.**
