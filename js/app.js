/**
 * System Activity & Usage Tracker - Web Application Controller
 * Synchronizes with tracker-daemon (activity_state.json) and browser extension.
 * Features: Pure real data, clean UI, CSV export, session reset.
 */

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements - Current
    const curAppName = document.getElementById("cur-app-name");
    const curAppCategory = document.getElementById("cur-app-category");
    const curWindowTitle = document.getElementById("cur-window-title");
    const curCounter = document.getElementById("cur-counter");
    const curActivated = document.getElementById("cur-activated");
    const curUpdated = document.getElementById("cur-updated");

    // DOM Elements - Previous
    const prevAppName = document.getElementById("prev-app-name");
    const prevAppCategory = document.getElementById("prev-app-category");
    const prevWindowTitle = document.getElementById("prev-window-title");
    const prevDuration = document.getElementById("prev-duration");
    const prevLastTime = document.getElementById("prev-last-time");

    // DOM Elements - Summary
    const sumTotalTime = document.getElementById("sum-total-time");
    const sumAppsCount = document.getElementById("sum-apps-count");
    const sumSwitches = document.getElementById("sum-switches");
    const sumMostUsed = document.getElementById("sum-most-used");
    const sumMostUsedHint = document.getElementById("sum-most-used-hint");

    // DOM Elements - Tables & Timeline
    const appUsageTbody = document.getElementById("app-usage-tbody");
    const timelineContainer = document.getElementById("timeline-container");
    const connectionStatus = document.getElementById("connection-status");
    const statusLabel = document.getElementById("status-label");

    // Buttons
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnResetSession = document.getElementById("btn-reset-session");

    let latestState = null;

    function formatCounter(totalSeconds) {
        const s = totalSeconds || 0;
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    function formatDurationHuman(totalSeconds) {
        const s = totalSeconds || 0;
        if (s <= 0) return "0s";
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Render the state into the dashboard (starts completely empty if no activity yet)
     */
    function renderState(state) {
        if (!state) return;
        latestState = state;

        const cur = state.current;
        const prev = state.previous;
        const summary = state.summary || {};
        const apps = state.appUsage || [];
        const timeline = state.timeline || [];

        // 1. Current Active Window / Application
        if (cur && cur.appName) {
            curAppName.textContent = cur.appName;
            curAppCategory.textContent = cur.category || "General";
            curWindowTitle.textContent = cur.title || cur.appName;
            curCounter.textContent = formatCounter(cur.dwellSeconds);
            curActivated.textContent = cur.activatedTime || "—";
            curUpdated.textContent = cur.lastUpdated || "—";
        } else {
            curAppName.textContent = "Waiting for active window...";
            curAppCategory.textContent = "—";
            curWindowTitle.textContent = "Switch to any app or browser on your laptop to start";
            curCounter.textContent = "00:00:00";
            curActivated.textContent = "—";
            curUpdated.textContent = "—";
        }

        // 2. Previous Active Window / Application
        if (prev && prev.appName) {
            prevAppName.textContent = prev.appName;
            prevAppCategory.textContent = prev.category || "General";
            prevWindowTitle.textContent = prev.title || prev.appName;
            prevDuration.textContent = prev.activeDurationFormatted || formatDurationHuman(prev.activeDurationSec);
            prevLastTime.textContent = prev.lastActiveTime || "—";
        } else {
            prevAppName.textContent = "No previous application yet";
            prevAppCategory.textContent = "—";
            prevWindowTitle.textContent = "—";
            prevDuration.textContent = "0s";
            prevLastTime.textContent = "—";
        }

        // 3. Summary Metrics Bar
        sumTotalTime.textContent = summary.totalActiveFormatted || formatDurationHuman(summary.totalActiveSeconds);
        sumAppsCount.textContent = summary.distinctAppsCount || apps.length || 0;
        sumSwitches.textContent = summary.totalSwitches || 0;

        if (summary.mostUsedApp) {
            sumMostUsed.textContent = summary.mostUsedApp.name;
            sumMostUsedHint.textContent = `${summary.mostUsedApp.durationFormatted} (${summary.mostUsedApp.percentage}% of active time)`;
        } else {
            sumMostUsed.textContent = "—";
            sumMostUsedHint.textContent = "0% of active time";
        }

        // 4. Application Usage Table
        const appList = Array.isArray(apps) ? apps : Object.values(apps);
        appList.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

        if (appList.length === 0) {
            appUsageTbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        No application activity logged yet. Switch between WhatsApp, Brave, Edge, VS Code, or other apps on your laptop to begin.
                    </td>
                </tr>
            `;
        } else {
            const maxSec = appList[0].totalSeconds || 1;
            const totalSec = summary.totalActiveSeconds || maxSec;
            let rowsHtml = "";

            appList.forEach((app, idx) => {
                const pctOfTotal = Math.round(((app.totalSeconds || 0) / Math.max(1, totalSec)) * 100);
                const barWidth = Math.max(2, Math.round(((app.totalSeconds || 0) / maxSec) * 100));

                rowsHtml += `
                    <tr>
                        <td style="color: var(--text-muted); font-family: var(--font-mono);">#${idx + 1}</td>
                        <td><strong style="color: #ffffff;">${escapeHtml(app.name)}</strong></td>
                        <td><span class="category-tag">${escapeHtml(app.category || 'General')}</span></td>
                        <td><strong style="font-family: var(--font-mono); color: #ffffff;">${formatDurationHuman(app.totalSeconds)}</strong></td>
                        <td style="font-family: var(--font-mono);">${app.switchCount || 1}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="bar-track" style="flex: 1;">
                                    <div class="bar-fill" style="width: ${barWidth}%;"></div>
                                </div>
                                <span style="font-family: var(--font-mono); font-size: 0.72rem; min-width: 32px;">${pctOfTotal}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            });
            appUsageTbody.innerHTML = rowsHtml;
        }

        // 5. Chronological Activity Timeline
        if (timeline.length === 0) {
            timelineContainer.innerHTML = `<div class="empty-state">Transitions will be recorded here as you work.</div>`;
        } else {
            const reversed = [...timeline].reverse();
            let tlHtml = "";

            reversed.slice(0, 35).forEach(item => {
                tlHtml += `
                    <div class="timeline-row">
                        <span class="tl-time">${escapeHtml(item.time)}</span>
                        <span class="tl-app">${escapeHtml(item.appName)}</span>
                        <span class="tl-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
                        <span class="tl-duration">${escapeHtml(item.durationFormatted || formatDurationHuman(item.durationSec))}</span>
                    </div>
                `;
            });
            timelineContainer.innerHTML = tlHtml;
        }
    }

    /**
     * Poll activity_state.json produced by tracker-daemon.ps1
     */
    async function pollDaemonState() {
        try {
            const res = await fetch(`activity_state.json?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                renderState(data);
                if (statusLabel) statusLabel.textContent = "Desktop Daemon Connected";
            }
        } catch {
            // Local file mode or browser sandbox restrictions; fallback to extension bridge
            checkExtensionBridge();
        }
    }

    /**
     * Check if Chrome/Edge Extension has written to localStorage
     */
    function checkExtensionBridge() {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([
                "currentWebsite",
                "previousWebsite",
                "currentDwellSec",
                "totalTabSwitches",
                "siteUsage",
                "timeline"
            ], res => {
                if (res.currentWebsite || res.siteUsage) {
                    const mapped = {
                        current: res.currentWebsite ? {
                            appName: res.currentWebsite.name,
                            category: "Web Browser",
                            title: res.currentWebsite.url,
                            dwellSeconds: res.currentDwellSec,
                            activatedTime: res.currentWebsite.activatedTime,
                            lastUpdated: res.currentWebsite.lastUpdatedTime
                        } : null,
                        previous: res.previousWebsite ? {
                            appName: res.previousWebsite.name,
                            category: "Web Browser",
                            title: res.previousWebsite.url,
                            activeDurationSec: res.previousWebsite.totalActiveSpent,
                            activeDurationFormatted: formatDurationHuman(res.previousWebsite.totalActiveSpent),
                            lastActiveTime: res.previousWebsite.lastActiveTime
                        } : null,
                        summary: {
                            totalActiveSeconds: Object.values(res.siteUsage || {}).reduce((acc, s) => acc + (s.totalSec || 0), 0),
                            totalSwitches: res.totalTabSwitches || 0,
                            distinctAppsCount: Object.keys(res.siteUsage || {}).length
                        },
                        appUsage: Object.values(res.siteUsage || {}).map(s => ({
                            name: s.name,
                            category: "Web Browser",
                            totalSeconds: s.totalSec,
                            switchCount: s.visitCount
                        })),
                        timeline: (res.timeline || []).map(t => ({
                            time: t.timeStr,
                            appName: t.name,
                            title: t.actionText,
                            durationSec: t.durationSec,
                            durationFormatted: formatDurationHuman(t.durationSec)
                        }))
                    };
                    renderState(mapped);
                    if (statusLabel) statusLabel.textContent = "Browser Extension Connected";
                }
            });
        }
    }

    // 1-Second Refresh Poll Loop
    setInterval(pollDaemonState, 1000);
    pollDaemonState();

    // Export CSV Report
    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
            if (!latestState || !latestState.appUsage || latestState.appUsage.length === 0) {
                alert("No application usage data logged yet to export.");
                return;
            }

            const rows = [
                ["Application / Website", "Category", "Active Duration (Seconds)", "Duration (Formatted)", "Switch Count"]
            ];

            const appList = Array.isArray(latestState.appUsage) ? latestState.appUsage : Object.values(latestState.appUsage);
            appList.forEach(a => {
                rows.push([
                    `"${(a.name || '').replace(/"/g, '""')}"`,
                    `"${(a.category || '').replace(/"/g, '""')}"`,
                    a.totalSeconds || 0,
                    `"${formatDurationHuman(a.totalSeconds)}"`,
                    a.switchCount || 1
                ]);
            });

            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Internship_Usage_Report_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    }

    // Reset Session
    if (btnResetSession) {
        btnResetSession.addEventListener("click", () => {
            if (confirm("Reset tracking session for today? Current active counts will start from zero.")) {
                latestState = {
                    current: null,
                    previous: null,
                    summary: { totalActiveSeconds: 0, totalSwitches: 0, distinctAppsCount: 0 },
                    appUsage: [],
                    timeline: []
                };
                renderState(latestState);
                if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.clear();
                }
            }
        });
    }
});
