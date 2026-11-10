<#
.SYNOPSIS
    Professional System Monitoring Console & Application Activity Tracker Daemon
    Design Inspiration: Windows Terminal & ActivityWatch
    
    Architecture:
    - Deep navy / charcoal structured console
    - Blue & emerald green accent highlights
    - Clean tabular panels for Status, Session Statistics, Current Application, and Recent Activity
    - Real-time Win32 foreground window detection without spammy line duplications
    - Structured JSON synchronization to activity_state.json
#>

# Windows Terminal ANSI escape codes helper
$ESC = [char]27
$C_RESET   = "$ESC[0m"
$C_BOLD    = "$ESC[1m"
$C_DIM     = "$ESC[2m"

# Text Colors
$FG_NAVY   = "$ESC[38;2;10;14;23m"
$FG_WHITE  = "$ESC[38;2;248;250;252m"
$FG_MUTED  = "$ESC[38;2;148;163;184m"
$FG_DIM    = "$ESC[38;2;100;116;139m"
$FG_BLUE   = "$ESC[38;2;59;130;246m"
$FG_CYAN   = "$ESC[38;2;6;182;212m"
$FG_EMERALD= "$ESC[38;2;16;185;129m"
$FG_AMBER  = "$ESC[38;2;245;158;11m"
$FG_RED    = "$ESC[38;2;239;68;68m"

# Background Colors
$BG_NAVY   = "$ESC[48;2;10;14;23m"
$BG_CARD   = "$ESC[48;2;20;28;46m"
$BG_BAR    = "$ESC[48;2;30;41;66m"
$BG_EMERALD= "$ESC[48;2;16;185;129m"
$BG_BLUE   = "$ESC[48;2;59;130;246m"

# Win32 API Definitions for Foreground Window Tracking
$signature = @'
[DllImport("user32.dll")]
public static extern IntPtr GetForegroundWindow();

[DllImport("user32.dll", CharSet = CharSet.Auto)]
public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);

[DllImport("user32.dll")]
public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
'@

Add-Type -MemberDefinition $signature -Name "Win32API" -Namespace "SystemTracker" -ErrorAction SilentlyContinue

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateFile = Join-Path $scriptDir "activity_state.json"

# Process Catalog & Categorization
$KNOWN_APPS = @{
    "whatsapp"        = @{ Name = "WhatsApp Desktop"; Category = "Communication" }
    "telegram"        = @{ Name = "Telegram Desktop"; Category = "Communication" }
    "discord"         = @{ Name = "Discord"; Category = "Communication" }
    "slack"           = @{ Name = "Slack"; Category = "Communication" }
    "teams"           = @{ Name = "Microsoft Teams"; Category = "Communication" }
    "msedge"          = @{ Name = "Microsoft Edge"; Category = "Web Browser" }
    "chrome"          = @{ Name = "Google Chrome"; Category = "Web Browser" }
    "brave"           = @{ Name = "Brave Browser"; Category = "Web Browser" }
    "firefox"         = @{ Name = "Mozilla Firefox"; Category = "Web Browser" }
    "code"            = @{ Name = "Visual Studio Code"; Category = "Development" }
    "devenv"          = @{ Name = "Visual Studio"; Category = "Development" }
    "idea64"          = @{ Name = "IntelliJ IDEA"; Category = "Development" }
    "pycharm64"       = @{ Name = "PyCharm"; Category = "Development" }
    "powershell"      = @{ Name = "Windows PowerShell"; Category = "Utilities" }
    "pwsh"            = @{ Name = "PowerShell 7"; Category = "Utilities" }
    "cmd"             = @{ Name = "Command Prompt"; Category = "Utilities" }
    "windowsterminal" = @{ Name = "Windows Terminal"; Category = "Utilities" }
    "explorer"        = @{ Name = "File Explorer"; Category = "System" }
    "spotify"         = @{ Name = "Spotify"; Category = "Media" }
    "notepad"         = @{ Name = "Notepad"; Category = "Utilities" }
    "notepad++"       = @{ Name = "Notepad++"; Category = "Development" }
}

function Format-Duration([int]$totalSeconds) {
    if ($totalSeconds -le 0) { return "0s" }
    $ts = [TimeSpan]::FromSeconds($totalSeconds)
    if ($ts.Hours -gt 0) { return "{0}h {1}m {2}s" -f $ts.Hours, $ts.Minutes, $ts.Seconds }
    if ($ts.Minutes -gt 0) { return "{0}m {1}s" -f $ts.Minutes, $ts.Seconds }
    return "{0}s" -f $ts.Seconds
}

