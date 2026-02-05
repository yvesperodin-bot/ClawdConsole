<#
.SYNOPSIS
    Clawd Console Launcher
.DESCRIPTION
    Starts Clawd Console in production mode.
    Double-click run.cmd to use this script.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $RootDir "logs"
$Port = 3001

# Ensure logs directory exists
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Log rotation: keep last 5 logs
$LogFiles = Get-ChildItem -Path $LogDir -Filter "clawd-*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
if ($LogFiles.Count -gt 4) {
    $LogFiles | Select-Object -Skip 4 | Remove-Item -Force
}

$LogFile = Join-Path $LogDir ("clawd-" + (Get-Date -Format "yyyy-MM-dd_HH-mm-ss") + ".log")

function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Clawd Console"
Write-Host "========================================"
Write-Host ""

# Check Node.js
Write-Log "Checking Node.js..."
try {
    $NodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    Write-Log "Node.js version: $NodeVersion"
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
    Write-Log "ERROR: Node.js not found"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if dependencies are installed
$NodeModules = Join-Path $RootDir "node_modules"
$BackendModules = Join-Path $RootDir "backend\node_modules"
$FrontendModules = Join-Path $RootDir "frontend\node_modules"

if (-not (Test-Path $NodeModules) -or -not (Test-Path $BackendModules) -or -not (Test-Path $FrontendModules)) {
    Write-Host ""
    Write-Host "ERROR: Dependencies are not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run install.cmd first (one-time setup)." -ForegroundColor Yellow
    Write-Host ""
    Write-Log "ERROR: Dependencies not installed"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if frontend is built
$FrontendDist = Join-Path $RootDir "frontend\dist\index.html"
if (-not (Test-Path $FrontendDist)) {
    Write-Host ""
    Write-Host "ERROR: Application is not built." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run install.cmd first (one-time setup)." -ForegroundColor Yellow
    Write-Host ""
    Write-Log "ERROR: Frontend not built"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if port is in use
$PortInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($PortInUse) {
    Write-Host ""
    Write-Host "ERROR: Port $Port is already in use." -ForegroundColor Red
    Write-Host ""
    Write-Host "Another application is using this port." -ForegroundColor Yellow
    Write-Host "Please close it and try again, or check if Clawd Console is already running."
    Write-Host ""
    Write-Log "ERROR: Port $Port in use"
    Read-Host "Press Enter to exit"
    exit 1
}

# Start the server
Write-Log "Starting Clawd Console..."
Write-Host ""

$Env:NODE_ENV = "production"
Set-Location $RootDir

# Open browser after a short delay
$BrowserJob = Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:3001"
}

# Run the server (this blocks until Ctrl+C)
try {
    Write-Log "Server starting on http://localhost:$Port"
    & npm run start 2>&1 | Tee-Object -FilePath $LogFile -Append
} catch {
    Write-Log "ERROR: Server failed - $_"
} finally {
    Stop-Job $BrowserJob -ErrorAction SilentlyContinue
    Remove-Job $BrowserJob -ErrorAction SilentlyContinue
}

Write-Log "Server stopped"
