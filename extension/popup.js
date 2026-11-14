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
    const statSwitches = document.getElementById("stat-switches");
    const statIdleTime = document.getElementById("stat-idle-time");

    // Focus score pill (header)
    const focusPill = document.getElementById("focus-pill");
    const focusScoreVal = document.getElementById("focus-score-val");
    const focusGrade = document.getElementById("focus-grade");

    // Current panel idle info
    const curIdleFor = document.getElementById("cur-idle-for");
    const idleStateBadge = document.getElementById("idle-state-badge");

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
    const btnOpenDashboard = document.getElementById("btn-open-dashboard");

    if (btnOpenDashboard) {
        btnOpenDashboard.addEventListener("click", () => {
            // Open the comprehensive System & All Browsers Dashboard
            chrome.tabs.create({ url: chrome.runtime.getURL("../index.html") });
        });
    }

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

    let historyByDate = {};

    // Date Range Selection (Today, Yesterday, 7 Days, 30 Days)
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedRange = btn.getAttribute("data-range");
            applyDateFilter();
        });
    });

    function applyDateFilter() {
        if (!latestState) return;

        if (selectedRange === "today" || !historyByDate || Object.keys(historyByDate).length === 0) {
            renderDashboard();
            return;
        }

        const now = new Date();
        const dates = Object.keys(historyByDate);
        let targetDates = [];

        if (selectedRange === "yesterday") {
            const y = new Date();
            y.setDate(now.getDate() - 1);
            const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
            targetDates = [yStr];
        } else if (selectedRange === "7d") {
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                targetDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            }
        } else if (selectedRange === "30d") {
            for (let i = 0; i < 30; i++) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                targetDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            }
        }

        // Aggregate across target dates
        const aggregatedUsage = {};
        let aggTimeline = [];
        let aggSwitches = 0;
        let aggTotalIdleSec = 0;

        targetDates.forEach(dt => {
            if (historyByDate[dt]) {
                const day = historyByDate[dt];
                aggSwitches += (day.totalTabSwitches || 0);
                aggTotalIdleSec += (day.totalIdleSec || 0);
                if (day.timeline) aggTimeline = aggTimeline.concat(day.timeline);

                const u = day.siteUsage || {};
                Object.keys(u).forEach(dom => {
                    if (!aggregatedUsage[dom]) {
                        aggregatedUsage[dom] = { ...u[dom] };
                    } else {
                        aggregatedUsage[dom].totalSec += (u[dom].totalSec || 0);
                        aggregatedUsage[dom].visitCount += (u[dom].visitCount || 0);
                    }
                });
            }
        });

        const filterState = {
            __isPastDay: true,
            currentWebsite: latestState.currentWebsite,
            previousWebsite: latestState.previousWebsite,
            currentDwellSec: latestState.currentDwellSec,
            totalTabSwitches: aggSwitches || latestState.totalTabSwitches,
            siteUsage: Object.keys(aggregatedUsage).length > 0 ? aggregatedUsage : latestState.siteUsage,
            timeline: aggTimeline.length > 0 ? aggTimeline.slice(-60) : latestState.timeline,
            isWindowFocused: latestState.isWindowFocused,
            idleState: "active",
            currentIdleSec: 0,
            totalIdleSec: aggTotalIdleSec,
            lastActiveTime: Date.now()
        };

        renderDashboardWithState(filterState);
    }

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

    // 10 user-facing distraction categories
    const CATEGORY_COLORS = {
        Development: "#3b82f6",
        Learning: "#10b981",
        Professional: "#8b5cf6",
        Communication: "#f59e0b",
        Entertainment: "#ef4444",
        "Social Media": "#ec4899",
        Shopping: "#eab308",
        News: "#6366f1",
        Other: "#64748b"
    };

    // Lightweight domain -> category guess for the popup (glance view)
    function guessCategory(domain, name) {
        const d = (domain || "").toLowerCase();
        const n = (name || "").toLowerCase();
        const buckets = [
            ["Entertainment", ["youtube", "netflix", "twitch", "spotify", "hulu", "disneyplus", "crunchyroll", "hotstar", "primevideo"]],
            ["Social Media", ["instagram", "facebook", "x.com", "twitter", "reddit", "tiktok", "pinterest", "snapchat", "linkedin"]],
            ["Shopping", ["amazon", "flipkart", "ebay", "myntra", "ajio", "walmart", "target"]],
            ["News", ["bbc", "cnn", "nytimes", "reuters", "aljazeera", "theguardian", "timesofindia", "ndtv", "apnews"]],
            ["Communication", ["whatsapp", "slack", "discord", "telegram", "teams", "outlook", "mail.google", "messenger"]],
            ["Development", ["github", "gitlab", "stackoverflow", "leetcode", "hackerrank", "developer.mozilla", "docs.python", "nodejs", "react.dev"]],
            ["Learning", ["coursera", "udemy", "khanacademy", "springboard", "edx", "wikipedia", "medium", "udacity"]],
            ["Professional", ["notion", "trello", "linear", "jira", "figma", "canva", "chatgpt", "claude.ai", "gemini.google", "drive.google", "docs.google"]]
        ];
        for (const [cat, keywords] of buckets) {
            if (keywords.some(kw => d.includes(kw) || n.includes(kw))) return cat;
        }
        return "Other";
    }

    // Focus Score: starts at 100
    // -20 : too much tab switching  (> 20 switches today)
    // -5  : communication used
    // -N  : entertainment reduces score proportionally to its share ("reduce all")
    // -10 : idle for 10 minutes or more
    function computeFocusScore(state) {
        if (!state) return { score: 100, isCalibrating: true, elapsed: 0 };
        const switches = state.totalTabSwitches || 0;
        const siteUsage = state.siteUsage || {};
        const sites = Object.values(siteUsage);
        const totalActiveSec = sites.reduce((acc, s) => acc + (s.totalSec || 0), 0);

        if (totalActiveSec < 60) {
            return { score: 100, isCalibrating: true, elapsed: totalActiveSec };
        }

        let score = 100;
        let entertainmentSec = 0;
        let communicationSec = 0;
        sites.forEach(s => {
            const cat = guessCategory(s.domain, s.name);
            const sec = s.totalSec || 0;
            if (cat === "Entertainment") entertainmentSec += sec;
            if (cat === "Communication") communicationSec += sec;
        });

        if (switches > 20) score -= 20;
        if (communicationSec > 0) score -= 5;
        score -= Math.round((entertainmentSec / Math.max(1, totalActiveSec)) * 30);

        const idleSec = state.totalIdleSec || 0;
        if (idleSec >= 600) score -= 10;

        return { score: Math.max(0, Math.min(100, Math.round(score))), isCalibrating: false, elapsed: totalActiveSec };
    }

    function focusGradeLabel(score) {
        if (score > 80) return { label: "Excellent", color: "#10b981" };
        if (score >= 60) return { label: "Good", color: "#3b82f6" };
        if (score >= 40) return { label: "Fair", color: "#f59e0b" };
        return { label: "Needs Work", color: "#ef4444" };
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
        renderDashboardWithState(latestState);
    }

    function sanitizeSiteName(name, domain) {
        if (!name || name === "0" || /^\d+$/.test(name)) {
            if (!domain || domain === "none" || domain === "unknown") return "Local / Unknown";
            if (domain === "127.0.0.1" || domain === "localhost") return "Localhost";
            return domain;
        }
        return name;
    }

    function renderDashboardWithState(state) {
        if (!state) return;

        const cur = state.currentWebsite;
        const prev = state.previousWebsite;
        const dwell = state.currentDwellSec || 0;
        const siteUsage = state.siteUsage || {};
        const timeline = state.timeline || [];
        const isFocused = state.isWindowFocused !== false;

        // 1. Status Indicator & Session Badge
        const stIdleState = state.idleState || "active";
        const idle = stIdleState === "idle" || stIdleState === "locked";
        const focused = isFocused !== false && !idle;
        if (windowStatus) {
            if (state.__isPastDay) {
                windowStatus.textContent = "HISTORICAL";
                if (statusPill) {
                    statusPill.style.borderColor = "rgba(148, 163, 184, 0.25)";
                    statusPill.style.color = "var(--text-muted)";
                }
            } else {
                windowStatus.textContent = focused ? "MONITORING" : "PAUSED";
                if (statusPill) {
                    statusPill.style.borderColor = focused
                        ? "rgba(16, 185, 129, 0.25)"
                        : idle
                            ? "rgba(245, 158, 11, 0.25)"
                            : "rgba(239, 68, 68, 0.25)";
                    statusPill.style.color = focused
                        ? "var(--accent-emerald)"
                        : idle
                            ? "var(--accent-amber)"
                            : "var(--accent-rose)";
                }
            }
        }
        const pauseNoticeBanner = document.getElementById("pause-notice-banner");
        if (pauseNoticeBanner) {
            pauseNoticeBanner.style.display = (focused || state.__isPastDay) ? "none" : "block";
        }
        if (badgeSessionVal) {
            badgeSessionVal.textContent = formatCounterDigits(dwell);
        }
        if (statSwitches) {
            statSwitches.textContent = state.totalTabSwitches || 0;
        }

        // Idle time:
        //   Today (live): show X/180s progress before threshold, then real idle time after.
        //   Previous days: show stored totalIdleSec (no counting up).
        const idleProgress = state.idleProgressSeconds || 0;
        const idleTime = state.idleTimeSeconds || 0;
        const todayIdle = state.totalIdleSec || 0;
        const isViewingPast = state.__isPastDay === true;

        if (statIdleTime) {
            if (isViewingPast) {
                // Previous days: just show the stored idle total, no counting.
                statIdleTime.textContent = formatDurationHuman(todayIdle);
            } else if (stIdleState === "idle" || stIdleState === "locked") {
                if (idleTime > 0) {
                    // Past 180s threshold: show real idle time.
                    statIdleTime.textContent = formatDurationHuman(idleTime) + " (idle now)";
                } else {
                    // Counting toward 180s threshold: show progress.
                    statIdleTime.textContent = `${idleProgress}/180s`;
                }
            } else {
                statIdleTime.textContent = `0/180s`;
            }
        }
        if (curIdleFor) {
            curIdleFor.textContent = isViewingPast
                ? formatDurationHuman(todayIdle)
                : (idleTime > 0 ? formatDurationHuman(idleTime) : `${idleProgress}/180s`);
        }
        if (idleStateBadge) {
            const isIdle = stIdleState === "idle" || stIdleState === "locked";
            idleStateBadge.textContent = isIdle ? "IDLE" : "ACTIVE";
            idleStateBadge.style.color = isIdle ? "#f59e0b" : "#10b981";
            if (focusPill) focusPill.style.display = isIdle ? "none" : "flex";
        }

        // Focus Score + Grade
        const fsResult = computeFocusScore(state);
        if (fsResult.isCalibrating) {
            if (focusScoreVal) focusScoreVal.textContent = "--";
            if (focusGrade) {
                focusGrade.textContent = "Calibrating";
                focusGrade.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
                focusGrade.style.color = "#f59e0b";
                focusGrade.style.borderColor = "rgba(245, 158, 11, 0.4)";
            }
        } else {
            const score = fsResult.score;
            const grade = focusGradeLabel(score);
            if (focusScoreVal) focusScoreVal.textContent = score + "%";
            if (focusGrade) {
                focusGrade.textContent = grade.label;
                focusGrade.style.backgroundColor = grade.color + "15";
                focusGrade.style.color = grade.color;
                focusGrade.style.borderColor = grade.color + "40";
            }
        }

        // 2. Prepare Sites List & Aggregations
        let sites = Object.values(siteUsage);
        let totalActiveSec = 0;
        let totalVisits = 0;

        sites.forEach(s => {
            totalActiveSec += (s.totalSec || 0);
            totalVisits += (s.visitCount || 1);
        });

        // Sort by recency (most recently active or visited first)
        sites.sort((a, b) => {
            const timeA = a.lastActiveTimestamp || 0;
            const timeB = b.lastActiveTimestamp || 0;
            if (timeB !== timeA) return timeB - timeA;
            return (b.totalSec || 0) - (a.totalSec || 0);
        });

        // 3. 4 Main Overview Statistics (Browser-only scope)
        if (statTotalUsage) {
            statTotalUsage.textContent = formatDurationHuman(totalActiveSec);
            statTotalUsage.className = "metric-value scope-browser-only";
        }
        if (statSitesVisited) {
            statSitesVisited.textContent = sites.length;
            statSitesVisited.className = "metric-value scope-browser-only";
        }
        if (statMostUsed) {
            statMostUsed.textContent = (sites.length > 0 && sites[0].totalSec > 0) ? sanitizeSiteName(sites[0].name, sites[0].domain) : "None";
            statMostUsed.title = (sites.length > 0) ? `${sanitizeSiteName(sites[0].name, sites[0].domain)} (${sites[0].domain})` : "";
            statMostUsed.className = "metric-value truncate scope-browser-only";
        }
        if (statTotalVisits) {
            statTotalVisits.textContent = totalVisits;
            statTotalVisits.className = "metric-value scope-browser-only";
        }
        if (statSwitches) {
            statSwitches.textContent = state.totalTabSwitches || 0;
            statSwitches.className = "metric-value scope-browser-only";
        }
        if (statIdleTime) {
            statIdleTime.className = "metric-value scope-browser-only";
        }

        // 4. Current Website Section
        if (cur) {
            curName.textContent = sanitizeSiteName(cur.name, cur.domain);
            curDomain.textContent = cur.domain || "None";
            curCounter.textContent = formatCounterDigits(dwell);
            curActivated.textContent = cur.activatedTime || "Waiting";
            curUrl.textContent = cur.url || "None";
            curUrlLink.href = cur.url || "#";

            // Today's total for this specific domain
            const thisDomainTotal = (siteUsage[cur.domain] && siteUsage[cur.domain].totalSec) || dwell;
            curSiteToday.textContent = formatDurationHuman(thisDomainTotal);
        } else {
            curName.textContent = "No active tab detected";
            curDomain.textContent = "None";
            curCounter.textContent = "00:00:00";
            curActivated.textContent = "Waiting";
            curUrl.textContent = "None";
            curUrlLink.href = "#";
            curSiteToday.textContent = "0s";
        }

        // 5. Previous Website Section
        if (prev) {
            prevName.textContent = sanitizeSiteName(prev.name, prev.domain);
            prevDomain.textContent = prev.domain || "None";
            prevDuration.textContent = formatDurationHuman(prev.totalActiveSpent);
            prevLastTime.textContent = prev.lastActiveTime || "Waiting";
            prevUrlLink.href = prev.url || "#";
            prevUrlLink.style.display = prev.url ? "inline" : "none";
        } else {
            prevName.textContent = "No previous website yet";
            prevDomain.textContent = "None";
            prevDuration.textContent = "0s";
            prevLastTime.textContent = "None";
            prevUrlLink.style.display = "none";
        }

        // 6. Horizontal Usage Comparison Bars (Overview Tab)
        renderOverviewBars(sites, totalActiveSec);

        // 7. Websites Table (Websites Tab)
        renderWebsitesTable();

        // 8. Chronological Timeline (Timeline Tab)
        renderTimelineStream(timeline);

        // 9. Reports Tab
        renderReportsTab(sites, totalActiveSec, dwell, state.totalTabSwitches || 0, {
            idleState: state.idleState,
            idleProgressSeconds: state.idleProgressSeconds || 0,
            idleTimeSeconds: state.idleTimeSeconds || 0,
            totalIdleSec: state.totalIdleSec || 0,
            focusScore: computeFocusScore(state)
        });
    }

    let isOverviewExpanded = false;
    let isWebsitesTableExpanded = false;

    // Render Overview Horizontal Bars (Shows 4 most recent by default, More button to show all)
    function renderOverviewBars(sites, totalActiveSec) {
        if (!overviewComparisonBars) return;

        if (!sites || sites.length === 0 || totalActiveSec === 0) {
            overviewComparisonBars.innerHTML = `<div class="empty-state">No website activity recorded yet today. Visit any website in a new tab to start tracking. The extension monitors your active browser tab automatically.</div>`;
            return;
        }

        const maxSec = Math.max(...sites.map(s => s.totalSec || 0), 1);
        let html = "";
        const limit = isOverviewExpanded ? sites.length : 4;
        const visibleSlice = sites.slice(0, limit);

        visibleSlice.forEach((site, idx) => {
            const pct = Math.max(3, Math.round(((site.totalSec || 0) / maxSec) * 100));
            html += `
                <div class="usage-bar-item">
                    <div class="bar-meta">
                        <div class="bar-name-group">
                            <span class="bar-rank">#${idx + 1}</span>
                            <span class="bar-site-title">${escapeHtml(sanitizeSiteName(site.name, site.domain))}</span>
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

        // More option to show all remaining tabs
        if (sites.length > 4) {
            const remainingCount = sites.length - 4;
            const label = isOverviewExpanded ? "Show Less &uarr;" : `More (+${remainingCount} remaining tabs) &darr;`;
            html += `
                <div style="text-align: center; margin-top: 8px;">
                    <button id="btn-toggle-more-sites" style="background: rgba(59,130,246,0.14); border: 1px solid rgba(59,130,246,0.35); color: #38bdf8; font-size: 0.72rem; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
                        ${label}
                    </button>
                </div>
            `;
        }

        overviewComparisonBars.innerHTML = html;
    }

    // Render Full Websites Table (Shows 4 most recent by default, More button to show all)
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
            // Recency-first ordering
            sites.sort((a, b) => (b.lastActiveTimestamp || 0) - (a.lastActiveTimestamp || 0) || (b.totalSec || 0) - (a.totalSec || 0));
        }

        if (sites.length === 0) {
            fullWebsitesList.innerHTML = `<div class="empty-state">No matching websites found for "${escapeHtml(searchQuery)}".</div>`;
            return;
        }

        const limit = isWebsitesTableExpanded ? sites.length : 4;
        const visibleSlice = sites.slice(0, limit);

        let html = "";
        visibleSlice.forEach((site, index) => {
            html += `
                <div class="site-row">
                    <span class="td-rank">${index + 1}</span>
                    <div class="td-site-info">
                        <span class="td-name">${escapeHtml(sanitizeSiteName(site.name, site.domain))}</span>
                        <span class="td-domain">${escapeHtml(site.domain)}</span>
                    </div>
                    <span class="td-visits">${site.visitCount || 1}x</span>
                    <span class="td-duration">${formatDurationHuman(site.totalSec)}</span>
                </div>
            `;
        });

        // More option to show all remaining tabs in table
        if (sites.length > 4) {
            const remainingCount = sites.length - 4;
            const label = isWebsitesTableExpanded ? "Show Less &uarr;" : `More (+${remainingCount} remaining tabs) &darr;`;
            html += `
                <div style="text-align: center; margin-top: 10px; padding: 6px 0;">
                    <button id="btn-toggle-more-table" style="background: rgba(59,130,246,0.14); border: 1px solid rgba(59,130,246,0.35); color: #38bdf8; font-size: 0.72rem; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
                        ${label}
                    </button>
                </div>
            `;
        }

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
                            <span class="tl-site">${escapeHtml(sanitizeSiteName(item.appName || item.name, item.domain))}</span>
                            <span class="tl-time">${escapeHtml(item.timeStr || item.time || "N/A")}</span>
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
    function renderReportsTab(sites, totalActiveSec, currentDwell, tabSwitches, extra) {
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

        // Focus score indicator (numeric + grade)
        // computeFocusScore returns a number; calibrating state is determined by total browsing time
        const totalBrowsingSec = totalActiveSec || 0;
        const isCalibrating = totalBrowsingSec < 60 && !state.__isPastDay;
        const rawScore = extra && extra.focusScore !== undefined ? extra.focusScore : computeFocusScore({ totalTabSwitches: tabSwitches, siteUsage: latestState.siteUsage, totalIdleSec: latestState.totalIdleSec });
        const focusScore = isCalibrating ? "--" : (rawScore + "%");
        const grade = isCalibrating ? { label: "Calibrating", color: "#f59e0b" } : focusGradeLabel(rawScore);
        if (repFocusScore) {
            repFocusScore.textContent = `${focusScore} • ${grade.label}`;
            repFocusScore.style.color = grade.color;
            repFocusScore.className = "r-value highlight focus-score-pill";
        }

        // Idle time line in reports (renders once into a dedicated element)
        if (extra && repFocusScore) {
            let idleLine = document.getElementById("rep-idle-line");
            if (!idleLine) {
                idleLine = document.createElement("span");
                idleLine.id = "rep-idle-line";
                idleLine.className = "r-sub";
                idleLine.style.cssText = "display:block;margin-top:6px;font-size:0.7rem;color:var(--text-muted);";
                repFocusScore.parentElement.insertAdjacentElement("afterend", idleLine);
            }
            const stIdleState = extra.idleState || "active";
            const idleProgress = extra.idleProgressSeconds || 0;
            const idleTime = extra.idleTimeSeconds || 0;
            const todayIdle = extra.totalIdleSec || 0;
            if (stIdleState === "idle" || stIdleState === "locked") {
                if (idleTime > 0) {
                    idleLine.textContent = `💤 Idle now: ${formatDurationHuman(idleTime)}`;
                } else {
                    idleLine.textContent = `💤 Building idle: ${idleProgress}/180s`;
                }
            } else {
                idleLine.textContent = `💤 Idle today: ${formatDurationHuman(todayIdle)}`;
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

    // Event delegation for "More" expanders
    if (overviewComparisonBars) {
        overviewComparisonBars.addEventListener("click", e => {
            const btn = e.target.closest("#btn-toggle-more-sites");
            if (btn) {
                e.preventDefault();
                isOverviewExpanded = !isOverviewExpanded;
                renderDashboard();
            }
        });
    }

    if (fullWebsitesList) {
        fullWebsitesList.addEventListener("click", e => {
            const btn = e.target.closest("#btn-toggle-more-table");
            if (btn) {
                e.preventDefault();
                isWebsitesTableExpanded = !isWebsitesTableExpanded;
                renderWebsitesTable();
            }
        });
    }

    // Initial load from chrome.storage.local
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([
            "currentWebsite",
            "previousWebsite",
            "currentDwellSec",
            "totalTabSwitches",
            "siteUsage",
            "timeline",
            "historyByDate",
            "idleState",
            "totalIdleSec",
            "idleProgressSeconds",
            "idleTimeSeconds",
            "isWindowFocused",
            "lastActiveTime"
        ], res => {
            historyByDate = res.historyByDate || {};
            latestState = {
                currentWebsite: res.currentWebsite || null,
                previousWebsite: res.previousWebsite || null,
                currentDwellSec: res.currentDwellSec || 0,
                totalTabSwitches: res.totalTabSwitches || 0,
                siteUsage: res.siteUsage || {},
                timeline: res.timeline || [],
                isWindowFocused: res.isWindowFocused !== false,
                idleState: res.idleState || "active",
                totalIdleSec: res.totalIdleSec || 0,
                idleProgressSeconds: res.idleProgressSeconds || 0,
                idleTimeSeconds: res.idleTimeSeconds || 0,
                lastActiveTime: res.lastActiveTime || Date.now()
            };
            applyDateFilter();
        });

        // Listen for 1-second live heartbeat broadcasts from background.js
        chrome.runtime.onMessage.addListener(msg => {
            if (msg.type === "TICK_1S") {
                latestState = msg;
                if (selectedRange === "today") {
                    renderDashboard();
                }
            }
        });
    }

    // Local 1-second UI fallback tick (keeps dwell counter counting smoothly)
    setInterval(() => {
        if (!latestState) return;

        if (latestState.currentWebsite && latestState.isWindowFocused !== false) {
            latestState.currentDwellSec = (latestState.currentDwellSec || 0) + 1;
            if (curCounter) {
                curCounter.textContent = formatCounterDigits(latestState.currentDwellSec);
            }
            if (badgeSessionVal) {
                badgeSessionVal.textContent = formatCounterDigits(latestState.currentDwellSec);
            }
        }

        // Keep idle & focus readouts live while the popup is open
        const stIdleState = latestState.idleState || "active";
        const isIdle = stIdleState === "idle" || stIdleState === "locked";
        const idleProgress = latestState.idleProgressSeconds || 0;
        const idleTime = latestState.idleTimeSeconds || 0;
        const todayIdle = latestState.totalIdleSec || 0;

        if (curIdleFor) {
            curIdleFor.textContent = isIdle
                ? (idleTime > 0 ? formatDurationHuman(idleTime) : `${idleProgress}/180s`)
                : `0/180s`;
        }
        if (idleStateBadge) {
            idleStateBadge.textContent = isIdle ? "IDLE" : "ACTIVE";
            idleStateBadge.style.color = isIdle ? "#f59e0b" : "#10b981";
            if (focusPill) focusPill.style.display = isIdle ? "none" : "flex";
        }
        if (statIdleTime) {
            if (isIdle) {
                statIdleTime.textContent = idleTime > 0
                    ? formatDurationHuman(idleTime) + " (idle now)"
                    : `${idleProgress}/180s`;
            } else {
                statIdleTime.textContent = `0/180s`;
            }
        }
        if (focusScoreVal) {
            const fsRes = computeFocusScore(latestState);
            if (fsRes.isCalibrating) {
                focusScoreVal.textContent = "--";
                if (focusGrade) {
                    focusGrade.textContent = "Calibrating";
                    focusGrade.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
                    focusGrade.style.color = "#f59e0b";
                    focusGrade.style.borderColor = "rgba(245, 158, 11, 0.4)";
                }
            } else {
                const score = fsRes.score;
                const grade = focusGradeLabel(score);
                focusScoreVal.textContent = score + "%";
                if (focusGrade) {
                    focusGrade.textContent = grade.label;
                    focusGrade.style.backgroundColor = grade.color + "15";
                    focusGrade.style.color = grade.color;
                    focusGrade.style.borderColor = grade.color + "40";
                }
            }
        }
    }, 1000);
});
