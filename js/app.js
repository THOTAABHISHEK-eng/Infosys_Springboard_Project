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
    const curAvatar = document.getElementById("cur-avatar");

    // DOM Elements - Previous
    const prevAppName = document.getElementById("prev-app-name");
    const prevAppCategory = document.getElementById("prev-app-category");
    const prevWindowTitle = document.getElementById("prev-window-title");
    const prevDuration = document.getElementById("prev-duration");
    const prevLastTime = document.getElementById("prev-last-time");

    // DOM Elements - Summary / KPI
    const sumTotalTime = document.getElementById("sum-total-time");
    const sumAppsCount = document.getElementById("sum-apps-count");
    const sumSwitches = document.getElementById("sum-switches");
    const sumMostUsed = document.getElementById("sum-most-used");
    const sumMostUsedHint = document.getElementById("sum-most-used-hint");

    const pieCanvas = document.getElementById("usage-pie-canvas");
    const pieLegend = document.getElementById("pie-legend");
    const pieTotalDwell = document.getElementById("pie-total-dwell");
    const historyDatePicker = document.getElementById("history-date-picker");
    const tableMoreContainer = document.getElementById("table-more-container");

    let allHistory = {};
    let isHistoricalView = false;
    let isAppTableExpanded = false;

    const CHART_PALETTE = ["#10b981", "#3b82f6", "#06b6d4", "#a855f7", "#f59e0b", "#ec4899", "#64748b"];

    function renderPieChart(appList, totalSec) {
        if (!pieCanvas) return;
        const ctx = pieCanvas.getContext("2d");
        ctx.clearRect(0, 0, pieCanvas.width, pieCanvas.height);

        if (!appList || appList.length === 0 || totalSec <= 0) {
            ctx.beginPath();
            ctx.arc(70, 70, 56, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
            ctx.lineWidth = 14;
            ctx.stroke();
            if (pieTotalDwell) pieTotalDwell.textContent = "0s";
            if (pieLegend) pieLegend.innerHTML = `<span style="font-size:0.7rem;color:var(--text-muted);font-style:italic;">Awaiting activity breakdown...</span>`;
            return;
        }

        if (pieTotalDwell) pieTotalDwell.textContent = formatDurationHuman(totalSec);

        let startAngle = -Math.PI / 2;
        let legendHtml = "";

        const topApps = appList.slice(0, 5);
        let renderedSec = 0;

        topApps.forEach((app, idx) => {
            const sec = app.totalSeconds || 0;
            renderedSec += sec;
            const sliceAngle = (sec / totalSec) * (Math.PI * 2);
            const color = CHART_PALETTE[idx % CHART_PALETTE.length];

            ctx.beginPath();
            ctx.arc(70, 70, 56, startAngle, startAngle + sliceAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = 14;
            ctx.stroke();

            startAngle += sliceAngle;

            const pct = Math.round((sec / totalSec) * 100);
            legendHtml += `
                <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.72rem;">
                    <div style="display:flex;align-items:center;gap:6px;overflow:hidden;max-width:70%;">
                        <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                        <span style="color:#fff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(app.name)}</span>
                    </div>
                    <span style="font-family:var(--font-mono);color:var(--text-secondary);font-size:0.68rem;">${pct}% (${formatDurationHuman(sec)})</span>
                </div>
            `;
        });

        // Other slice
        const otherSec = totalSec - renderedSec;
        if (otherSec > 0 && appList.length > 5) {
            const sliceAngle = (otherSec / totalSec) * (Math.PI * 2);
            ctx.beginPath();
            ctx.arc(70, 70, 56, startAngle, startAngle + sliceAngle);
            ctx.strokeStyle = "#334155";
            ctx.lineWidth = 14;
            ctx.stroke();

            const pct = Math.round((otherSec / totalSec) * 100);
            legendHtml += `
                <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.72rem;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="width:7px;height:7px;border-radius:50%;background:#334155;flex-shrink:0;"></span>
                        <span style="color:var(--text-muted);">Other (${appList.length - 5} apps)</span>
                    </div>
                    <span style="font-family:var(--font-mono);color:var(--text-muted);font-size:0.68rem;">${pct}%</span>
                </div>
            `;
        }

        if (pieLegend) pieLegend.innerHTML = legendHtml;
    }
    const timelineContainer = document.getElementById("timeline-container");
    const timelineCount = document.getElementById("timeline-count");
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

    function getAppGlyph(name) {
        if (!name) return "APP";
        const clean = name.trim();
        if (clean.toLowerCase().includes("brave")) return "BR";
        if (clean.toLowerCase().includes("chrome")) return "CH";
        if (clean.toLowerCase().includes("edge")) return "ED";
        if (clean.toLowerCase().includes("code") || clean.toLowerCase().includes("vs code")) return "VS";
        if (clean.toLowerCase().includes("whatsapp")) return "WA";
        if (clean.toLowerCase().includes("spotify")) return "SP";
        if (clean.toLowerCase().includes("terminal") || clean.toLowerCase().includes("powershell")) return "PS";
        if (clean.toLowerCase().includes("explorer")) return "FX";
        if (clean.toLowerCase().includes("discord")) return "DC";
        if (clean.toLowerCase().includes("slack")) return "SL";
        return clean.substring(0, 2).toUpperCase();
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
            curActivated.textContent = cur.activatedTime || "Waiting";
            curUpdated.textContent = cur.lastUpdated || "Waiting";

            if (curAvatar) {
                const glyph = getAppGlyph(cur.appName);
                curAvatar.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;">${glyph}</span>`;
            }
        } else {
            curAppName.textContent = "Waiting for active window...";
            curAppCategory.textContent = "Waiting";
            curWindowTitle.textContent = "Switch to any application or browser tab on your machine";
            curCounter.textContent = "00:00:00";
            curActivated.textContent = "Waiting";
            curUpdated.textContent = "Waiting";
        }

        // 2. Previous Active Window / Application
        if (prev && prev.appName) {
            prevAppName.textContent = prev.appName;
            prevAppCategory.textContent = prev.category || "General";
            prevWindowTitle.textContent = prev.title || prev.appName;
            prevDuration.textContent = prev.activeDurationFormatted || formatDurationHuman(prev.activeDurationSec);
            prevLastTime.textContent = prev.lastActiveTime || "Waiting";
        } else {
            prevAppName.textContent = "No previous application yet";
            prevAppCategory.textContent = "None";
            prevWindowTitle.textContent = "None";
            prevDuration.textContent = "0s";
            prevLastTime.textContent = "None";
        }

        // 3. Summary Metrics / KPIs
        sumTotalTime.textContent = summary.totalActiveFormatted || formatDurationHuman(summary.totalActiveSeconds);
        sumAppsCount.textContent = summary.distinctAppsCount || apps.length || 0;
        sumSwitches.textContent = summary.totalSwitches || 0;

        if (summary.mostUsedApp) {
            sumMostUsed.textContent = summary.mostUsedApp.name;
            sumMostUsedHint.textContent = `${summary.mostUsedApp.durationFormatted} (${summary.mostUsedApp.percentage}% of active time)`;
        } else {
            sumMostUsed.textContent = "None";
            sumMostUsedHint.textContent = "0% of active time";
        }

        // 4. Application Usage Table (Shows 4 most recent by default, More button to show all)
        const appList = Array.isArray(apps) ? apps : Object.values(apps);
        appList.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

        if (appList.length === 0) {
            if (tableMoreContainer) tableMoreContainer.style.display = "none";
            appUsageTbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-row">
                        <div class="empty-wrap">
                            <div class="empty-pulse"></div>
                            <span>No application activity logged yet. Switch between WhatsApp, Brave, Edge, VS Code, or other apps on your laptop to begin.</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            const maxSec = appList[0].totalSeconds || 1;
            const totalSec = summary.totalActiveSeconds || maxSec;
            const limit = isAppTableExpanded ? appList.length : 4;
            const visibleApps = appList.slice(0, limit);
            let rowsHtml = "";

            visibleApps.forEach((app, idx) => {
                const pctOfTotal = Math.round(((app.totalSeconds || 0) / Math.max(1, totalSec)) * 100);
                const barWidth = Math.max(2, Math.round(((app.totalSeconds || 0) / maxSec) * 100));
                const glyph = getAppGlyph(app.name);

                rowsHtml += `
                    <tr>
                        <td class="cell-rank">#${idx + 1}</td>
                        <td>
                            <div class="table-app-cell">
                                <span class="app-glyph">${glyph}</span>
                                <span class="app-name-text">${escapeHtml(app.name)}</span>
                            </div>
                        </td>
                        <td><span class="category-tag">${escapeHtml(app.category || 'General')}</span></td>
                        <td class="cell-time">${formatDurationHuman(app.totalSeconds)}</td>
                        <td class="cell-switches">${app.switchCount || 1}</td>
                        <td class="cell-share">
                            <div class="share-bar-cell">
                                <div class="share-track">
                                    <div class="share-fill" style="width: ${barWidth}%;"></div>
                                </div>
                                <span class="share-pct">${pctOfTotal}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            });
            appUsageTbody.innerHTML = rowsHtml;

            // Handle More button
            if (tableMoreContainer) {
                if (appList.length > 4) {
                    tableMoreContainer.style.display = "block";
                    const remainingCount = appList.length - 4;
                    const label = isAppTableExpanded ? "Show Less &uarr;" : `More (+${remainingCount} remaining) &darr;`;
                    tableMoreContainer.innerHTML = `
                        <button id="btn-toggle-more-apps" class="btn btn-panel" style="font-size: 0.74rem; padding: 6px 18px; font-weight: 600; color: var(--accent-cyan); border-color: rgba(6,182,212,0.3); cursor: pointer;">
                            ${label}
                        </button>
                    `;
                } else {
                    tableMoreContainer.style.display = "none";
                }
            }
        }

        // Render Pie Chart
        const totalSec = summary.totalActiveSeconds || (appList.length > 0 ? appList.reduce((acc, a) => acc + (a.totalSeconds || 0), 0) : 0);
        renderPieChart(appList, totalSec);

        // 5. Chronological Vertical Activity Timeline
        if (timeline.length === 0) {
            timelineContainer.innerHTML = `
                <div class="empty-wrap" style="padding: 24px;">
                    <span>Transitions will be logged here in real time as you navigate windows.</span>
                </div>
            `;
            if (timelineCount) timelineCount.textContent = "0 events";
        } else {
            if (timelineCount) timelineCount.textContent = `${timeline.length} events`;
            const reversed = [...timeline].reverse();
            let tlHtml = "";

            reversed.slice(0, 40).forEach(item => {
                tlHtml += `
                    <div class="timeline-item">
                        <span class="tl-indicator"></span>
                        <div class="tl-content">
                            <div class="tl-row-top">
                                <span class="tl-name">${escapeHtml(item.appName)}</span>
                                <span class="tl-time-stamp">${escapeHtml(item.time)}</span>
                            </div>
                            <span class="tl-title-text" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
                            <span class="tl-dur-badge">${escapeHtml(item.durationFormatted || formatDurationHuman(item.durationSec))}</span>
                        </div>
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
        if (isHistoricalView) return; // Retain past date inspection
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
     * Poll and populate multi-day activity history
     */
    async function fetchHistory() {
        try {
            const res = await fetch(`activity_history.json?t=${Date.now()}`);
            if (res.ok) {
                const hist = await res.json();
                allHistory = hist || {};
                updateHistoryDropdown();
            }
        } catch {
            // No history file yet or local access restricted
        }
    }

    function updateHistoryDropdown() {
        if (!historyDatePicker) return;
        const currentVal = historyDatePicker.value;
        const dates = Object.keys(allHistory).sort().reverse();
        
        let html = `<option value="today">Today (Live)</option>`;
        dates.forEach(d => {
            html += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
        });
        historyDatePicker.innerHTML = html;
        if (dates.includes(currentVal) || currentVal === "today") {
            historyDatePicker.value = currentVal;
        }
    }

    if (historyDatePicker) {
        historyDatePicker.addEventListener("change", () => {
            const val = historyDatePicker.value;
            if (val === "today") {
                isHistoricalView = false;
                pollDaemonState();
            } else if (allHistory[val]) {
                isHistoricalView = true;
                const histDay = allHistory[val];
                const mappedHist = {
                    current: null,
                    previous: null,
                    summary: {
                        totalActiveSeconds: histDay.totalActiveSeconds || 0,
                        totalActiveFormatted: histDay.totalActiveFormatted || formatDurationHuman(histDay.totalActiveSeconds),
                        totalSwitches: histDay.totalSwitches || 0,
                        distinctAppsCount: histDay.distinctAppsCount || (histDay.appUsage ? histDay.appUsage.length : 0),
                        mostUsedApp: histDay.appUsage && histDay.appUsage.length > 0 ? {
                            name: histDay.appUsage[0].name,
                            category: histDay.appUsage[0].category,
                            durationFormatted: formatDurationHuman(histDay.appUsage[0].totalSeconds),
                            percentage: Math.round(((histDay.appUsage[0].totalSeconds || 0) / Math.max(1, histDay.totalActiveSeconds || 1)) * 100)
                        } : null
                    },
                    appUsage: histDay.appUsage || [],
                    timeline: histDay.timeline || []
                };
                renderState(mappedHist);
                if (statusLabel) statusLabel.textContent = `Historical View: ${val}`;
            }
        });
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

    // 1-Second Refresh Poll Loop and 5-Second History Sync
    setInterval(pollDaemonState, 1000);
    setInterval(fetchHistory, 5000);
    pollDaemonState();
    fetchHistory();

    // Event delegation for table "More" expander
    if (tableMoreContainer) {
        tableMoreContainer.addEventListener("click", e => {
            const btn = e.target.closest("#btn-toggle-more-apps");
            if (btn) {
                e.preventDefault();
                isAppTableExpanded = !isAppTableExpanded;
                if (latestState) renderState(latestState);
            }
        });
    }

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
            link.setAttribute("download", `ActivityWatch_Usage_Report_${new Date().toISOString().slice(0, 10)}.csv`);
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
