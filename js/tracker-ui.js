/**
 * Current and Previous Website Usage Tracker - Standalone Web Controller
 * Real-time active counter, daily aggregation, usage comparison, and activity timeline.
 */

document.addEventListener("DOMContentLoaded", () => {
    // State
    let currentWebsite = null;
    let previousWebsite = null;
    let currentDwellSec = 0;
    let totalBrowsingSec = 0;
    let totalTabSwitches = 0;
    let isWindowFocused = true;
    let siteUsage = {};
    let timeline = [];

    // DOM Elements - Current
    const curName = document.getElementById("cur-name");
    const curDomain = document.getElementById("cur-domain");
    const curCounter = document.getElementById("cur-counter");
    const curUrl = document.getElementById("cur-url");
    const curUrlLink = document.getElementById("cur-url-link");
    const curActivated = document.getElementById("cur-activated");
    const curUpdated = document.getElementById("cur-updated");

    // DOM Elements - Previous
    const prevName = document.getElementById("prev-name");
    const prevDomain = document.getElementById("prev-domain");
    const prevDuration = document.getElementById("prev-duration");
    const prevUrl = document.getElementById("prev-url");
    const prevUrlLink = document.getElementById("prev-url-link");
    const prevLastTime = document.getElementById("prev-last-time");

    // DOM Elements - Most Used Website
    const topSiteName = document.getElementById("top-site-name");
    const topSiteDomain = document.getElementById("top-site-domain");
    const topSiteTime = document.getElementById("top-site-time");
    const topSitePct = document.getElementById("top-site-pct");

    // DOM Elements - Daily Summary
    const sumTotalTime = document.getElementById("sum-total-time");
    const sumSitesCount = document.getElementById("sum-sites-count");
    const sumSwitches = document.getElementById("sum-switches");

    // DOM Elements - Comparison & Timeline
    const comparisonTableBody = document.getElementById("comparison-table-body");
    const timelineContainer = document.getElementById("timeline-container");

    // DOM Elements - Navigation Bar
    const urlInput = document.getElementById("url-input");
    const btnVisit = document.getElementById("btn-visit");
    const presetBtns = document.querySelectorAll(".preset-btn");
    const btnAutoSim = document.getElementById("btn-auto-sim");
    const simBadge = document.getElementById("sim-badge");

    // Window Focus/Blur Guard
    window.addEventListener("focus", () => { isWindowFocused = true; });
    window.addEventListener("blur", () => { isWindowFocused = false; });

    // Format HH:MM:SS for the active counter
    function formatCounterDigits(totalSeconds) {
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

    function formatClockTime(d) {
        return (d || new Date()).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });
    }

    function extractDomain(urlStr) {
        try {
            const u = new URL(urlStr.startsWith("http") ? urlStr : "https://" + urlStr);
            let host = u.hostname.toLowerCase();
            if (host.startsWith("www.")) host = host.slice(4);
            return host;
        } catch {
            return "unknown";
        }
    }

    const KNOWN_SITES = {
        "google.com": "Google",
        "youtube.com": "YouTube",
        "github.com": "GitHub",
        "stackoverflow.com": "Stack Overflow",
        "wikipedia.org": "Wikipedia",
        "springboard.infosys.com": "Infosys Springboard",
        "chatgpt.com": "ChatGPT",
        "leetcode.com": "LeetCode"
    };

    function extractSiteName(urlStr) {
        const domain = extractDomain(urlStr);
        if (KNOWN_SITES[domain]) return KNOWN_SITES[domain];
        const parts = domain.split(".");
        const brand = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        return brand.charAt(0).toUpperCase() + brand.slice(1);
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

    // 1. Initial State Setup
    function initDefaultState() {
        const now = new Date();
        const prevTime = new Date(now.getTime() - 30000);

        previousWebsite = {
            name: "Google",
            domain: "google.com",
            url: "https://www.google.com/search?q=infosys+springboard",
            totalActiveSpent: 30,
            lastActiveTime: formatClockTime(prevTime)
        };

        currentWebsite = {
            name: "Infosys Springboard",
            domain: "springboard.infosys.com",
            url: "https://springboard.infosys.com/learning-tracker",
            activatedTime: formatClockTime(now),
            lastUpdatedTime: formatClockTime(now)
        };

        totalTabSwitches = 1;
        totalBrowsingSec = 30;

        siteUsage["google.com"] = { name: "Google", domain: "google.com", totalSec: 30, visitCount: 1 };
        siteUsage["springboard.infosys.com"] = { name: "Infosys Springboard", domain: "springboard.infosys.com", totalSec: 0, visitCount: 1 };

        timeline.push({
            name: "Google",
            domain: "google.com",
            timeStr: formatClockTime(prevTime),
            durationSec: 30,
            actionText: "Google opened"
        });

        renderAll();
    }

    // 2. Navigation Transition
    function navigateTo(rawUrl) {
        if (!rawUrl || typeof rawUrl !== "string") return;
        let urlStr = rawUrl.trim();
        if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
            urlStr = "https://" + urlStr;
        }

        const now = new Date();
        const domain = extractDomain(urlStr);
        const siteName = extractSiteName(urlStr);

        // Finalize previous website
        if (currentWebsite) {
            const elapsed = currentDwellSec;
            const prevDom = currentWebsite.domain;

            if (!siteUsage[prevDom]) {
                siteUsage[prevDom] = { name: currentWebsite.name, domain: prevDom, totalSec: 0, visitCount: 0 };
            }
            siteUsage[prevDom].totalSec += elapsed;

            timeline.push({
                name: currentWebsite.name,
                domain: prevDom,
                timeStr: currentWebsite.activatedTime,
                durationSec: Math.max(1, elapsed),
                actionText: `Switched to ${siteName}`
            });

            previousWebsite = {
                name: currentWebsite.name,
                domain: prevDom,
                url: currentWebsite.url,
                totalActiveSpent: elapsed,
                lastActiveTime: formatClockTime(now)
            };
        }

        totalTabSwitches++;
        currentDwellSec = 0;

        if (!siteUsage[domain]) {
            siteUsage[domain] = { name: siteName, domain: domain, totalSec: 0, visitCount: 1 };
        } else {
            siteUsage[domain].visitCount++;
        }

        currentWebsite = {
            name: siteName,
            domain: domain,
            url: urlStr,
            activatedTime: formatClockTime(now),
            lastUpdatedTime: formatClockTime(now)
        };

        renderAll();
    }

    // 3. Render Views
    function renderAll() {
        // Current Card
        if (currentWebsite) {
            curName.textContent = currentWebsite.name;
            curDomain.textContent = currentWebsite.domain;
            curUrl.textContent = currentWebsite.url;
            curUrlLink.href = currentWebsite.url;
            curActivated.textContent = currentWebsite.activatedTime;
            curUpdated.textContent = currentWebsite.lastUpdatedTime;
            curCounter.textContent = formatCounterDigits(currentDwellSec);
        }

        // Previous Card
        if (previousWebsite) {
            prevName.textContent = previousWebsite.name;
            prevDomain.textContent = previousWebsite.domain;
            prevDuration.textContent = formatDurationHuman(previousWebsite.totalActiveSpent);
            prevUrl.textContent = previousWebsite.url;
            prevUrlLink.href = previousWebsite.url;
            prevLastTime.textContent = previousWebsite.lastActiveTime;
        }

        // Aggregates & Ranking
        const sitesArr = Object.values(siteUsage);
        sitesArr.sort((a, b) => b.totalSec - a.totalSec);

        // Daily Summary
        sumTotalTime.textContent = formatDurationHuman(totalBrowsingSec);
        sumSitesCount.textContent = sitesArr.length;
        sumSwitches.textContent = totalTabSwitches;

        // Most-Used Website Banner
        if (sitesArr.length > 0 && sitesArr[0].totalSec > 0) {
            const top = sitesArr[0];
            const pct = Math.round((top.totalSec / Math.max(1, totalBrowsingSec)) * 100);
            topSiteName.textContent = top.name;
            topSiteDomain.textContent = top.domain;
            topSiteTime.textContent = formatDurationHuman(top.totalSec);
            topSitePct.textContent = `${pct}% of active time`;
        } else if (currentWebsite) {
            topSiteName.textContent = currentWebsite.name;
            topSiteDomain.textContent = currentWebsite.domain;
            topSiteTime.textContent = formatDurationHuman(currentDwellSec);
            topSitePct.textContent = `100% of active time`;
        }

        // Comparison Table & Progress Bars
        if (comparisonTableBody) {
            comparisonTableBody.innerHTML = "";
            const maxSec = sitesArr[0] ? Math.max(1, sitesArr[0].totalSec) : 1;

            sitesArr.forEach((s, idx) => {
                const tr = document.createElement("tr");
                const pct = Math.round((s.totalSec / Math.max(1, totalBrowsingSec)) * 100);
                const barWidth = Math.max(4, Math.round((s.totalSec / maxSec) * 100));

                tr.innerHTML = `
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong>${escapeHtml(s.name)}</strong> <code style="font-size:0.75rem; color:#60a5fa;">${escapeHtml(s.domain)}</code></td>
                    <td><strong>${formatDurationHuman(s.totalSec)}</strong></td>
                    <td>${s.visitCount} visits</td>
                    <td style="width: 200px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 9999px; overflow: hidden;">
                                <div style="width: ${barWidth}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #10b981);"></div>
                            </div>
                            <span style="font-size: 0.72rem; color: #94a3b8; min-width: 35px;">${pct}%</span>
                        </div>
                    </td>
                `;
                comparisonTableBody.appendChild(tr);
            });
        }

        // Chronological Activity Timeline
        if (timelineContainer) {
            timelineContainer.innerHTML = "";
            const reversed = [...timeline].reverse();

            reversed.slice(0, 30).forEach(item => {
                const row = document.createElement("div");
                row.className = "timeline-row";
                row.innerHTML = `
                    <span class="tl-time">${escapeHtml(item.timeStr)}</span>
                    <span class="tl-dot"></span>
                    <span class="tl-action"><strong>${escapeHtml(item.actionText)}</strong></span>
                    <span class="tl-duration">${formatDurationHuman(item.durationSec)}</span>
                `;
                timelineContainer.appendChild(row);
            });
        }
    }

    // 4. Continuous 1-Second Heartbeat Engine
    setInterval(() => {
        if (isWindowFocused && currentWebsite) {
            currentDwellSec++;
            totalBrowsingSec++;
            currentWebsite.lastUpdatedTime = formatClockTime(new Date());

            const dom = currentWebsite.domain;
            if (siteUsage[dom]) {
                siteUsage[dom].totalSec++;
            }

            curCounter.textContent = formatCounterDigits(currentDwellSec);
            sumTotalTime.textContent = formatDurationHuman(totalBrowsingSec);

            // Re-render summary and top site every second
            const sitesArr = Object.values(siteUsage);
            sitesArr.sort((a, b) => b.totalSec - a.totalSec);
            if (sitesArr.length > 0) {
                const top = sitesArr[0];
                const pct = Math.round((top.totalSec / Math.max(1, totalBrowsingSec)) * 100);
                topSiteName.textContent = top.name;
                topSiteDomain.textContent = top.domain;
                topSiteTime.textContent = formatDurationHuman(top.totalSec);
                topSitePct.textContent = `${pct}% of active time`;
            }
        }
    }, 1000);

    // 5. Navigation Simulator Controls
    btnVisit.addEventListener("click", () => {
        if (urlInput.value.trim()) {
            navigateTo(urlInput.value.trim());
            urlInput.value = "";
        }
    });

    urlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && urlInput.value.trim()) {
            navigateTo(urlInput.value.trim());
            urlInput.value = "";
        }
    });

    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const url = btn.getAttribute("data-url");
            if (url) navigateTo(url);
        });
    });

    // Auto Simulation Mode Toggle
    let autoSimTimer = null;
    let isAutoSim = false;
    const SIM_URLS = [
        "https://www.youtube.com",
        "https://www.google.com/search?q=infosys+springboard",
        "https://github.com",
        "https://chatgpt.com",
        "https://springboard.infosys.com/learning-tracker",
        "https://en.wikipedia.org/wiki/Web_browser",
        "https://leetcode.com/problemset"
    ];
    let simIdx = 0;

    btnAutoSim.addEventListener("click", () => {
        isAutoSim = !isAutoSim;
        if (isAutoSim) {
            btnAutoSim.textContent = "⏸ Stop Simulation";
            btnAutoSim.classList.add("btn-warning");
            simBadge.style.display = "inline-flex";

            autoSimTimer = setInterval(() => {
                simIdx = (simIdx + 1) % SIM_URLS.length;
                navigateTo(SIM_URLS[simIdx]);
            }, 4000);
        } else {
            clearInterval(autoSimTimer);
            btnAutoSim.textContent = "▶ Start Auto Simulation";
            btnAutoSim.classList.remove("btn-warning");
            simBadge.style.display = "none";
        }
    });

    // Initialize
    initDefaultState();
});

