# Offline Installation Guide

This guide explains how to install Clawd Console on a computer without internet access.

## Overview

You'll prepare everything on a computer with internet, transfer the files via USB, then complete the setup on the offline computer.

---

## Recommended (Most Users)

The simplest approach using a pre-built package.

### On the Online Computer

**Step 1: Download Node.js installer**
- Visit nodejs.org
- Download the **LTS** version for Windows (the .msi installer)
- Save the installer to your USB drive

**Step 2: Download Clawd Console**
- Download the repository as a ZIP file
- Extract the ZIP to a folder
- Copy the entire folder to your USB drive

**Step 3: Install dependencies (while online)**
- Open a terminal in the Clawd Console folder
- Run: `npm run install:all`
- Run: `npm run build`
- Copy the updated folder (now with node_modules and dist) to your USB drive

### On the Offline Computer

**Step 1: Install Node.js**
- Run the Node.js installer from your USB drive
- Follow the prompts (default options are fine)
- Restart your computer if prompted

**Step 2: Copy Clawd Console**
- Copy the Clawd Console folder from USB to your computer
- Place it somewhere convenient (like Documents or Desktop)

**Step 3: Start the application**
- Open the Clawd Console folder
- Double-click `scripts\run.cmd`
- Your browser will open to the application

That's it! The setup wizard will guide you through initial configuration.

---

## Advanced (Builders & Power Users)

For cases where you need more control or the simple approach doesn't work.

### Approach A: Full Offline with npm Cache

This approach caches npm packages for true offline installation.

**On the Online Computer:**

1. Download Node.js LTS installer (.msi for Windows)

2. Clone or download Clawd Console

3. Create a portable npm cache:
   ```bash
   cd ClawdConsole
   npm config set cache ./npm-cache --location=project
   npm run install:all
   npm run build
   ```

4. Copy the entire folder (including npm-cache) to USB

**On the Offline Computer:**

1. Install Node.js from the installer

2. Copy the Clawd Console folder from USB

3. Configure npm to use the local cache:
   ```bash
   cd ClawdConsole
   npm config set cache ./npm-cache --location=project
   npm config set offline true --location=project
   ```

4. Start the application:
   ```bash
   npm run start:prod
   ```
   Or double-click `scripts\run.cmd`

### Approach B: Minimal Transfer

If USB space is limited, you can transfer only what's needed at runtime.

**Required files/folders:**
```
ClawdConsole/
├── backend/
│   ├── dist/           (compiled backend)
│   ├── node_modules/   (backend dependencies)
│   └── package.json
├── frontend/
│   └── dist/           (built frontend - static files only)
├── scripts/
│   ├── run.cmd
│   └── run.ps1
└── package.json
```

**Not required for running (build-time only):**
- `frontend/node_modules/`
- `frontend/src/`
- `backend/src/`
- Root `node_modules/` (if not using npm scripts)

### Approach C: Direct Node Execution

Skip npm entirely for the most minimal approach.

**On the Offline Computer:**

1. Install Node.js

2. Copy only the required files (see Approach B)

3. Run directly:
   ```bash
   cd ClawdConsole/backend
   set NODE_ENV=production
   node dist/index.js
   ```

4. Open browser to http://localhost:3001

---

## Troubleshooting

### "Node.js is not installed"

The Node.js installer may not have added node to your PATH. Try:
- Restart your computer after installing Node.js
- Run the installer again and select "Repair"

### "Dependencies are not installed"

The node_modules folders weren't transferred. Either:
- Go back to the online computer and run `npm run install:all`
- Use Approach A with the npm cache

### "Application is not built"

The frontend/dist folder is missing. Either:
- Go back to the online computer and run `npm run build`
- Use Approach B with only the dist folders

### "Port 3001 is already in use"

Another application is using that port. Either:
- Close the other application
- Check if Clawd Console is already running

---

## What Gets Installed

For transparency, here's what's on your system after installation:

| Item | Location | Purpose |
|------|----------|---------|
| Node.js | System install | JavaScript runtime |
| Clawd Console | Your chosen folder | The application |
| Application data | ClawdConsole/backend/data/ | Database and settings |
| Logs | ClawdConsole/logs/ | Startup logs |

**Not installed:**
- No system services
- No registry entries (beyond Node.js)
- No startup items
- No internet connections

---

## Security Notes

- Clawd Console only listens on localhost (127.0.0.1)
- No data is sent over the network
- All your data stays in the local folder
- The application works completely offline

For more security details, see the main README.
