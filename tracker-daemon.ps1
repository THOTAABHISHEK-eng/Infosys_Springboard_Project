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
$CLEAR_EOL = "$ESC[K"

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
$historyFile = Join-Path $scriptDir "activity_history.json"

# Process Catalog & Categorization
$KNOWN_APPS = @{
    "whatsapp"        = @{ Name = "WhatsApp Desktop"; Category = "Communication" }
    "whatsapp.root"   = @{ Name = "WhatsApp Desktop"; Category = "Communication" }
    "applicationframehost" = @{ Name = "Windows App"; Category = "General Application" }
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
    "shellexperiencehost" = @{ Name = "Task Switching"; Category = "System" }
    "taskview"        = @{ Name = "Task Switching"; Category = "System" }
    "searchhost"      = @{ Name = "Windows Search"; Category = "System" }
    "startmenuexperiencehost" = @{ Name = "Start Menu"; Category = "System" }
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

    # 1. Native WhatsApp Desktop or Store Package (handles any contact name or chat title)
    if ($procLower -like "*whatsapp*") {
        $wTitle = if ([string]::IsNullOrWhiteSpace($rawTitle)) { "WhatsApp Desktop" } else { $rawTitle }
        return @{
            AppName = "WhatsApp Desktop"
            Category = "Communication"
            Title = $wTitle
            Process = $processName
        }
    }

    if ($procLower -eq "applicationframehost" -and $rawTitle -match "(?i)whatsapp") {
        return @{
            AppName = "WhatsApp Desktop"
            Category = "Communication"
            Title = $rawTitle
            Process = $processName
        }
    }

    # 2. Virtual Desktops, Task View, and Windows Task Switching
    if ($procLower -eq "shellexperiencehost" -or $procLower -eq "taskview" -or ($procLower -eq "explorer" -and $rawTitle -match "(?i)(Task Switching|Task View|Running applications)")) {
        return @{
            AppName = "Task Switching"
            Category = "System"
            Title = if ([string]::IsNullOrWhiteSpace($rawTitle)) { "Virtual Desktop Switcher" } else { $rawTitle }
            Process = $processName
        }
    }

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

    # Distinct website tracking inside browsers (e.g. YouTube (Brave Browser))
    $finalAppName = if ($procLower -in @("brave", "chrome", "msedge", "firefox") -and $cleanTitle -ne $name -and -not [string]::IsNullOrWhiteSpace($cleanTitle)) {
        $siteIdentity = $cleanTitle
        if ($cleanTitle -match "(?:-\s*|\|\s*)(YouTube|Google Search|GitHub|Reddit|Twitter|X|LinkedIn|Wikipedia|ChatGPT|Netflix|Spotify|Amazon|Stack Overflow|Coursera|LeetCode|Infosys)") {
            $siteIdentity = $matches[1]
        } elseif ($cleanTitle.Contains(" - ")) {
            $parts = $cleanTitle -split "\s*-\s*"
            $siteIdentity = $parts[-1].Trim()
        } elseif ($cleanTitle.Length -gt 35) {
            $siteIdentity = $cleanTitle.Substring(0, 32) + "..."
        }
        "$siteIdentity ($name)"
    } else {
        $name
    }

    # Infer real category from browser site identity (overrides "Web Browser")
    if ($procLower -in @("brave", "chrome", "msedge", "firefox") -and $finalAppName -ne $name) {
        $siteLower = $siteIdentity.ToLower()
        if ($siteLower -match "youtube|netflix|spotify|twitch|disney|prime video|hotstar|crunchyroll|anime|hulu|peacock") {
            $category = "Entertainment"
        } elseif ($siteLower -match "github|stackoverflow|stack overflow|chatgpt|gemini|copilot|replit|codepen|leetcode|vercel|netlify|npm|openai|figma") {
            $category = "Development"
        } elseif ($siteLower -match "coursera|udemy|khan|wikipedia|infosys|w3schools|mdn|freecodecamp|chess|typeracer|duolingo|edx|skillshare|typing|tutorial") {
            $category = "Learning"
        } elseif ($siteLower -match "whatsapp|discord|slack|teams|telegram|gmail|outlook|zoom|meet|skype|mail") {
            $category = "Communication"
        } elseif ($siteLower -match "linkedin|notion|jira|confluence|trello|asana|monday|canva|dropbox|drive|docs|sheets|slides|calendar|office|sharepoint") {
            $category = "Professional"
        } elseif ($siteLower -match "instagram|twitter|x\.com|facebook|reddit|snapchat|tiktok|pinterest|tumblr") {
            $category = "Social Media"
        } elseif ($siteLower -match "amazon|flipkart|ebay|myntra|meesho|zara|nykaa|shopping|cart|etsy|walmart") {
            $category = "Shopping"
        } elseif ($siteLower -match "news|bbc|cnn|times|hindu|ndtv|reuters|techcrunch|verge|wired|hacker news|guardian|bloomberg") {
            $category = "News"
        } else {
            $category = "Other"
        }
    }

    return @{
        AppName = $finalAppName
        BaseApp = $name
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

# Load existing multi-day history if available
$historyData = @{}
if (Test-Path $historyFile) {
    try {
        $rawHist = Get-Content $historyFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($rawHist) {
            foreach ($prop in $rawHist.PSObject.Properties) {
                $historyData[$prop.Name] = $prop.Value
            }
        }
    } catch {
        # ignore parse errors
    }
}

# Clear screen once on startup
Clear-Host

# Helper to write a clean terminal row with trailing space padding to eliminate leftover ghost characters
function Write-DashboardRow {
    param(
        [string]$lineFormatted,
        [int]$lineWidth = 90
    )
    # Strip ANSI escape codes to calculate visual string length accurately
    $plain = $lineFormatted -replace "`e\[[0-9;]*[a-zA-Z]", ""
    $padLen = [Math]::Max(0, $lineWidth - $plain.Length)
    $spaces = " " * $padLen
    Write-Host "$lineFormatted$spaces$CLEAR_EOL"
}

function Print-ConsoleDashboard {
    $timeNow = (Get-Date).ToString("hh:mm:ss tt")
    $dateNow = (Get-Date).ToString("yyyy-MM-dd")

    # Move cursor to home position for smooth redrawing without screen flicker
    [Console]::SetCursorPosition(0, 0)

    # 1. Header Banner
    $hdrText = "  ACTIVITYWATCH & WINDOWS MONITOR | [CONSOLE ENGINE v2.0] | $dateNow $timeNow"
    Write-DashboardRow "$BG_CARD$FG_WHITE$C_BOLD$hdrText$C_RESET"
    Write-DashboardRow "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 2. Section: Monitoring Status & Session Statistics (Perfect 2-column alignment)
    $durFormatted = Format-Duration $totalActiveSeconds
    $appsCount = $appUsage.Keys.Count
    $procId = [System.Diagnostics.Process]::GetCurrentProcess().Id

    Write-DashboardRow "$FG_BLUE$C_BOLD[MONITORING STATUS AND SESSION STATISTICS]$C_RESET"

    # Row 1: Status & Total Dwell
    $col1Val1 = "* ACTIVE (MONITORING)".PadRight(26)
    Write-DashboardRow "  $FG_MUTED- Status:         $FG_RESET$FG_EMERALD$col1Val1$FG_RESET$FG_MUTED- Total Session Dwell:  $FG_RESET$FG_WHITE$C_BOLD$durFormatted$C_RESET"

    # Row 2: Storage Sync & Switch Count
    $col1Val2 = "* CONNECTED (JSON)".PadRight(26)
    $switchesStr = "$totalSwitches"
    Write-DashboardRow "  $FG_MUTED- Storage Sync:   $FG_RESET$FG_CYAN$col1Val2$FG_RESET$FG_MUTED- App Switch Count:     $FG_RESET$FG_WHITE$C_BOLD$switchesStr$C_RESET"

    # Row 3: Engine PID & Tracked Apps
    $col1Val3 = "$procId".PadRight(26)
    $appsStr = "$appsCount"
    Write-DashboardRow "  $FG_MUTED- Engine PID:     $FG_RESET$FG_WHITE$col1Val3$FG_RESET$FG_MUTED- Tracked Applications: $FG_RESET$FG_WHITE$C_BOLD$appsStr$C_RESET"

    Write-DashboardRow "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 3. Section: Current Application
    Write-DashboardRow "$FG_EMERALD$C_BOLD[CURRENT ACTIVE APPLICATION]$C_RESET"
    if ($currentState) {
        $curDwellFormatted = Format-Duration $currentDwell
        $appTitleTrunc = if ($currentState.Title.Length -gt 50) { $currentState.Title.Substring(0, 47) + "..." } else { $currentState.Title }
        $actTime = $currentState.ActivatedTime
        $cName = $currentState.AppName
        $cCat = $currentState.Category
        
        Write-DashboardRow "  $FG_MUTED- Application:  $FG_RESET$FG_WHITE$C_BOLD$cName$C_RESET  $FG_BLUE[$cCat]$C_RESET"
        Write-DashboardRow "  $FG_MUTED- Window Title: $FG_RESET$FG_CYAN$appTitleTrunc$C_RESET"
        Write-DashboardRow "  $FG_MUTED- Active Dwell: $FG_RESET$FG_EMERALD$C_BOLD$curDwellFormatted$C_RESET ($currentDwell s)   $FG_MUTED| Activated: $FG_WHITE$actTime$C_RESET"
        Write-DashboardRow "  $FG_MUTED- App Status:   $FG_RESET$FG_EMERALD* Focused in Foreground$C_RESET"
    } else {
        Write-DashboardRow "  $FG_MUTED- Awaiting window focus... (Click any app on your laptop)$C_RESET"
        Write-DashboardRow ""
        Write-DashboardRow ""
        Write-DashboardRow ""
    }
    Write-DashboardRow "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 4. Section: Recent Activity History
    Write-DashboardRow "$FG_CYAN$C_BOLD[RECENT ACTIVITY LOG]$C_RESET $FG_DIM(Chronological Transitions)$C_RESET"
    if ($recentEvents.Count -eq 0) {
        Write-DashboardRow "  $FG_DIM(No application switches recorded yet)$C_RESET"
        Write-DashboardRow ""
        Write-DashboardRow ""
        Write-DashboardRow ""
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
                Write-DashboardRow "  $FG_MUTED$evTime$C_RESET $FG_WHITE$C_BOLD$evName$C_RESET $FG_DIM|$C_RESET $FG_CYAN$evTitlePadded$C_RESET $FG_EMERALD$evDur$C_RESET"
            }
        }
        for ($j = $displayEvents.Count; $j -lt 4; $j++) {
            Write-DashboardRow ""
        }
    }
    Write-DashboardRow "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"

    # 5. Section: Notifications & Event Stream
    $notifColor = switch ($lastNotifType) {
        "SUCCESS" { $FG_EMERALD }
        "WARN"    { $FG_AMBER }
        "SYNC"    { $FG_BLUE }
        default   { $FG_CYAN }
    }
    Write-DashboardRow "$FG_MUTED$C_BOLD[NOTIFICATIONS]$C_RESET  $notifColor$lastNotification$C_RESET"
    Write-DashboardRow "$FG_DIM------------------------------------------------------------------------------------------$C_RESET"
    Write-DashboardRow "  $FG_DIM Press Ctrl+C in this terminal window to stop monitoring cleanly.$C_RESET"
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

        # Filter out self-tracking of tracker/dashboard windows, console, and extension pages
        $isTrackerWindow = ($windowTitle.Contains("Website Usage Tracker") -or 
                            $windowTitle.Contains("tracker-daemon") -or 
                            $windowTitle.Contains("run-terminal") -or 
                            $windowTitle.Contains("System-Wide Application") -or
                            $windowTitle.Contains("System Activity Tracker") -or
                            $windowTitle.Contains("System Activity Tracker Daemon") -or
                            $windowTitle.Contains("ActivityWatch: System and Browser Intelligence") -or
                            $windowTitle.Contains("ActivityWatch Dashboard") -or
                            $windowTitle.Contains("ActivityWatch") -or
                            $windowTitle.Contains("Current & Previous Website Usage Tracker") -or
                            $windowTitle.Contains("127.0.0.1:5500") -or
                            $windowTitle.Contains("localhost:5500") -or
                            $windowTitle.Contains("kmkplinihahhdkeammgenjfffccahnbi"))

        if (-not $isTrackerWindow) {
            $isTitleRefinement = ($currentState -ne $null -and $currentState.Process -eq $procName -and ($currentState.Title -like "*Untitled*" -or $currentState.Title -like "*New Tab*") -and $currentDwell -le 4)
            if ($isTitleRefinement) {
                # Seamlessly refine temporary "Untitled" or "New Tab" title as page finishes loading without a false switch
                $oldKey = $currentState.AppName
                $resolved = Resolve-AppDetails $procName $windowTitle
                $currentState.Title = $resolved.Title
                $currentState.RawTitle = $windowTitle
                $currentState.AppName = $resolved.AppName
                $currentState.Category = $resolved.Category
                $lastForegroundId = $proc.Id

                # If appUsage had logged under the temporary Untitled key, migrate it
                if ($oldKey -ne $resolved.AppName -and $appUsage.ContainsKey($oldKey)) {
                    $oldUsage = $appUsage[$oldKey]
                    $appUsage.Remove($oldKey)
                    if (-not $appUsage.ContainsKey($resolved.AppName)) {
                        $appUsage[$resolved.AppName] = $oldUsage
                        $appUsage[$resolved.AppName].name = $resolved.AppName
                        $appUsage[$resolved.AppName].category = $resolved.Category
                    } else {
                        $appUsage[$resolved.AppName].totalSeconds += $oldUsage.totalSeconds
                        $appUsage[$resolved.AppName].switchCount += $oldUsage.switchCount
                    }
                }
            } else {
                $windowChanged = ($currentState -eq $null -or $currentState.RawTitle -ne $windowTitle -or $currentState.Process -ne $procName)

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
                    rawTitle = $windowTitle
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

            # Persist and sync multi-day history
            $todayKey = (Get-Date).ToString("yyyy-MM-dd")
            $historyData[$todayKey] = @{
                date = $todayKey
                lastUpdated = (Get-Date).ToString("o")
                totalActiveSeconds = $totalActiveSeconds
                totalActiveFormatted = (Format-Duration $totalActiveSeconds)
                totalSwitches = $totalSwitches
                distinctAppsCount = $appUsage.Keys.Count
                appUsage = @($appUsage.Values)
                timeline = @($recentEvents)
            }
            $histJson = $historyData | ConvertTo-Json -Depth 6
            [System.IO.File]::WriteAllText($historyFile, $histJson, [System.Text.Encoding]::UTF8)

            $lastNotification = "Data synced cleanly to activity_state.json & activity_history.json ($($appUsage.Keys.Count) apps)"
            $lastNotifType = "SYNC"
        } catch {
            $lastNotification = "File sync paused: $($_.Exception.Message)"
            $lastNotifType = "WARN"
        }
    }

    Start-Sleep -Milliseconds 1000
}
