/**
 * Dashboard UI Controller & Data Visualization Coordinator
 * 
 * Coordinates:
 * - Real-time metrics updating on 1-second interval
 * - Chart.js data visualizations (Category Donut, Top Sites Bar, Switch Velocity Line)
 * - Navigation across 8 modular dashboard views
 * - Extension sync status indicator
 * - Focus Session timer & Pomodoro controls
 * - Distraction incident notifications & AI Insights
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Engines
    const tracker = new AttentionTrackerCore();
    const focusManager = new FocusManager();
    const distractionDetector = new DistractionDetector(tracker, focusManager);
    const aiEngine = new AIInsightsEngine(tracker, focusManager, distractionDetector);
    const storage = new StorageManager();

    // Chart instances
    let categoryChart = null;
    let topSitesChart = null;
    let velocityChart = null;

    // DOM References - Navigation & Tabs
    const navItems = document.querySelectorAll(".nav-item");
    const viewSections = document.querySelectorAll(".view-section");
    const activeViewTitle = document.getElementById("active-view-title");

    // DOM References - Overview Header & Telemetry
    const globalStatusBadge = document.getElementById("global-status-badge");
    const globalClock = document.getElementById("global-clock");
    const statTotalTime = document.getElementById("stat-total-time");
    const statSitesVisited = document.getElementById("stat-sites-visited");
    const statTabSwitches = document.getElementById("stat-tab-switches");
    const statAttentionScore = document.getElementById("stat-attention-score");
    const statProductiveRatio = document.getElementById("stat-productive-ratio");

    // DOM References - Live Activity View
    const currentCard = document.getElementById("current-card");
    const currentName = document.getElementById("current-name");
    const currentDomain = document.getElementById("current-domain");
    const currentUrl = document.getElementById("current-url");
    const currentUrlLink = document.getElementById("current-url-link");
    const currentCategoryBadge = document.getElementById("current-category-badge");
    const currentDwell = document.getElementById("current-dwell");
    const currentUpdated = document.getElementById("current-updated");

    const previousCard = document.getElementById("previous-card");
    const previousName = document.getElementById("previous-name");
    const previousDomain = document.getElementById("previous-domain");
    const previousUrl = document.getElementById("previous-url");
    const previousUrlLink = document.getElementById("previous-url-link");
    const previousCategoryBadge = document.getElementById("previous-category-badge");
    const previousUpdated = document.getElementById("previous-updated");

    const activityTimeline = document.getElementById("activity-timeline");

    // DOM References - Navigation Bar Simulator
    const urlInput = document.getElementById("url-input");
    const btnVisitUrl = document.getElementById("btn-visit-url");
    const presetChips = document.querySelectorAll(".preset-chip");
    const btnAutoSim = document.getElementById("btn-auto-sim");
    const autoSimIndicator = document.getElementById("auto-sim-indicator");

    // DOM References - Focus Manager
    const focusTimerDisplay = document.getElementById("focus-timer-display");
    const focusGoalInput = document.getElementById("focus-goal-input");
    const focusDurationSelect = document.getElementById("focus-duration-select");
    const btnStartFocus = document.getElementById("btn-start-focus");
    const btnPauseFocus = document.getElementById("btn-pause-focus");
    const btnStopFocus = document.getElementById("btn-stop-focus");
    const focusStatusBanner = document.getElementById("focus-status-banner");
    const focusHistoryTable = document.getElementById("focus-history-table-body");
    const dailyGoalProgress = document.getElementById("daily-goal-progress");
    const dailyGoalText = document.getElementById("daily-goal-text");

    // DOM References - Distraction Analysis
    const distractionIncidentsList = document.getElementById("distraction-incidents-list");
    const statDistractionCount = document.getElementById("stat-distraction-count");

    // DOM References - AI Insights View
    const aiClusterBadge = document.getElementById("ai-cluster-badge");
    const aiClusterDesc = document.getElementById("ai-cluster-desc");
    const aiAttentionScore = document.getElementById("ai-attention-score");
    const aiRecommendationsContainer = document.getElementById("ai-recommendations-container");

    // DOM References - Settings
    const btnExportJson = document.getElementById("btn-export-json");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnClearAllData = document.getElementById("btn-clear-all-data");
    const overrideForm = document.getElementById("override-form");
    const overrideDomainInput = document.getElementById("override-domain-input");
    const overrideCategorySelect = document.getElementById("override-category-select");
    const overrideProductiveToggle = document.getElementById("override-productive-toggle");
    const overridesList = document.getElementById("overrides-list");

    // State Variables
    let isAutoSimActive = false;
    let autoSimTimer = null;
    const SIM_URLS = [
        "https://springboard.infosys.com/learning-tracker",
        "https://github.com/trending",
        "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
        "https://scholar.google.com/scholar?q=cognitive+attention",
        "https://stackoverflow.com/questions",
        "https://en.wikipedia.org/wiki/Attention_management",
        "https://www.youtube.com/watch?v=python-machine-learning",
        "https://instagram.com",
        "https://leetcode.com/problemset"
    ];
    let simIdx = 0;

    // 2. Navigation Tab Switching
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetView = item.getAttribute("data-view");
            if (!targetView) return;

            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            viewSections.forEach(sec => {
                if (sec.id === `view-${targetView}`) {
                    sec.classList.add("active");
                } else {
                    sec.classList.remove("active");
                }
            });

            if (activeViewTitle) {
                activeViewTitle.textContent = item.querySelector(".nav-label") ? item.querySelector(".nav-label").textContent : "Dashboard";
            }

            // Refresh charts if switching to analytics views
            if (targetView === "categories" || targetView === "websites" || targetView === "overview") {
                updateCharts();
            }
        });
    });

    // 3. Time Formatting Helper
    function formatDuration(totalSeconds) {
        if (!totalSeconds || totalSeconds < 0) return "0s";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    // 4. Update Live Activity Cards
    function renderLiveCards(current, previous) {
        if (current) {
            currentName.textContent = current.websiteName;
            currentDomain.textContent = current.domain;
            currentUrl.textContent = current.url;
            currentUrlLink.href = current.url;
            currentUpdated.textContent = current.lastUpdated;

            if (currentCategoryBadge) {
                currentCategoryBadge.textContent = `${current.isProductive ? "🟢 Productive" : "🔴 Distracting"} • ${current.categoryMeta ? current.categoryMeta.name : current.category}`;
                currentCategoryBadge.style.backgroundColor = current.isProductive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
                currentCategoryBadge.style.color = current.isProductive ? "#10b981" : "#ef4444";
                currentCategoryBadge.style.borderColor = current.isProductive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)";
            }
        }

        if (previous) {
            previousName.textContent = previous.websiteName;
            previousDomain.textContent = previous.domain;
            previousUrl.textContent = previous.url;
            previousUrlLink.href = previous.url;
            previousUpdated.textContent = previous.lastUpdated;

            if (previousCategoryBadge) {
                previousCategoryBadge.textContent = `${previous.isProductive ? "🟢 Productive" : "🔴 Distracting"} • ${previous.categoryMeta ? previous.categoryMeta.name : previous.category}`;
                previousCategoryBadge.style.backgroundColor = previous.isProductive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";
                previousCategoryBadge.style.color = previous.isProductive ? "#10b981" : "#ef4444";
                previousCategoryBadge.style.borderColor = previous.isProductive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)";
            }
        }
    }

    // Append to live activity timeline log
    function appendTimelineEvent(title, meta, isProductive = true) {
        if (!activityTimeline) return;
        const item = document.createElement("div");
        item.className = "timeline-item";
        const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
        item.innerHTML = `
            <div class="timeline-dot ${isProductive ? 'dot-green' : 'dot-red'}"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-title">${escapeHtml(title)}</span>
                    <span class="timeline-time">${timeStr}</span>
                </div>
                <div class="timeline-meta">${escapeHtml(meta)}</div>
            </div>
        `;
        activityTimeline.insertBefore(item, activityTimeline.firstChild);
        while (activityTimeline.children.length > 25) {
            activityTimeline.removeChild(activityTimeline.lastChild);
        }
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

    // 5. Chart.js Visualizations
    function initCharts() {
        if (typeof Chart === "undefined") return;

        // Chart styling defaults
        Chart.defaults.color = "#94a3b8";
        Chart.defaults.borderColor = "#334155";
        Chart.defaults.font.family = "'Inter', sans-serif";

        // A. Category Doughnut Chart
        const catCanvas = document.getElementById("category-donut-chart");
        if (catCanvas) {
            categoryChart = new Chart(catCanvas, {
                type: "doughnut",
                data: {
                    labels: ["Education", "Programming", "Research", "Productivity", "Social Media", "Entertainment", "Other"],
                    datasets: [{
                        data: [45, 30, 20, 15, 8, 5, 2],
                        backgroundColor: [
                            "#10b981", "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899", "#ef4444", "#64748b"
                        ],
                        borderWidth: 2,
                        borderColor: "#0f172a"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: "right", labels: { boxWidth: 12, padding: 12 } }
                    },
                    cutout: "70%"
                }
            });
        }

        // B. Top Sites Bar Chart
        const sitesCanvas = document.getElementById("top-sites-bar-chart");
        if (sitesCanvas) {
            topSitesChart = new Chart(sitesCanvas, {
                type: "bar",
                data: {
                    labels: ["Infosys Springboard", "GitHub", "MDN Docs", "Google Scholar", "LeetCode"],
                    datasets: [{
                        label: "Active Dwell (Minutes)",
                        data: [25, 18, 14, 10, 8],
                        backgroundColor: "rgba(59, 130, 246, 0.75)",
                        borderColor: "#3b82f6",
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: "y",
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: "rgba(255,255,255,0.05)" } },
                        y: { grid: { display: false } }
                    }
                }
            });
        }

        // C. Tab Switch Velocity Line Chart
        const velocityCanvas = document.getElementById("velocity-line-chart");
        if (velocityCanvas) {
            velocityChart = new Chart(velocityCanvas, {
                type: "line",
                data: {
                    labels: ["10m ago", "8m ago", "6m ago", "4m ago", "2m ago", "Now"],
                    datasets: [{
                        label: "Switches / Min",
                        data: [1.5, 2.0, 4.2, 7.5, 3.1, 1.8],
                        borderColor: "#f59e0b",
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { min: 0, suggestedMax: 10, grid: { color: "rgba(255,255,255,0.05)" } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }

    function updateCharts() {
        if (!categoryChart) return;

        const history = tracker.getActivityHistory();
        const catDurations = {
            EDUCATION: 0,
            PROGRAMMING: 0,
            RESEARCH: 0,
            PRODUCTIVITY: 0,
            SOCIAL_MEDIA: 0,
            ENTERTAINMENT: 0,
            OTHER: 0
        };

        const siteDurations = {};

        history.forEach(h => {
            const dur = Math.max(1, h.durationSeconds);
            if (catDurations[h.category] !== undefined) {
                catDurations[h.category] += dur;
            } else {
                catDurations.OTHER += dur;
            }

            const siteName = h.websiteName || h.domain;
            siteDurations[siteName] = (siteDurations[siteName] || 0) + dur;
        });

        // Add current dwell
        if (tracker.currentWebsite) {
            const cat = tracker.currentWebsite.category;
            const cd = tracker.currentDwellSeconds;
            if (catDurations[cat] !== undefined) {
                catDurations[cat] += cd;
            } else {
                catDurations.OTHER += cd;
            }
            const curSite = tracker.currentWebsite.websiteName || tracker.currentWebsite.domain;
            siteDurations[curSite] = (siteDurations[curSite] || 0) + cd;
        }

        // Update category donut
        categoryChart.data.datasets[0].data = [
            Math.round(catDurations.EDUCATION / 60) || 1,
            Math.round(catDurations.PROGRAMMING / 60) || 1,
            Math.round(catDurations.RESEARCH / 60) || 1,
            Math.round(catDurations.PRODUCTIVITY / 60) || 1,
            Math.round(catDurations.SOCIAL_MEDIA / 60) || 0,
            Math.round(catDurations.ENTERTAINMENT / 60) || 0,
            Math.round(catDurations.OTHER / 60) || 0
        ];
        categoryChart.update();

        // Update Top sites bar
        if (topSitesChart) {
            const sortedSites = Object.entries(siteDurations).sort((a, b) => b[1] - a[1]).slice(0, 5);
            if (sortedSites.length > 0) {
                topSitesChart.data.labels = sortedSites.map(s => s[0]);
                topSitesChart.data.datasets[0].data = sortedSites.map(s => Math.round(s[1] / 60 * 10) / 10);
                topSitesChart.update();
            }
        }
    }

    // 6. Focus Session UI Controller
    function renderFocusUI(session) {
        if (!focusTimerDisplay) return;

        if (!session) {
            focusTimerDisplay.textContent = "25:00";
            if (focusStatusBanner) {
                focusStatusBanner.textContent = "No Active Focus Session";
                focusStatusBanner.className = "focus-banner focus-banner-idle";
            }
            if (btnStartFocus) btnStartFocus.style.display = "inline-flex";
            if (btnPauseFocus) btnPauseFocus.style.display = "none";
            if (btnStopFocus) btnStopFocus.style.display = "none";
            return;
        }

        const mins = Math.floor(session.remainingSeconds / 60);
        const secs = session.remainingSeconds % 60;
        focusTimerDisplay.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

        if (focusStatusBanner) {
            focusStatusBanner.textContent = session.isPaused ? `⏸ Paused: "${session.goal}"` : `🎯 Active Focus: "${session.goal}" (Score: ${session.focusScore}%)`;
            focusStatusBanner.className = session.isPaused ? "focus-banner focus-banner-paused" : "focus-banner focus-banner-active";
        }

        if (btnStartFocus) btnStartFocus.style.display = "none";
        if (btnPauseFocus) {
            btnPauseFocus.style.display = "inline-flex";
            btnPauseFocus.textContent = session.isPaused ? "▶ Resume" : "⏸ Pause";
        }
        if (btnStopFocus) btnStopFocus.style.display = "inline-flex";
    }

    function renderFocusHistory() {
        if (!focusHistoryTable) return;
        const history = focusManager.getHistory();
        focusHistoryTable.innerHTML = "";

        if (history.length === 0) {
            focusHistoryTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No focus sessions recorded yet</td></tr>`;
            return;
        }

        history.forEach(item => {
            const tr = document.createElement("tr");
            const durationMins = Math.round(item.elapsedSeconds / 60);
            const statusClass = item.status === "COMPLETED" ? "badge-success" : "badge-warning";
            tr.innerHTML = `
                <td><strong>${escapeHtml(item.goal)}</strong></td>
                <td>${durationMins}m / ${item.targetDurationMinutes}m</td>
                <td><span class="badge ${statusClass}">${item.status}</span></td>
                <td><span class="score-pill">${item.focusScore}%</span></td>
                <td>${new Date(item.startTime).toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit" })}</td>
            `;
            focusHistoryTable.appendChild(tr);
        });

        // Update daily goal progress
        const todayMinutes = focusManager.getTodayFocusMinutes();
        const target = focusManager.dailyGoalMinutes;
        const pct = Math.min(100, Math.round((todayMinutes / target) * 100));

        if (dailyGoalProgress) dailyGoalProgress.style.width = `${pct}%`;
        if (dailyGoalText) dailyGoalText.textContent = `${todayMinutes} / ${target} mins (${pct}%)`;
    }

    // 7. Distraction Incident Feed
    function renderDistractionFeed() {
        if (!distractionIncidentsList) return;
        const incidents = distractionDetector.getIncidents();
        if (statDistractionCount) statDistractionCount.textContent = incidents.length;

        distractionIncidentsList.innerHTML = "";
        if (incidents.length === 0) {
            distractionIncidentsList.innerHTML = `<div class="empty-state">No distraction incidents detected yet. Keep up the high focus!</div>`;
            return;
        }

        incidents.slice(0, 15).forEach(inc => {
            const card = document.createElement("div");
            card.className = `incident-card incident-${inc.severity.toLowerCase()}`;
            card.innerHTML = `
                <div class="incident-header">
                    <span class="incident-badge badge-${inc.severity.toLowerCase()}">${inc.severity}</span>
                    <span class="incident-title">${escapeHtml(inc.title)}</span>
                    <span class="incident-time">${inc.formattedTime}</span>
                </div>
                <div class="incident-desc">${escapeHtml(inc.description)}</div>
                <div class="incident-action">💡 <em>Recommendation:</em> ${escapeHtml(inc.action)}</div>
            `;
            distractionIncidentsList.appendChild(card);
        });
    }

    // 8. AI Insights View
    function renderAIInsights() {
        const analysis = aiEngine.analyze();

        if (aiClusterBadge) {
            aiClusterBadge.textContent = analysis.cluster.label;
            aiClusterBadge.style.backgroundColor = `${analysis.cluster.badgeColor}25`;
            aiClusterBadge.style.color = analysis.cluster.badgeColor;
            aiClusterBadge.style.borderColor = `${analysis.cluster.badgeColor}60`;
        }
        if (aiClusterDesc) {
            aiClusterDesc.textContent = analysis.cluster.description;
        }
        if (aiAttentionScore) {
            aiAttentionScore.textContent = `${analysis.attentionScore}/100`;
        }

        if (aiRecommendationsContainer) {
            aiRecommendationsContainer.innerHTML = "";
            analysis.recommendations.forEach(rec => {
                const rcard = document.createElement("div");
                rcard.className = "recommendation-card";
                rcard.innerHTML = `
                    <div class="rec-icon">${rec.icon}</div>
                    <div class="rec-body">
                        <div class="rec-header">
                            <span class="rec-cat">${rec.category}</span>
                            <span class="rec-title">${escapeHtml(rec.title)}</span>
                        </div>
                        <p class="rec-text">${escapeHtml(rec.text)}</p>
                    </div>
                `;
                aiRecommendationsContainer.appendChild(rcard);
            });
        }
    }

    // 9. Toast Notification Popups
    function showNotificationToast(title, message, isDistraction = false) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast-card ${isDistraction ? 'toast-distraction' : 'toast-info'}`;
        toast.innerHTML = `
            <div class="toast-icon">${isDistraction ? '⚠️' : '🎯'}</div>
            <div class="toast-content">
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(message)}</p>
            </div>
            <button class="toast-close">&times;</button>
        `;

        toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 5000);
    }

    // 10. Register Core Engine Subscriptions
    tracker.on("tick", (tickData) => {
        // Global header
        if (globalClock) globalClock.textContent = tickData.formattedTime;
        if (statTotalTime) statTotalTime.textContent = formatDuration(tickData.totalBrowsingSeconds);
        if (statTabSwitches) statTabSwitches.textContent = tickData.totalTabSwitches;
        if (currentDwell) currentDwell.textContent = formatDuration(tickData.currentDwellSeconds);

        // Update overview cards
        const history = tracker.getActivityHistory();
        if (statSitesVisited) {
            const uniqueDomains = new Set(history.map(h => h.domain));
            statSitesVisited.textContent = uniqueDomains.size || 1;
        }

        // Productivity percentage
        const analysis = aiEngine.analyze();
        if (statAttentionScore) {
            statAttentionScore.textContent = `${analysis.attentionScore}%`;
        }
        if (statProductiveRatio) {
            const pct = Math.round(analysis.features.raw.productiveRatio * 100);
            statProductiveRatio.textContent = `${pct}%`;
        }

        // Periodic Chart Refresh (every 5 seconds)
        if (tickData.tickCount % 5 === 0) {
            updateCharts();
            renderFocusHistory();
        }

        // Periodic AI Insights Update (every 10 seconds)
        if (tickData.tickCount % 10 === 0) {
            renderAIInsights();
        }
    });

    tracker.on("transition", (transData) => {
        renderLiveCards(transData.currentWebsite, transData.previousWebsite);
        appendTimelineEvent(
            transData.currentWebsite.websiteName,
            `Switched to ${transData.currentWebsite.domain} • ${transData.currentWebsite.category}`,
            transData.currentWebsite.isProductive
        );

        // Store activity record
        storage.saveActivity({
            websiteName: transData.currentWebsite.websiteName,
            domain: transData.currentWebsite.domain,
            url: transData.currentWebsite.url,
            category: transData.currentWebsite.category,
            isProductive: transData.currentWebsite.isProductive,
            durationSeconds: 1
        });

        updateCharts();
    });

    focusManager.on("tick", (session) => {
        renderFocusUI(session);
    });

    focusManager.on("sessionComplete", (session) => {
        renderFocusUI(null);
        renderFocusHistory();
        showNotificationToast("Focus Session Complete! 🎉", `Completed "${session.goal}" with Focus Score: ${session.focusScore}%. Time for a 5-minute break!`, false);
    });

    focusManager.on("sessionInterrupted", (data) => {
        showNotificationToast("Focus Session Warning", `You visited ${data.domain} during focus block "${data.session.goal}". Score: ${data.session.focusScore}%`, true);
    });

    distractionDetector.onDistraction((incident) => {
        renderDistractionFeed();
        showNotificationToast(incident.title, incident.description, true);
    });

    // 11. Extension Synchronization (Listens to real-time events from Extension)
    window.addEventListener("message", (event) => {
        if (!event.data || event.data.source !== "ATTENTION_EXTENSION") return;

        if (event.data.type === "TAB_NAVIGATED" || event.data.type === "TAB_SWITCHED") {
            tracker.recordNavigation(event.data.url, event.data.title, event.data.tabId);
            if (globalStatusBadge) {
                globalStatusBadge.textContent = "🟢 Live Extension Connected";
                globalStatusBadge.className = "status-badge status-connected";
            }
        }
    });

    // Check for extension bridge in localStorage
    window.addEventListener("storage", (e) => {
        if (e.key === "attention_extension_live_tab" && e.newValue) {
            try {
                const tabData = JSON.parse(e.newValue);
                tracker.recordNavigation(tabData.url, tabData.title, tabData.tabId);
                if (globalStatusBadge) {
                    globalStatusBadge.textContent = "🟢 Live Extension Connected";
                    globalStatusBadge.className = "status-badge status-connected";
                }
            } catch {}
        }
    });

    // 12. Navigation Bar Controls (Testing Simulator)
    function handleVisit() {
        if (!urlInput) return;
        const val = urlInput.value.trim();
        if (val) {
            tracker.recordNavigation(val);
            urlInput.value = "";
        }
    }

    if (btnVisitUrl) btnVisitUrl.addEventListener("click", handleVisit);
    if (urlInput) {
        urlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleVisit();
        });
    }

    presetChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const url = chip.getAttribute("data-url");
            if (url) tracker.recordNavigation(url);
        });
    });

    // Auto Simulation Mode Toggle
    if (btnAutoSim) {
        btnAutoSim.addEventListener("click", () => {
            isAutoSimActive = !isAutoSimActive;
            if (isAutoSimActive) {
                btnAutoSim.textContent = "⏸ Stop Simulation";
                btnAutoSim.classList.add("btn-warning");
                if (autoSimIndicator) autoSimIndicator.style.display = "inline-flex";

                autoSimTimer = setInterval(() => {
                    simIdx = (simIdx + 1) % SIM_URLS.length;
                    tracker.recordNavigation(SIM_URLS[simIdx]);
                }, 4000);
            } else {
                clearInterval(autoSimTimer);
                btnAutoSim.textContent = "▶ Start Auto Simulation";
                btnAutoSim.classList.remove("btn-warning");
                if (autoSimIndicator) autoSimIndicator.style.display = "none";
            }
        });
    }

    // 13. Focus Timer Buttons
    if (btnStartFocus) {
        btnStartFocus.addEventListener("click", () => {
            const goal = focusGoalInput ? focusGoalInput.value : "Deep Study Session";
            const dur = focusDurationSelect ? parseInt(focusDurationSelect.value, 10) : 25;
            focusManager.startSession(goal, dur);
            showNotificationToast("Focus Session Launched", `Goal: "${goal}" for ${dur} minutes. Distracting websites will trigger alerts!`);
        });
    }

    if (btnPauseFocus) {
        btnPauseFocus.addEventListener("click", () => {
            focusManager.pauseSession();
        });
    }

    if (btnStopFocus) {
        btnStopFocus.addEventListener("click", () => {
            if (confirm("Are you sure you want to cancel the active focus session?")) {
                focusManager.stopSession(true);
                renderFocusUI(null);
                renderFocusHistory();
            }
        });
    }

    // 14. Data Management & Settings Buttons
    if (btnExportJson) btnExportJson.addEventListener("click", () => storage.exportJSON());
    if (btnExportCsv) btnExportCsv.addEventListener("click", () => storage.exportCSV());
    if (btnClearAllData) {
        btnClearAllData.addEventListener("click", () => {
            if (confirm("Are you sure you want to permanently delete all browsing logs and attention history?")) {
                storage.clearAllData();
                tracker.clearActivity();
                distractionDetector.clearIncidents();
                updateCharts();
                renderFocusHistory();
                renderDistractionFeed();
                alert("All activity records have been safely erased.");
            }
        });
    }

    // Category Override Form
    if (overrideForm) {
        overrideForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const dom = overrideDomainInput.value.trim();
            const cat = overrideCategorySelect.value;
            const isProd = overrideProductiveToggle.checked;

            if (dom) {
                URLCategorizer.setOverride(dom, cat, isProd);
                overrideDomainInput.value = "";
                renderOverridesList();
                alert(`Domain override saved: ${dom} is now classified as ${cat} (${isProd ? "Productive" : "Distracting"}).`);
            }
        });
    }

    function renderOverridesList() {
        if (!overridesList) return;
        const overrides = URLCategorizer.getOverrides();
        overridesList.innerHTML = "";
        const entries = Object.entries(overrides);

        if (entries.length === 0) {
            overridesList.innerHTML = `<li class="text-muted">No custom overrides defined. Default curated dictionary active.</li>`;
            return;
        }

        entries.forEach(([dom, val]) => {
            const li = document.createElement("li");
            li.className = "override-item";
            li.innerHTML = `
                <span><strong>${escapeHtml(dom)}</strong> &rarr; ${val.category} (${val.isProductive ? "🟢 Productive" : "🔴 Distracting"})</span>
                <button class="btn-sm btn-danger btn-remove-override" data-domain="${escapeHtml(dom)}">Delete</button>
            `;
            li.querySelector(".btn-remove-override").addEventListener("click", () => {
                URLCategorizer.removeOverride(dom);
                renderOverridesList();
            });
            overridesList.appendChild(li);
        });
    }

    // 15. Initial Render & Launch
    renderLiveCards(tracker.currentWebsite, tracker.previousWebsite);
    initCharts();
    updateCharts();
    renderFocusHistory();
    renderDistractionFeed();
    renderAIInsights();
    renderOverridesList();
    tracker.start();
});

