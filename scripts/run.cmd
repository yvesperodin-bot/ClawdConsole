@echo off
:: Clawd Console Launcher
:: Double-click this file to start Clawd Console

title Clawd Console

:: Run the PowerShell script with bypass for this script only
powershell.exe -ExecutionPolicy Bypass -File "%~dp0run.ps1"

:: If PowerShell isn't available, show a message
if errorlevel 1 (
    echo.
    echo PowerShell is required to run Clawd Console.
    echo Please ensure PowerShell is installed on your system.
    echo.
    pause
)