function Resolve-AppDetails($processName, $rawTitle) {
    $procLower = $processName.ToLower()
    $name = $processName
    $category = "General Application"

    if ($KNOWN_APPS.ContainsKey($procLower)) {
        $name = $KNOWN_APPS[$procLower].Name
        $category = $KNOWN_APPS[$procLower].Category
    } else {
        $name = (Get-Culture).TextInfo.ToTitleCase($procLower)
    }

    # Clean browser window titles
    $cleanTitle = $rawTitle
    if ($procLower -in @("brave", "chrome", "msedge", "firefox")) {
        $suffixes = @(" - Brave", " - Google Chrome", " - Microsoft Edge", " - Mozilla Firefox")
        foreach ($s in $suffixes) {
            if ($cleanTitle.EndsWith($s)) {
                $cleanTitle = $cleanTitle.Substring(0, $cleanTitle.Length - $s.Length)
                break
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($cleanTitle)) {
        $cleanTitle = $name
    }

    return @{
        AppName = $name
        Category = $category
        Title = $cleanTitle
        Process = $processName
    }
}

# In-Memory State (100% real, ZERO DUMMY SEEDS)
$currentState = $null
$previousState = $null
$currentDwell = 0
$totalActiveSeconds = 0
$totalSwitches = 0
$appUsage = @{}
$recentEvents = @()
$lastForegroundId = 0
$lastNotification = "Tracker daemon initialized successfully."
$lastNotifType = "SUCCESS"

# Clear screen once on startup
Clear-Host

function Print-ConsoleDashboard {
    $timeNow = (Get-Date).ToString("hh:mm:ss tt")
    $dateNow = (Get-Date).ToString("yyyy-MM-dd")

    # Move cursor to home position for clean redrawing
    [Console]::SetCursorPosition(0, 0)

    # 1. Header Banner
    $hdrText = "  ACTIVITYWATCH & WINDOWS MONITOR | [CONSOLE ENGINE v2.0] | $dateNow $timeNow  "
    Write-Host "$BG_CARD$FG_WHITE$C_BOLD$hdrText$C_RESET"
    Write-Host "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 2. Section: Monitoring Status & Session Statistics
    $statusText = "$FG_EMERALD* ACTIVE (MONITORING)$C_RESET"
    $storageText = "$FG_CYAN* CONNECTED (activity_state.json)$C_RESET"
    $durFormatted = Format-Duration $totalActiveSeconds
    $appsCount = $appUsage.Keys.Count
    $procId = [System.Diagnostics.Process]::GetCurrentProcess().Id

    Write-Host "$FG_BLUE$C_BOLD[MONITORING STATUS AND SESSION STATISTICS]$C_RESET"
    Write-Host "  $FG_MUTED- Status:          $statusText        $FG_MUTED- Total Session Dwell:  $FG_WHITE$C_BOLD$durFormatted$C_RESET"
    Write-Host "  $FG_MUTED- Storage Sync:    $storageText   $FG_MUTED- App Switch Count:     $FG_WHITE$C_BOLD$totalSwitches$C_RESET"
    Write-Host "  $FG_MUTED- Engine PID:      $FG_WHITE$procId$C_RESET                   $FG_MUTED- Tracked Applications: $FG_WHITE$C_BOLD$appsCount$C_RESET"
    Write-Host "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 3. Section: Current Application
    Write-Host "$FG_EMERALD$C_BOLD[CURRENT ACTIVE APPLICATION]$C_RESET"
    if ($currentState) {
        $curDwellFormatted = Format-Duration $currentDwell
        $appTitleTrunc = if ($currentState.Title.Length -gt 50) { $currentState.Title.Substring(0, 47) + "..." } else { $currentState.Title }
        $actTime = $currentState.ActivatedTime
        $cName = $currentState.AppName
        $cCat = $currentState.Category
        
        Write-Host "  $FG_MUTED- Application:     $FG_WHITE$C_BOLD$cName$C_RESET  $FG_BLUE[$cCat]$C_RESET"
        Write-Host "  $FG_MUTED- Window Title:    $FG_CYAN$appTitleTrunc$C_RESET"
        Write-Host "  $FG_MUTED- Active Dwell:    $FG_EMERALD$C_BOLD$curDwellFormatted$C_RESET ($currentDwell s)   $FG_MUTED| Activated: $FG_WHITE$actTime$C_RESET"
        Write-Host "  $FG_MUTED- App Status:      $FG_EMERALD* Focused in Foreground$C_RESET"
    } else {
        Write-Host "  $FG_MUTED- Awaiting window focus... (Click any app on your laptop)$C_RESET"
        Write-Host "                                                                                          "
        Write-Host "                                                                                          "
        Write-Host "                                                                                          "
    }
    Write-Host "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 4. Section: Recent Activity History
    Write-Host "$FG_CYAN$C_BOLD[RECENT ACTIVITY LOG]$C_RESET $FG_DIM(Chronological Transitions)$C_RESET"
    if ($recentEvents.Count -eq 0) {
        Write-Host "  $FG_DIM(No application switches recorded yet)$C_RESET                                      "
        Write-Host "                                                                                          "
        Write-Host "                                                                                          "
        Write-Host "                                                                                          "
    } else {
        $displayEvents = $recentEvents[-4..-1]
        for ($i = $displayEvents.Count - 1; $i -ge 0; $i--) {
            $ev = $displayEvents[$i]
            if ($ev) {
                $evTitleTrunc = if ($ev.Title.Length -gt 32) { $ev.Title.Substring(0, 29) + "..." } else { $ev.Title }
                $evTime = $ev.Time
                $evName = $ev.AppName.PadRight(18)
                $evTitlePadded = $evTitleTrunc.PadRight(34)
                $evDur = $ev.DurationFormatted
                Write-Host "  $FG_MUTED$evTime$C_RESET $FG_WHITE$C_BOLD$evName$C_RESET $FG_DIM|$C_RESET $FG_CYAN$evTitlePadded$C_RESET $FG_EMERALD$evDur$C_RESET   "
            }
        }
        for ($j = $displayEvents.Count; $j -lt 4; $j++) {
            Write-Host "                                                                                          "
        }
    }
    Write-Host "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 5. Section: Notifications & Event Stream
    $notifColor = switch ($lastNotifType) {
        "SUCCESS" { $FG_EMERALD }
        "WARN"    { $FG_AMBER }
        "SYNC"    { $FG_BLUE }
        default   { $FG_CYAN }
    }
    Write-Host "$FG_MUTED$C_BOLD[NOTIFICATIONS]$C_RESET  $notifColor$lastNotification$C_RESET                                      "
    Write-Host "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"
    Write-Host "  $FG_DIM Press Ctrl+C in this terminal window to stop monitoring cleanly.                      $C_RESET"
}

# Main Monitoring Loop
$stringBuilder = New-Object System.Text.StringBuilder 512
$syncCounter = 0

while ($true) {
    $hwnd = [SystemTracker.Win32API]::GetForegroundWindow()
    $pidOut = 0
    [SystemTracker.Win32API]::GetWindowThreadProcessId($hwnd, [ref]$pidOut) | Out-Null
    
    $proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
    $stringBuilder.Clear() | Out-Null
    [SystemTracker.Win32API]::GetWindowText($hwnd, $stringBuilder, 512) | Out-Null
    $windowTitle = $stringBuilder.ToString().Trim()

    $now = Get-Date
    $timeStr = $now.ToString("hh:mm:ss tt")

    if ($proc -and -not [string]::IsNullOrWhiteSpace($windowTitle)) {
        $procName = $proc.ProcessName

        # Filter out self-tracking of the terminal window itself
        $isTrackerWindow = ($windowTitle.Contains("Website Usage Tracker") -or 
                            $windowTitle.Contains("tracker-daemon") -or 
                            $windowTitle.Contains("run-terminal") -or 
                            $windowTitle.Contains("System-Wide Application"))

        if (-not $isTrackerWindow) {
            $windowChanged = ($proc.Id -ne $lastForegroundId -or ($currentState -and $currentState.Title -ne $windowTitle))

            if ($windowChanged) {
                # 1. Finalize previous window
                if ($currentState) {
                    $prevKey = $currentState.AppName
                    if (-not $appUsage.ContainsKey($prevKey)) {
                        $appUsage[$prevKey] = @{
                            name = $prevKey
                            category = $currentState.Category
                            totalSeconds = 0
                            switchCount = 0
                            lastSeen = $timeStr
                        }
                    }
                    $appUsage[$prevKey].totalSeconds += $currentDwell
                    $appUsage[$prevKey].lastSeen = $timeStr

                    $recentEvents += @{
                        Time = $currentState.ActivatedTime
                        AppName = $currentState.AppName
                        Title = $currentState.Title
                        DurationSec = [Math]::Max(1, $currentDwell)
                        DurationFormatted = (Format-Duration $currentDwell)
                        Category = $currentState.Category
                    }
                    if ($recentEvents.Count -gt 50) { $recentEvents = $recentEvents[-50..-1] }

                    $previousState = @{
                        appName = $currentState.AppName
                        title = $currentState.Title
                        process = $currentState.Process
                        category = $currentState.Category
                        activeDurationSec = $currentDwell
                        activeDurationFormatted = (Format-Duration $currentDwell)
                        lastActiveTime = $timeStr
                    }
                }

                # 2. Setup new active window
                $resolved = Resolve-AppDetails $procName $windowTitle
                $totalSwitches++
                $currentDwell = 0
                $lastForegroundId = $proc.Id

                $currentState = @{
                    appName = $resolved.AppName
                    category = $resolved.Category
                    title = $resolved.Title
                    process = $resolved.Process
                    activatedTime = $timeStr
                    lastUpdated = $timeStr
                }

                $curKey = $resolved.AppName
                if (-not $appUsage.ContainsKey($curKey)) {
                    $appUsage[$curKey] = @{
                        name = $curKey
                        category = $resolved.Category
                        totalSeconds = 0
                        switchCount = 1
                        lastSeen = $timeStr
                    }
                } else {
                    $appUsage[$curKey].switchCount++
                }

                $lastNotification = "Switched to $($resolved.AppName) ($($resolved.Category))"
                $lastNotifType = "INFO"
            }
        }
    }

    # Increment dwell for focused app
    if ($currentState) {
        $currentDwell++
        $totalActiveSeconds++
        $currentState.lastUpdated = $timeStr

        $curKey = $currentState.AppName
        if ($appUsage.ContainsKey($curKey)) {
            $appUsage[$curKey].totalSeconds++
        }
    }

    # Refresh the structured terminal dashboard every second
    Print-ConsoleDashboard

    # Persist structured JSON state to activity_state.json every 2 seconds
    $syncCounter++
    if ($syncCounter % 2 -eq 0) {
        # Find Most Used App
        $topApp = $null
        $maxSec = -1
        foreach ($k in $appUsage.Keys) {
            if ($appUsage[$k].totalSeconds -gt $maxSec) {
                $maxSec = $appUsage[$k].totalSeconds
                $topApp = $appUsage[$k]
            }
        }
        $topAppPct = if ($totalActiveSeconds -gt 0 -and $maxSec -gt 0) { [Math]::Round(($maxSec / $totalActiveSeconds) * 100) } else { 0 }

        $exportPayload = @{
            date = (Get-Date).ToString("yyyy-MM-dd")
            timestamp = (Get-Date).ToString("o")
            current = if ($currentState) {
                @{
                    appName = $currentState.AppName
                    category = $currentState.Category
                    title = $currentState.Title
                    process = $currentState.Process
                    activatedTime = $currentState.ActivatedTime
                    lastUpdated = $currentState.lastUpdated
                    dwellSeconds = $currentDwell
                    dwellFormatted = (Format-Duration $currentDwell)
                }
            } else { $null }
            previous = $previousState
            summary = @{
                totalActiveSeconds = $totalActiveSeconds
                totalActiveFormatted = (Format-Duration $totalActiveSeconds)
                totalSwitches = $totalSwitches
                distinctAppsCount = $appUsage.Keys.Count
                mostUsedApp = if ($topApp) {
                    @{
                        name = $topApp.name
                        category = $topApp.category
                        durationSeconds = $topApp.totalSeconds
                        durationFormatted = (Format-Duration $topApp.totalSeconds)
                        percentage = $topAppPct
                    }
                } else { $null }
            }
            appUsage = $appUsage.Values
            timeline = $recentEvents
        }

        try {
            $jsonContent = $exportPayload | ConvertTo-Json -Depth 6
            [System.IO.File]::WriteAllText($stateFile, $jsonContent, [System.Text.Encoding]::UTF8)
            $lastNotification = "Data synced cleanly to activity_state.json ($($appUsage.Keys.Count) apps)"
            $lastNotifType = "SYNC"
        } catch {
            $lastNotification = "File sync paused: $($_.Exception.Message)"
            $lastNotifType = "WARN"
        }
    }

    Start-Sleep -Milliseconds 1000
}
