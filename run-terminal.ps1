<#
.SYNOPSIS
    Professional System Monitoring Console & Application Activity Tracker
    Design Direction: Windows Terminal & ActivityWatch
    
    This script forwards directly to the unified tracker-daemon.ps1 engine.
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$daemonScript = Join-Path $scriptDir "tracker-daemon.ps1"

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $daemonScript
