<#
.SYNOPSIS
    Clawd Console Installer
.DESCRIPTION
    One-time setup: installs dependencies and builds the application.
    Double-click install.cmd to use this script.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host ""
Write-Host "========================================"
Write-Host "  Clawd Console - One-Time Setup"
Write-Host "========================================"
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Cyan
try {
    $NodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    Write-Host "  Node.js version: $NodeVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "To install Node.js:" -ForegroundColor Yellow
    Write-Host "  1. Visit nodejs.org"
    Write-Host "  2. Download the LTS version for Windows"
    Write-Host "  3. Run the installer"
    Write-Host "  4. Restart this script"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Cyan
try {
    $NpmVersion = & npm --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "npm not found"
    }
    Write-Host "  npm version: $NpmVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: npm is not available." -ForegroundColor Red
    Write-Host "npm should be included with Node.js. Please reinstall Node.js."
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $RootDir

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Cyan
Write-Host "  This may take a few minutes on first run."
Write-Host ""

try {
    # Use npm ci if package-lock.json exists, otherwise npm install
    $LockFile = Join-Path $RootDir "package-lock.json"
    if (Test-Path $LockFile) {
        & npm ci
    } else {
        & npm install
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Root dependencies failed"
    }

    Set-Location (Join-Path $RootDir "backend")
    $BackendLock = Join-Path $RootDir "backend\package-lock.json"
    if (Test-Path $BackendLock) {
        & npm ci
    } else {
        & npm install
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Backend dependencies failed"
    }

    Set-Location (Join-Path $RootDir "frontend")
    $FrontendLock = Join-Path $RootDir "frontend\package-lock.json"
    if (Test-Path $FrontendLock) {
        & npm ci
    } else {
        & npm install
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend dependencies failed"
    }

    Set-Location $RootDir
    Write-Host ""
    Write-Host "  Dependencies installed successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to install dependencies." -ForegroundColor Red
    Write-Host "  $_"
    Write-Host ""
    Write-Host "Please check your internet connection and try again."
    Write-Host ""
    Set-Location $RootDir
    Read-Host "Press Enter to exit"
    exit 1
}

# Build the application
Write-Host ""
Write-Host "Building the application..." -ForegroundColor Cyan
Write-Host ""

try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host ""
    Write-Host "  Build completed successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to build the application." -ForegroundColor Red
    Write-Host "  $_"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "To start Clawd Console:"
Write-Host "  Double-click run.cmd"
Write-Host ""
Write-Host "Or from the command line:"
Write-Host "  npm run start:prod"
Write-Host ""
Read-Host "Press Enter to exit"
