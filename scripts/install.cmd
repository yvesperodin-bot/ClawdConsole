@echo off
:: Clawd Console Installer
:: Double-click this file for one-time setup

title Clawd Console - Setup

:: Run the PowerShell script with bypass for this script only
powershell.exe -ExecutionPolicy Bypass -File "%~dp0install.ps1"

:: If PowerShell isn't available, show a message
if errorlevel 1 (
    echo.
    echo PowerShell is required to install Clawd Console.
    echo Please ensure PowerShell is installed on your system.
    echo.
    pause
)
