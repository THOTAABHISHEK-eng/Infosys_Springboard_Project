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
    const appUsageTbody = document.getElementById("app-usage-tbody");

    let allHistory = {};
    let isHistoricalView = false;
    let isAppTableExpanded = false;
    let isDaemonConnected = false;
    let hasLoadedFirstState = false;

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

    /* ========================================================================
       10 USER-FACING DISTRACTION CATEGORIES
       Development, Learning, Professional, Communication, Entertainment,
       Social Media, Shopping, News, Other
       ======================================================================== */
    const CAT_DISPLAY = {
        Development: { label: "Development", color: "#3b82f6" },
        Learning: { label: "Learning", color: "#10b981" },
        Professional: { label: "Professional", color: "#8b5cf6" },
        Communication: { label: "Communication", color: "#f59e0b" },
        Entertainment: { label: "Entertainment", color: "#ef4444" },
        "Social Media": { label: "Social Media", color: "#ec4899" },
        Shopping: { label: "Shopping", color: "#eab308" },
        News: { label: "News", color: "#6366f1" },
        Other: { label: "Other", color: "#64748b" }
    };

    const PRODUCTIVE_CATEGORIES = ["Development", "Learning", "Professional"];

    function displayCategory(category) {
        const cat = (category || "Other").toString();
        const direct = CAT_DISPLAY[cat];
        if (direct) return direct;
        const c = cat.toLowerCase();
        if (c === "development") return CAT_DISPLAY.Development;
        if (c === "learning" || c === "education") return CAT_DISPLAY.Learning;
        if (c === "professional" || c === "productivity") return CAT_DISPLAY.Professional;
        if (c === "communication") return CAT_DISPLAY.Communication;
        if (c === "entertainment" || c === "media") return CAT_DISPLAY.Entertainment;
        if (c === "social media") return CAT_DISPLAY["Social Media"];
        if (c === "shopping") return CAT_DISPLAY.Shopping;
        if (c === "news") return CAT_DISPLAY.News;
        if (c === "web browser") return CAT_DISPLAY.Other;
        if (c === "utilities" || c === "system" || c === "general application") return CAT_DISPLAY.Other;
        return CAT_DISPLAY.Other;
    }

    /* ========================================================================
       FOCUS SCORE
       Starts at 100.
       -20 : too much tab switching (> 20 switches today)
       -5  : any communication time
       -N  : entertainment reduces score proportionally to its share
       -10 : idle for 10 minutes or more
       Grades: >80 Excellent, 60-79 Good, 40-59 Fair, <40 Needs Work
       ======================================================================== */
    function computeFocusScore(state) {
        if (!state) return 100;
        let score = 100;
        const summary = state.summary || {};
        const switches = summary.totalSwitches || 0;
        const apps = state.appUsage || [];
        let totalSec = 0;
        let entSec = 0;
        let commSec = 0;
        apps.forEach(a => {
            const sec = a.totalSeconds || 0;
            totalSec += sec;
            const cat = displayCategory(a.category);
            if (cat.label === "Entertainment") entSec += sec;
            if (cat.label === "Communication") commSec += sec;
        });
        if (switches > 20) score -= 20;
        if (commSec > 0) score -= 5;
        score -= Math.round((entSec / Math.max(1, totalSec)) * 30);
        const idleSec = state.idleSeconds || 0;
        if (idleSec >= 600) score -= 10;
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    function focusGrade(score) {
        if (score > 80) return { label: "Excellent", color: "#10b981" };
        if (score >= 60) return { label: "Good", color: "#3b82f6" };
        if (score >= 40) return { label: "Fair", color: "#f59e0b" };
        return { label: "Needs Work", color: "#ef4444" };
    }

    /* ========================================================================
       IDLE TIME (page-level: no mouse/keyboard/scroll/click input)
       Idle time only starts counting AFTER 180 seconds of inactivity.
       Before that we show progress toward the threshold (e.g. "29/180").
       ======================================================================== */
    const IDLE_THRESHOLD_SEC = 180;
    let idleProgressSeconds = 0;   // seconds of inactivity so far (0 -> 180)
    let idleTimeSeconds = 0;       // actual idle time counted after threshold crossed
    let stateIdleSeconds = 0;      // idle seconds exposed to focus score (0 until threshold crossed)
    let lastPageActivity = Date.now();
    function resetPageActivity() { lastPageActivity = Date.now(); }
    ["mousemove", "keydown", "click", "scroll"].forEach(ev => {
        document.addEventListener(ev, resetPageActivity, { passive: true });
    });

    /* ========================================================================
       FEATURE READINESS (features display immediately as telemetry arrives)
       ======================================================================== */
    const FEATURE_REQUIRED_SEC = {
        "duration-comparison": 0,
        "focus-score": 0,
        "time-loss": 0,
        "idle-time": 0
    };
    function featureReady(feature) {
        const total = (latestState && latestState.summary) ? latestState.summary.totalActiveSeconds : 0;
        const required = FEATURE_REQUIRED_SEC[feature] || 0;
        return Math.max(0, total - required);
    }
    function remainingSeconds(feature) {
        const total = (latestState && latestState.summary) ? latestState.summary.totalActiveSeconds : 0;
        const required = FEATURE_REQUIRED_SEC[feature] || 0;
        return Math.max(0, required - total);
    }
    function readinessHtml(feature, label) {
        const rem = remainingSeconds(feature);
        if (rem <= 0) {
            return `<span class="ready-badge" style="color:var(--accent-emerald);">✓ Ready</span>`;
        }
        return `<span class="wait-badge" style="color:var(--accent-amber);">⏳ ${label} needs ${rem}s more of usage</span>`;
    }

    /* ========================================================================
       AI API KEYS (client-side localStorage only)
       ======================================================================== */
    const API_KEY_STORAGE_KEY = "aw_api_keys_v1";
    function getApiKeys() {
        try { return JSON.parse(localStorage.getItem(API_KEY_STORAGE_KEY) || "{}"); } catch { return {}; }
    }
    function setApiKey(provider, key) {
        const keys = getApiKeys();
        keys[provider] = key;
        try { localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(keys)); } catch {}
    }

    async function callGemini(apiKey, prompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!res.ok) throw new Error("Gemini HTTP " + res.status);
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    async function callGroq(apiKey, prompt) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.2 })
        });
        if (!res.ok) throw new Error("Groq HTTP " + res.status);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    }

    function buildTimeLossJson(state) {
        const apps = (state.appUsage || []).slice().sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));
        const total = Math.max(1, apps.reduce((s, a) => s + (a.totalSeconds || 0), 0));
        const byCategory = {};
        apps.forEach(a => {
            const cat = displayCategory(a.category).label;
            byCategory[cat] = (byCategory[cat] || 0) + (a.totalSeconds || 0);
        });
        const timeLost = Object.entries(byCategory)
            .filter(([cat]) => !PRODUCTIVE_CATEGORIES.includes(cat))
            .map(([cat, sec]) => ({ category: cat, seconds: sec, percent: Math.round((sec / total) * 100) }))
            .sort((a, b) => b.seconds - a.seconds);
        const topDistractions = apps
            .filter(a => !PRODUCTIVE_CATEGORIES.includes(displayCategory(a.category).label))
            .slice(0, 5)
            .map(a => ({
                name: a.name,
                title: a.title,
                category: displayCategory(a.category).label,
                seconds: a.totalSeconds || 0
            }));
        return {
            generatedAt: new Date().toISOString(),
            totalActiveSeconds: total,
            totalActiveFormatted: formatDurationHuman(total),
            focusScore: computeFocusScore(state),
            switches: summaryTotalSwitches(state),
            idleSeconds: state.idleSeconds || 0,
            timeLostByCategory: timeLost,
            topDistractions: topDistractions,
            suggestions: []
        };
    }

    function summaryTotalSwitches(state) {
        return (state.summary && state.summary.totalSwitches !== undefined) ? state.summary.totalSwitches : 0;
    }

    async function generateTimeLossSummary() {
        if (!latestState) {
            alert("No activity data available yet. Start tracking first.");
            return;
        }
        const score = computeFocusScore(latestState);
        const fsScore = document.getElementById("fs-score");
        const fsGrade = document.getElementById("fs-grade");
        const fsJson = document.getElementById("fs-json");
        const fsWrap = document.getElementById("fs-json-wrap");
        if (fsScore) fsScore.textContent = score;
        if (fsGrade) {
            const g = focusGrade(score);
            fsGrade.textContent = g.label;
            fsGrade.style.backgroundColor = g.color + "15";
            fsGrade.style.color = g.color;
            fsGrade.style.borderColor = g.color + "40";
        }
        const summaryObj = buildTimeLossJson(latestState);
        let jsonText = JSON.stringify(summaryObj, null, 2);
        if (score > 80) {
            // Excellent focus: no suggestions, just a JSON summary of time lost (via Gemini/Groq if keys configured)
            const keys = getApiKeys();
            const provider = keys.gemini ? "gemini" : (keys.groq ? "groq" : null);
            if (provider) {
                try {
                    const prompt = "Given this browsing-activity JSON, rewrite it as a clean JSON summary of where the user LOST time. " +
                        "Return ONLY valid JSON with keys: focusScore, totalActiveSeconds, timeLostByCategory (category, seconds, percent), topDistractions (name, category, seconds), suggestions (empty array). " +
                        "Data: " + JSON.stringify(summaryObj);
                    const aiText = provider === "gemini" ? await callGemini(keys.gemini, prompt) : await callGroq(keys.groq, prompt);
                    const parsed = JSON.parse(aiText.replace(/```json/g, "").replace(/```/g, "").trim());
                    jsonText = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    console.warn("AI summary unavailable, using local summary:", e);
                }
            }
        }
        if (fsJson) fsJson.textContent = jsonText;
        if (fsWrap) fsWrap.style.display = "block";
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
    // Track current scope filter for the app usage table
    let currentScopeFilter = "all";

    function renderState(state) {
        if (!state) return;
        latestState = state;

        const cur = state.current;
        const prev = state.previous;
        const summary = state.summary || {};
        const apps = state.appUsage || [];
        const timeline = state.timeline || [];

        // Attach page-level idle time so the focus score stays current
        // Only for live (today) view - never overwrite historical idle data
        if (!isHistoricalView) {
            state.idleSeconds = stateIdleSeconds;
        }

        // Historical view banner
        const histBanner = document.getElementById("historical-view-banner");
        if (histBanner) {
            if (isHistoricalView) {
                const dateLabel = historyDatePicker ? historyDatePicker.value : "selected date";
                histBanner.textContent = "Viewing: " + dateLabel + " - Historical Data";
                histBanner.style.display = "block";
            } else {
                histBanner.style.display = "none";
            }
        }

        // 1. Current Active Window / Application
        if (cur && cur.appName) {
            curAppName.textContent = cur.appName;
            const curCat = displayCategory(cur.category);
            curAppCategory.textContent = curCat.label;
            curAppCategory.style.color = curCat.color;
            curAppCategory.style.borderColor = curCat.color + "40";
            curAppCategory.style.backgroundColor = curCat.color + "12";
            curWindowTitle.textContent = cur.title || cur.appName;
            curCounter.textContent = formatCounter(cur.dwellSeconds);
            curActivated.textContent = cur.activatedTime || "Waiting";
            curUpdated.textContent = cur.lastUpdated || "Waiting";

            if (curAvatar) {
                const glyph = getAppGlyph(cur.appName);
                curAvatar.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;">${glyph}</span>`;
            }
        } else {
            if (isHistoricalView) {
                curAppName.textContent = "Historical Snapshot";
                curAppCategory.textContent = "Archived";
                curWindowTitle.textContent = `Viewing archived data for ${historyDatePicker ? historyDatePicker.value : "selected date"}`;
                curCounter.textContent = "--:--:--";
                curActivated.textContent = "Concluded";
                curUpdated.textContent = "Concluded";
            } else if (!hasLoadedFirstState && !latestState) {
                curAppName.textContent = "Data loading...";
                curAppCategory.textContent = "Connecting";
                curWindowTitle.textContent = "Connecting to desktop monitoring daemon";
                curCounter.textContent = "00:00:00";
                curActivated.textContent = "Waiting";
                curUpdated.textContent = "Waiting";
            } else if (!isDaemonConnected) {
                curAppName.textContent = "Desktop Daemon Offline";
                curAppCategory.textContent = "Offline";
                curWindowTitle.textContent = "Start tracker-daemon.ps1 or start.bat to resume background tracking";
                curCounter.textContent = "--:--:--";
                curActivated.textContent = "Offline";
                curUpdated.textContent = "Offline";
            } else if (stateIdleSeconds >= 180) {
                curAppName.textContent = "User is Idle";
                curAppCategory.textContent = "Inactivity";
                curWindowTitle.textContent = "No keyboard or mouse activity detected on system";
                curCounter.textContent = formatCounter(stateIdleSeconds);
                curActivated.textContent = "Idle";
                curUpdated.textContent = "Idle";
            } else {
                curAppName.textContent = "No active foreground window detected";
                curAppCategory.textContent = "Standby";
                curWindowTitle.textContent = "Desktop or lock screen in focus. Switch to any app window to track";
                curCounter.textContent = "00:00:00";
                curActivated.textContent = "Standby";
                curUpdated.textContent = "Standby";
            }
        }

        // 2. Previous Active Window / Application
        if (prev && prev.appName) {
            prevAppName.textContent = prev.appName;
            const prevCat = displayCategory(prev.category);
            prevAppCategory.textContent = prevCat.label;
            prevAppCategory.style.color = prevCat.color;
            prevAppCategory.style.borderColor = prevCat.color + "40";
            prevAppCategory.style.backgroundColor = prevCat.color + "12";
            prevWindowTitle.textContent = prev.title || prev.appName;
            prevDuration.textContent = prev.activeDurationFormatted || formatDurationHuman(prev.activeDurationSec);
            prevLastTime.textContent = prev.lastActiveTime || "Waiting";
        } else {
            if (isHistoricalView) {
                prevAppName.textContent = "Historical Day";
                prevAppCategory.textContent = "Archived";
                prevWindowTitle.textContent = "All daily window transitions archived below in activity stream";
                prevDuration.textContent = summary.totalActiveFormatted || formatDurationHuman(summary.totalActiveSeconds || 0);
                prevLastTime.textContent = "Archived";
            } else {
                prevAppName.textContent = "No previous application yet";
                prevAppCategory.textContent = "None";
                prevWindowTitle.textContent = "None";
                prevDuration.textContent = "0s";
                prevLastTime.textContent = "None";
            }
        }

        // 3. Summary Metrics / KPIs
        sumTotalTime.textContent = summary.totalActiveFormatted || formatDurationHuman(summary.totalActiveSeconds);
        sumAppsCount.textContent = summary.distinctAppsCount || apps.length || 0;
        sumSwitches.textContent = summary.totalSwitches || 0;

        // Focus Score tile (require 60s of data before showing a real score)
        const totalActiveSec = summary.totalActiveSeconds || 0;
        const isCalibrating = totalActiveSec < 60 && !isHistoricalView;
        const focusScore = computeFocusScore(state);
        const fGrade = focusGrade(focusScore);
        const focusScoreVal = document.getElementById("focus-score-val");
        const focusScoreGrade = document.getElementById("focus-score-grade");
        const focusScoreHint = document.getElementById("focus-score-hint");
        if (isCalibrating) {
            if (focusScoreVal) focusScoreVal.textContent = "--";
            if (focusScoreGrade) {
                focusScoreGrade.textContent = "Calibrating";
                focusScoreGrade.style.backgroundColor = "rgba(100,116,139,0.15)";
                focusScoreGrade.style.color = "#94a3b8";
                focusScoreGrade.style.borderColor = "rgba(100,116,139,0.4)";
            }
            if (focusScoreHint) focusScoreHint.textContent = `Collecting data... ${totalActiveSec}s / 60s`;
        } else {
            if (focusScoreVal) focusScoreVal.textContent = focusScore;
            if (focusScoreGrade) {
                focusScoreGrade.textContent = fGrade.label;
                focusScoreGrade.style.backgroundColor = fGrade.color + "15";
                focusScoreGrade.style.color = fGrade.color;
                focusScoreGrade.style.borderColor = fGrade.color + "40";
            }
            if (focusScoreHint) focusScoreHint.textContent = `${fGrade.label} focus (${focusScore}/100)`;
        }

        // Idle Time tile (enhanced messaging)
        const idleSec = state.idleSeconds || 0;
        const idleTimeVal = document.getElementById("idle-time-val");
        const idleStateText = document.getElementById("idle-state-text");
        if (idleTimeVal) idleTimeVal.textContent = formatDurationHuman(idleSec);
        if (idleStateText) {
            if (isHistoricalView) {
                idleStateText.textContent = "Historical data";
                idleStateText.style.color = "var(--text-muted)";
            } else if (idleSec >= 600) {
                idleStateText.textContent = "Idle confirmed: " + formatDurationHuman(idleSec);
                idleStateText.style.color = "#ef4444";
            } else if (idleSec > 0) {
                idleStateText.textContent = "Idle: " + formatDurationHuman(idleSec);
                idleStateText.style.color = "#f59e0b";
            } else {
                idleStateText.textContent = "No inactivity detected";
                idleStateText.style.color = "var(--text-muted)";
            }
        }

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

        // Scope filter helper: classify each app entry
        function getAppScope(app) {
            const name = (app.name || "").toLowerCase();
            const cat = (app.category || "").toLowerCase();
            if (cat === "system" || name === "task switching" || name.includes("explorer")) return "system";
            if (name.includes("brave") || name.includes("chrome") || name.includes("edge") || name.includes("firefox") || cat === "web browser") return "browser";
            return "desktop";
        }

        // Apply scope filter
        const filteredAppList = currentScopeFilter === "all"
            ? appList
            : appList.filter(app => getAppScope(app) === currentScopeFilter);

        if (filteredAppList.length === 0) {
            if (tableMoreContainer) tableMoreContainer.style.display = "none";
            appUsageTbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-row">
                        <div class="empty-wrap">
                            <div class="empty-pulse"></div>
                            <span>${currentScopeFilter === "all" ? "No application activity logged yet. Switch between WhatsApp, Brave, Edge, VS Code, or other apps on your laptop to begin." : "No " + currentScopeFilter + " activity recorded in this session."}</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            const maxSec = filteredAppList[0].totalSeconds || 1;
            const totalSec = summary.totalActiveSeconds || maxSec;
            const limit = isAppTableExpanded ? filteredAppList.length : 4;
            const visibleApps = filteredAppList.slice(0, limit);
            let rowsHtml = "";

            visibleApps.forEach((app, idx) => {
                const pctOfTotal = Math.round(((app.totalSeconds || 0) / Math.max(1, totalSec)) * 100);
                const barWidth = Math.max(2, Math.round(((app.totalSeconds || 0) / maxSec) * 100));
                const glyph = getAppGlyph(app.name);
                const scope = getAppScope(app);
                const isBrowserProcess = scope === "browser";
                const browserNote = isBrowserProcess ? ' <span style="font-size:0.62rem;color:var(--text-muted);font-style:italic;">(desktop process time)</span>' : "";

                rowsHtml += `
                    <tr>
                        <td class="cell-rank">#${idx + 1}</td>
                        <td title="${escapeHtml(app.name)}">
                            <div class="table-app-cell">
                                <span class="app-glyph">${glyph}</span>
                                <span class="app-name-text">${escapeHtml(app.name)}${browserNote}</span>
                            </div>
                        </td>
                        <td><span class="category-tag" style="color:${displayCategory(app.category).color};border-color:${displayCategory(app.category).color}40;background:${displayCategory(app.category).color}12;">${escapeHtml(displayCategory(app.category).label)}</span></td>
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
                if (filteredAppList.length > 4) {
                    tableMoreContainer.style.display = "block";
                    const remainingCount = filteredAppList.length - 4;
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

        // User Duration Comparison readiness
        const durationReadyEl = document.getElementById("duration-readiness");
        if (durationReadyEl) {
            durationReadyEl.innerHTML = readinessHtml("duration-comparison", "Duration Comparison");
        }

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
                const appName = item.appName || item.name || item.AppName || "Application";
                const timeVal = item.time || item.timeStr || item.Time || "";
                const titleVal = item.title || item.domain || item.Title || appName;
                const durSec = item.durationSec || item.DurationSec || 0;
                const durFormatted = item.durationFormatted || item.DurationFormatted || formatDurationHuman(durSec);
                const itemCat = displayCategory(item.category || item.Category || "Other");

                tlHtml += `
                    <div class="timeline-item">
                        <span class="tl-indicator" style="background:${itemCat.color};"></span>
                        <div class="tl-content">
                            <div class="tl-row-top">
                                <span class="tl-name">${escapeHtml(appName)}</span>
                                <span class="tl-cat-badge" style="color:${itemCat.color};border-color:${itemCat.color}40;background:${itemCat.color}12;">${escapeHtml(itemCat.label)}</span>
                                <span class="tl-time-stamp">${escapeHtml(timeVal)}</span>
                            </div>
                            <span class="tl-title-text" title="${escapeHtml(titleVal)}">${escapeHtml(titleVal)}</span>
                            <span class="tl-dur-badge">${escapeHtml(durFormatted)}</span>
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
                isDaemonConnected = true;
                hasLoadedFirstState = true;
                renderState(data);
                if (statusLabel) statusLabel.textContent = "Desktop Daemon Connected";
                return;
            } else {
                isDaemonConnected = false;
            }
        } catch {
            isDaemonConnected = false;
        }
        // Never reset to zero: keep showing the last collected data
        if (latestState) {
            renderState(latestState);
            if (statusLabel) statusLabel.textContent = isDaemonConnected ? "Desktop Daemon Connected" : "Daemon Offline - Showing last collected data";
            return;
        }
        checkExtensionBridge();
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
        
        let html = `<option value="today">Today (Live)</option><option value="alltime">All Time (All Days)</option>`;
        const todayStr = new Date().toISOString().slice(0, 10);
        dates.forEach(d => {
            // Skip today's date key - "Today (Live)" already covers it.
            // Only show past dates to avoid duplicate "Today" entries.
            if (d === todayStr) return;
            html += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
        });
        historyDatePicker.innerHTML = html;
        if (dates.includes(currentVal) || currentVal === "today" || currentVal === "alltime") {
            historyDatePicker.value = currentVal;
        } else {
            historyDatePicker.value = "today";
        }
    }

    /**
     * Aggregate every stored day into one "All Time" view so the dashboard never
     * starts from zero when a new day begins.
     */
    function mapAllTimeHistory() {
    let totalActiveSeconds = 0;
    let totalSwitches = 0;
    const appMap = {};
    const timeline = [];

    Object.values(allHistory || {}).forEach(day => {
        totalActiveSeconds += (day.totalActiveSeconds || 0);
        totalSwitches += (day.totalSwitches || 0);
        (day.timeline || []).forEach(t => timeline.push(t));
        (day.appUsage || []).forEach(a => {
            const key = a.name || "Unknown";
            if (!appMap[key]) {
                appMap[key] = { name: key, category: a.category || "Other", totalSeconds: 0, switchCount: 0 };
            }
            appMap[key].totalSeconds += (a.totalSeconds || 0);
            appMap[key].switchCount += (a.switchCount || 0);
        });
    });

    const appUsage = Object.values(appMap).sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));
    const top = appUsage[0];
    const mostUsedApp = top ? {
        name: top.name,
        category: top.category,
        durationFormatted: formatDurationHuman(top.totalSeconds),
        percentage: Math.round((top.totalSeconds / Math.max(1, totalActiveSeconds)) * 100)
    } : null;

    return {
        current: null,
        previous: null,
        summary: {
            totalActiveSeconds: totalActiveSeconds,
            totalActiveFormatted: formatDurationHuman(totalActiveSeconds),
            totalSwitches: totalSwitches,
            distinctAppsCount: appUsage.length,
            mostUsedApp: mostUsedApp
        },
        appUsage: appUsage,
        timeline: timeline.slice(0, 200)
    };
}

    if (historyDatePicker) {
        historyDatePicker.addEventListener("change", () => {
            const val = historyDatePicker.value;
            if (val === "today") {
                isHistoricalView = false;
                pollDaemonState();
            } else if (val === "alltime") {
                isHistoricalView = true;
                renderState(mapAllTimeHistory());
                renderFocusPanel();
                if (statusLabel) statusLabel.textContent = "Historical View: All Time (All Days)";
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
                renderFocusPanel();
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

    // Scope filter pill buttons (All / Desktop / Browser / System)
    document.querySelectorAll(".scope-pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".scope-pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentScopeFilter = btn.dataset.scope || "all";
            isAppTableExpanded = false;
            if (latestState) renderState(latestState);
        });
    });

    // Export CSV Report (enhanced: includes header, focus score, and timeline)
    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
            if (!latestState || !latestState.appUsage || latestState.appUsage.length === 0) {
                alert("No application usage data logged yet to export.");
                return;
            }

            const exportDate = new Date().toISOString().slice(0, 10);
            const summary = latestState.summary || {};
            const score = computeFocusScore(latestState);
            const grade = focusGrade(score);

            const rows = [
                ["ActivityWatch Usage Report"],
                ["Export Date", exportDate],
                ["Total Active Time", formatDurationHuman(summary.totalActiveSeconds || 0)],
                ["Context Switches", summary.totalSwitches || 0],
                ["Focus Score", score + "/100 (" + grade.label + ")"],
                [],
                ["--- Application / Website Usage ---"],
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

            // Timeline section
            const timeline = latestState.timeline || [];
            if (timeline.length > 0) {
                rows.push([]);
                rows.push(["--- Activity Timeline ---"]);
                rows.push(["Time", "Application", "Title", "Duration (Seconds)", "Duration (Formatted)"]);
                timeline.forEach(t => {
                    const tName = t.appName || t.name || t.AppName || "Unknown";
                    const tTime = t.time || t.timeStr || t.Time || "";
                    const tTitle = t.title || t.domain || t.Title || "";
                    const tDur = t.durationSec || t.DurationSec || 0;
                    rows.push([
                        `"${tTime}"`,
                        `"${tName.replace(/"/g, '""')}"`,
                        `"${tTitle.replace(/"/g, '""')}"`,
                        tDur,
                        `"${formatDurationHuman(tDur)}"`
                    ]);
                });
            }

            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `ActivityWatch_Usage_Report_${exportDate}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    }

    // Reset Session
    if (btnResetSession) {
        btnResetSession.addEventListener("click", () => {
            if (confirm("Reset TODAY's desktop tracking session? This resets current active counts to zero. Historical data for previous days is preserved.")) {
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

    // Scope filter buttons for app usage table (All / Desktop / Browser / System)
    const scopeButtons = document.querySelectorAll(".scope-pill-btn");
    scopeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            scopeButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentScopeFilter = btn.getAttribute("data-scope") || "all";
            if (latestState) renderState(latestState);
        });
    });

    /* ========================================================================
       FOCUS PANEL: live score + time-loss breakdown + AI JSON summary
       ======================================================================== */
    function renderFocusPanel() {
        if (!latestState) return;
        const summary = latestState.summary || {};
        const totalActiveSec = summary.totalActiveSeconds || 0;
        const panelCalibrating = totalActiveSec < 60 && !isHistoricalView;
        const score = computeFocusScore(latestState);
        const g = focusGrade(score);
        const fsScore = document.getElementById("fs-score");
        const fsGrade = document.getElementById("fs-grade");
        if (panelCalibrating) {
            if (fsScore) fsScore.textContent = "--";
            if (fsGrade) {
                fsGrade.textContent = "Calibrating";
                fsGrade.style.backgroundColor = "rgba(100,116,139,0.15)";
                fsGrade.style.color = "#94a3b8";
                fsGrade.style.borderColor = "rgba(100,116,139,0.4)";
            }
        } else {
            if (fsScore) fsScore.textContent = score;
            if (fsGrade) {
                fsGrade.textContent = g.label;
                fsGrade.style.backgroundColor = g.color + "15";
                fsGrade.style.color = g.color;
                fsGrade.style.borderColor = g.color + "40";
            }
        }
        const apps = latestState.appUsage || [];
        let entSec = 0, commSec = 0;
        apps.forEach(a => {
            const cat = displayCategory(a.category);
            if (cat.label === "Entertainment") entSec += (a.totalSeconds || 0);
            if (cat.label === "Communication") commSec += (a.totalSeconds || 0);
        });
        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el("fs-switches", latestState.summary ? latestState.summary.totalSwitches : 0);
        el("fs-idle", formatDurationHuman(latestState.idleSeconds || 0));
        el("fs-ent", formatDurationHuman(entSec));
        el("fs-comm", formatDurationHuman(commSec));

        // Readiness badges
        const fsReady = document.getElementById("fs-readiness");
        if (fsReady) fsReady.innerHTML = readinessHtml("focus-score", "Focus Score");
        const tlReady = document.getElementById("timeloss-readiness");
        if (tlReady) tlReady.innerHTML = readinessHtml("time-loss", "Time Loss Summary");
    }

    if (document.getElementById("fs-btn-summary")) {
        document.getElementById("fs-btn-summary").addEventListener("click", generateTimeLossSummary);
    }
    if (document.getElementById("fs-btn-api")) {
        document.getElementById("fs-btn-api").addEventListener("click", () => {
            const provider = prompt("Configure AI API key:\nType 'gemini' or 'groq'", "");
            if (!provider) return;
            const key = prompt(`Enter your ${provider} API key (stored locally in this browser only):`, "");
            if (key) {
                setApiKey(provider, key);
                alert(`${provider} API key saved locally. Click "Generate Time-Loss JSON Summary" to use it.`);
            }
        });
    }

    // Page-level idle clock: progress toward 180s threshold, then count real idle time
    // Only runs for live (today) view - idle time never changes for previous days
    setInterval(() => {
        if (isHistoricalView) return;

        const inactiveSec = Math.floor((Date.now() - lastPageActivity) / 1000);
        const idleEl = document.getElementById("idle-time-val");
        const idleTxt = document.getElementById("idle-state-text");

        if (inactiveSec < IDLE_THRESHOLD_SEC) {
            // Counting toward threshold: show "29/180"
            idleProgressSeconds = inactiveSec;
            if (idleEl) idleEl.textContent = `${idleProgressSeconds}/${IDLE_THRESHOLD_SEC}s`;
            if (idleTxt) {
                idleTxt.textContent = `Building idle baseline...`;
                idleTxt.style.color = "var(--text-muted)";
            }
        } else {
            // Threshold crossed: count actual idle time beyond 180s
            idleTimeSeconds = inactiveSec - IDLE_THRESHOLD_SEC;
            if (idleEl) idleEl.textContent = formatDurationHuman(idleTimeSeconds);
            if (idleTxt) {
                idleTxt.textContent = `Idle for ${formatDurationHuman(idleTimeSeconds)}`;
                idleTxt.style.color = idleTimeSeconds >= 600 ? "#ef4444" : "#f59e0b";
            }
        }

        // Expose post-threshold idle time for the focus-score penalty (>= 10 min / 600s reduces score),
        // while the display above still shows 180s progress then post-threshold idle time.
        stateIdleSeconds = Math.max(0, inactiveSec - IDLE_THRESHOLD_SEC);
    }, 1000);

    // Refresh focus panel readouts every few seconds
    setInterval(renderFocusPanel, 3000);
    renderFocusPanel();
});
