/**
 * Activity Intelligence - Personal Browsing Intelligence
 * Design inspiration: RescueTime & ActivityWatch
 * 
 * Preserves 100% of existing tracking engine, data models, real-time message listeners,
 * and zero-refresh architecture.
 */

document.addEventListener("DOMContentLoaded", () => {
    // State cache
    let latestState = null;
    let selectedRange = "today"; // 'today', 'yesterday', '7d', '30d'
    let searchQuery = "";
    let sortMode = "time"; // 'time', 'visits', 'name'

    // DOM Elements - Navigation
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabPanels = document.querySelectorAll(".tab-panel");
    const filterBtns = document.querySelectorAll(".filter-btn");

    // Header & Status
    const windowStatus = document.getElementById("window-status");
    const statusPill = document.getElementById("status-pill");
    const badgeSessionVal = document.getElementById("badge-session-val");

    // Overview 4 Main Stats
    const statTotalUsage = document.getElementById("stat-total-usage");
    const statSitesVisited = document.getElementById("stat-sites-visited");
    const statMostUsed = document.getElementById("stat-most-used");
    const statTotalVisits = document.getElementById("stat-total-visits");

    // Current Website Elements
    const curName = document.getElementById("cur-name");
    const curDomain = document.getElementById("cur-domain");
    const curCounter = document.getElementById("cur-counter");
    const curSiteToday = document.getElementById("cur-site-today");
    const curActivated = document.getElementById("cur-activated");
    const curUrl = document.getElementById("cur-url");
    const curUrlLink = document.getElementById("cur-url-link");

    // Previous Website Elements
    const prevName = document.getElementById("prev-name");
    const prevDomain = document.getElementById("prev-domain");
    const prevDuration = document.getElementById("prev-duration");
    const prevLastTime = document.getElementById("prev-last-time");
    const prevUrlLink = document.getElementById("prev-url-link");

    // Visual Comparison (Overview)
    const overviewComparisonBars = document.getElementById("overview-comparison-bars");

    // Websites Tab
    const siteSearchInput = document.getElementById("site-search-input");
    const siteSortSelect = document.getElementById("site-sort-select");
    const fullWebsitesList = document.getElementById("full-websites-list");

    // Timeline Tab
    const timelineCountBadge = document.getElementById("timeline-count-badge");
    const timelineStream = document.getElementById("timeline-stream");

    // Reports Tab
    const reportDateStr = document.getElementById("report-date-str");
    const repSessionRatio = document.getElementById("rep-session-ratio");
    const repAvgDwell = document.getElementById("rep-avg-dwell");
    const repFocusScore = document.getElementById("rep-focus-score");
    const reportsShareBars = document.getElementById("reports-share-bars");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const insightTitle = document.getElementById("insight-title");
    const insightText = document.getElementById("insight-text");

    // Navigation Tab Switching
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-tab");
            navTabs.forEach(t => t.classList.remove("active"));
            tabPanels.forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            const panel = document.getElementById(targetId);
            if (panel) panel.classList.add("active");
        });
    });

    // Date Range Selection (Today, Yesterday, 7 Days, 30 Days)
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedRange = btn.getAttribute("data-range");
            renderDashboard();
        });
    });

    // Search and Sort
    if (siteSearchInput) {
        siteSearchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderWebsitesTable();
        });
    }

    if (siteSortSelect) {
        siteSortSelect.addEventListener("change", (e) => {
            sortMode = e.target.value;
            renderWebsitesTable();
        });
    }

    // CSV Export
    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
            exportActivityCsv();
        });
    }

    // Helper: Format Seconds to Monospace Digital Counter (HH:MM:SS)
    function formatCounterDigits(totalSeconds) {
        const s = totalSeconds || 0;
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    // Helper: Human readable duration
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

    // Main Renderer
    function renderDashboard() {
        if (!latestState) return;

        const cur = latestState.currentWebsite;
        const prev = latestState.previousWebsite;
        const dwell = latestState.currentDwellSec || 0;
        const siteUsage = latestState.siteUsage || {};
        const timeline = latestState.timeline || [];
        const isFocused = latestState.isWindowFocused !== false;

        // 1. Status Indicator & Session Badge
        if (windowStatus) {
            windowStatus.textContent = isFocused ? "MONITORING" : "PAUSED";
            if (statusPill) {
                statusPill.style.borderColor = isFocused ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.3)";
                statusPill.style.color = isFocused ? "var(--accent-emerald)" : "var(--accent-amber)";
            }
        }
        if (badgeSessionVal) {
            badgeSessionVal.textContent = formatCounterDigits(dwell);
        }

        // 2. Prepare Sites List & Aggregations
        let sites = Object.values(siteUsage);
        let totalActiveSec = 0;
        let totalVisits = 0;

        sites.forEach(s => {
            totalActiveSec += (s.totalSec || 0);
            totalVisits += (s.visitCount || 1);
        });

        // Sort descending by totalSec
        sites.sort((a, b) => (b.totalSec || 0) - (a.totalSec || 0));

        // 3. 4 Main Overview Statistics
        if (statTotalUsage) statTotalUsage.textContent = formatDurationHuman(totalActiveSec);
        if (statSitesVisited) statSitesVisited.textContent = sites.length;
        if (statMostUsed) {
            statMostUsed.textContent = (sites.length > 0 && sites[0].totalSec > 0) ? sites[0].name : "—";
            statMostUsed.title = (sites.length > 0) ? `${sites[0].name} (${sites[0].domain})` : "";
        }
        if (statTotalVisits) statTotalVisits.textContent = totalVisits;

        // 4. Current Website Section
        if (cur) {
            curName.textContent = cur.name || "Unknown Website";
            curDomain.textContent = cur.domain || "—";
            curCounter.textContent = formatCounterDigits(dwell);
            curActivated.textContent = cur.activatedTime || "—";
            curUrl.textContent = cur.url || "—";
            curUrlLink.href = cur.url || "#";

            // Today's total for this specific domain
            const thisDomainTotal = (siteUsage[cur.domain] && siteUsage[cur.domain].totalSec) || dwell;
            curSiteToday.textContent = formatDurationHuman(thisDomainTotal);
        } else {
            curName.textContent = "No active tab detected";
            curDomain.textContent = "—";
            curCounter.textContent = "00:00:00";
            curActivated.textContent = "—";
            curUrl.textContent = "—";
            curUrlLink.href = "#";
            curSiteToday.textContent = "0s";
        }

        // 5. Previous Website Section
        if (prev) {
            prevName.textContent = prev.name || "Unknown";
            prevDomain.textContent = prev.domain || "—";
            prevDuration.textContent = formatDurationHuman(prev.totalActiveSpent);
            prevLastTime.textContent = prev.lastActiveTime || "—";
            prevUrlLink.href = prev.url || "#";
            prevUrlLink.style.display = prev.url ? "inline" : "none";
        } else {
            prevName.textContent = "No previous website yet";
            prevDomain.textContent = "—";
            prevDuration.textContent = "0s";
            prevLastTime.textContent = "—";
            prevUrlLink.style.display = "none";
        }

        // 6. Horizontal Usage Comparison Bars (Overview Tab)
        renderOverviewBars(sites, totalActiveSec);

        // 7. Websites Table (Websites Tab)
        renderWebsitesTable();

        // 8. Chronological Timeline (Timeline Tab)
        renderTimelineStream(timeline);

        // 9. Reports Tab
        renderReportsTab(sites, totalActiveSec, dwell, latestState.totalTabSwitches || 0);
    }

    // Render Overview Horizontal Bars
    function renderOverviewBars(sites, totalActiveSec) {
        if (!overviewComparisonBars) return;

        if (!sites || sites.length === 0 || totalActiveSec === 0) {
            overviewComparisonBars.innerHTML = `<div class="empty-state">No website activity recorded yet today.</div>`;
            return;
        }

        const maxSec = sites[0].totalSec || 1;
        let html = "";
        const topSlice = sites.slice(0, 5);

        topSlice.forEach((site, idx) => {
            const pct = Math.max(3, Math.round(((site.totalSec || 0) / maxSec) * 100));
            html += `
                <div class="usage-bar-item">
                    <div class="bar-meta">
                        <div class="bar-name-group">
                            <span class="bar-rank">#${idx + 1}</span>
                            <span class="bar-site-title">${escapeHtml(site.name)}</span>
                            <span class="bar-site-domain">${escapeHtml(site.domain)}</span>
                        </div>
                        <span class="bar-duration">${formatDurationHuman(site.totalSec)}</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        });

        overviewComparisonBars.innerHTML = html;
    }

    // Render Full Websites Table
    function renderWebsitesTable() {
        if (!fullWebsitesList || !latestState) return;

        const siteUsage = latestState.siteUsage || {};
        let sites = Object.values(siteUsage);

        if (sites.length === 0) {
            fullWebsitesList.innerHTML = `<div class="empty-state">No websites tracked yet.</div>`;
            return;
        }

        // Filter by Search Query
        if (searchQuery) {
            sites = sites.filter(s => 
                (s.name && s.name.toLowerCase().includes(searchQuery)) ||
                (s.domain && s.domain.toLowerCase().includes(searchQuery))
            );
        }

        // Sort
        if (sortMode === "visits") {
            sites.sort((a, b) => (b.visitCount || 1) - (a.visitCount || 1));
        } else if (sortMode === "name") {
            sites.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } else {
            // default 'time'
            sites.sort((a, b) => (b.totalSec || 0) - (a.totalSec || 0));
        }

        if (sites.length === 0) {
            fullWebsitesList.innerHTML = `<div class="empty-state">No matching websites found for "${escapeHtml(searchQuery)}".</div>`;
            return;
        }

        let html = "";
        sites.forEach((site, index) => {
            html += `
                <div class="site-row">
                    <span class="td-rank">${index + 1}</span>
                    <div class="td-site-info">
                        <span class="td-name">${escapeHtml(site.name)}</span>
                        <span class="td-domain">${escapeHtml(site.domain)}</span>
                    </div>
                    <span class="td-visits">${site.visitCount || 1}x</span>
                    <span class="td-duration">${formatDurationHuman(site.totalSec)}</span>
                </div>
            `;
        });

        fullWebsitesList.innerHTML = html;
    }

    // Render Timeline Stream
    function renderTimelineStream(timeline) {
        if (!timelineStream) return;

        if (!timeline || timeline.length === 0) {
            timelineStream.innerHTML = `<div class="empty-state">Timeline events will appear as you switch tabs and browse websites.</div>`;
            if (timelineCountBadge) timelineCountBadge.textContent = "0 events";
            return;
        }

        if (timelineCountBadge) timelineCountBadge.textContent = `${timeline.length} events`;

        const reversed = [...timeline].reverse();
        let html = "";

        reversed.slice(0, 40).forEach(item => {
            html += `
                <div class="tl-entry">
                    <div class="tl-node"></div>
                    <div class="tl-body">
                        <div class="tl-header">
                            <span class="tl-site">${escapeHtml(item.name || item.domain || "Website")}</span>
                            <span class="tl-time">${escapeHtml(item.timeStr || "—")}</span>
                        </div>
                        <span class="tl-action">${escapeHtml(item.actionText || "Visited page")}</span>
                        <span class="tl-dur-pill">${formatDurationHuman(item.durationSec)}</span>
                    </div>
                </div>
            `;
        });

        timelineStream.innerHTML = html;
    }

    // Render Reports Tab
    function renderReportsTab(sites, totalActiveSec, currentDwell, tabSwitches) {
        if (!reportsShareBars) return;

        // Date Display
        if (reportDateStr) {
            const today = new Date();
            reportDateStr.textContent = today.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        }

        // Metrics calculations
        const ratio = totalActiveSec > 0 ? Math.min(100, Math.round((currentDwell / totalActiveSec) * 100)) : 0;
        if (repSessionRatio) repSessionRatio.textContent = `${ratio}%`;

        let totalVisits = 0;
        sites.forEach(s => { totalVisits += (s.visitCount || 1); });
        const avgDwellSec = totalVisits > 0 ? Math.round(totalActiveSec / totalVisits) : 0;
        if (repAvgDwell) repAvgDwell.textContent = formatDurationHuman(avgDwellSec);

        // Focus score indicator
        if (repFocusScore) {
            if (tabSwitches < 10) {
                repFocusScore.textContent = "Deep Focus";
                repFocusScore.style.color = "var(--accent-emerald)";
            } else if (tabSwitches < 35) {
                repFocusScore.textContent = "Balanced";
                repFocusScore.style.color = "var(--accent-blue)";
            } else {
                repFocusScore.textContent = "Fragmented";
                repFocusScore.style.color = "var(--accent-amber)";
            }
        }

        // Top Share Bars (% of total browsing)
        if (sites.length === 0 || totalActiveSec === 0) {
            reportsShareBars.innerHTML = `<div class="empty-state">No distribution data available yet.</div>`;
            return;
        }

        let html = "";
        sites.slice(0, 5).forEach(site => {
            const pct = Math.round(((site.totalSec || 0) / totalActiveSec) * 100);
            html += `
                <div class="share-row">
                    <div class="share-header">
                        <span class="share-name">${escapeHtml(site.name)}</span>
                        <span class="share-pct">${pct}% &bull; ${formatDurationHuman(site.totalSec)}</span>
                    </div>
                    <div class="share-track">
                        <div class="share-fill" style="width: ${Math.max(2, pct)}%;"></div>
                    </div>
                </div>
            `;
        });

        reportsShareBars.innerHTML = html;

        // Contextual Insight Message
        if (insightTitle && insightText) {
            if (sites.length === 0) {
                insightTitle.textContent = "Awaiting Browsing Telemetry";
                insightText.textContent = "Start browsing any website in Edge, Brave or Chrome. Data will stream live automatically.";
            } else if (ratio > 60) {
                insightTitle.textContent = "Single-Tasking Momentum";
                insightText.textContent = `You have spent ${ratio}% of your browsing time on your currently active website. High sustained focus detected.`;
            } else if (tabSwitches > 30) {
                insightTitle.textContent = "High Tab Switching Rate";
                insightText.textContent = `You have switched tabs ${tabSwitches} times today. Consider closing idle background tabs to conserve cognitive bandwidth.`;
            } else {
                insightTitle.textContent = "Productive Distribution";
                insightText.textContent = `Browsing activity is evenly allocated across ${sites.length} distinct domains without context-switching overload.`;
            }
        }
    }

    // CSV Audit Export
    function exportActivityCsv() {
        if (!latestState) {
            alert("No activity recorded to export yet.");
            return;
        }

        const siteUsage = latestState.siteUsage || {};
        const sites = Object.values(siteUsage);
        if (sites.length === 0) {
            alert("No website activity recorded yet today.");
            return;
        }

        let csv = "Rank,Website Name,Domain,Visits,Duration Seconds,Duration Formatted\n";
        sites.sort((a, b) => (b.totalSec || 0) - (a.totalSec || 0));

        sites.forEach((s, idx) => {
            const cleanName = (s.name || "").replace(/"/g, '""');
            const cleanDomain = (s.domain || "").replace(/"/g, '""');
            csv += `"${idx + 1}","${cleanName}","${cleanDomain}",${s.visitCount || 1},${s.totalSec || 0},"${formatDurationHuman(s.totalSec)}"\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `browsing_activity_report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Initial load from chrome.storage.local
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([
            "currentWebsite",
            "previousWebsite",
            "currentDwellSec",
            "totalTabSwitches",
            "siteUsage",
            "timeline"
        ], res => {
            latestState = {
                currentWebsite: res.currentWebsite || null,
                previousWebsite: res.previousWebsite || null,
                currentDwellSec: res.currentDwellSec || 0,
                totalTabSwitches: res.totalTabSwitches || 0,
                siteUsage: res.siteUsage || {},
                timeline: res.timeline || [],
                isWindowFocused: true
            };
            renderDashboard();
        });

        // Listen for 1-second live heartbeat broadcasts from background.js
        chrome.runtime.onMessage.addListener(msg => {
            if (msg.type === "TICK_1S") {
                latestState = msg;
                renderDashboard();
            }
        });
    }

    // Local 1-second UI fallback tick (keeps dwell counter counting smoothly)
    setInterval(() => {
        if (latestState && latestState.currentWebsite && latestState.isWindowFocused !== false) {
            latestState.currentDwellSec = (latestState.currentDwellSec || 0) + 1;
            if (curCounter) {
                curCounter.textContent = formatCounterDigits(latestState.currentDwellSec);
            }
            if (badgeSessionVal) {
                badgeSessionVal.textContent = formatCounterDigits(latestState.currentDwellSec);
            }
        }
    }, 1000);
});
