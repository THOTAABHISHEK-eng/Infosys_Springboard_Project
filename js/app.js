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

    function renderCategoryBreakdown(apps, totalSec) {
        const stackedBar = document.getElementById("cat-stacked-bar");
        const chipsGrid = document.getElementById("cat-chips-grid");
        const prodSummary = document.getElementById("cat-productivity-summary");
        if (!chipsGrid) return;

        // Tally dwell for all 10 unified categories
        const catTotals = {
            Development: 0,
            Learning: 0,
            Professional: 0,
            Communication: 0,
            Entertainment: 0,
            "Social Media": 0,
            Shopping: 0,
            News: 0,
            Utilities: 0,
            Other: 0
        };

        const appList = Array.isArray(apps) ? apps : Object.values(apps || {});
        appList.forEach(a => {
            const cat = displayCategory(a.category, a.name).label;
            const sec = a.totalSeconds || 0;
            if (catTotals[cat] !== undefined) {
                catTotals[cat] += sec;
            } else {
                catTotals.Other += sec;
            }
        });

        const effectiveTotal = Math.max(1, totalSec || Object.values(catTotals).reduce((s, v) => s + v, 0));
        const productiveSec = catTotals.Development + catTotals.Learning + catTotals.Professional;
        const rawProdPct = (productiveSec / effectiveTotal) * 100;
        let prodPctDisplay = Math.round(rawProdPct) + "%";
        if (rawProdPct > 0 && rawProdPct < 1) {
            prodPctDisplay = rawProdPct.toFixed(1) + "%";
        }

        if (prodSummary) {
            prodSummary.textContent = `Productive Dwell: ${prodPctDisplay}`;
            prodSummary.style.color = rawProdPct >= 60 ? "var(--accent-emerald)" : rawProdPct >= 35 ? "#38bdf8" : "#f59e0b";
        }

        // Render Multi-Color Horizontal Stacked Progress Bar
        if (stackedBar) {
            if (totalSec <= 0) {
                stackedBar.innerHTML = `<div style="width: 100%; background: rgba(255,255,255,0.06); text-align: center; font-size: 0.65rem; color: var(--text-muted); line-height: 12px;">Awaiting telemetry...</div>`;
            } else {
                let barHtml = "";
                Object.entries(catTotals).forEach(([catName, sec]) => {
                    if (sec > 0) {
                        const pct = Math.max(1, Math.round((sec / effectiveTotal) * 100));
                        const color = (CAT_DISPLAY[catName] && CAT_DISPLAY[catName].color) || "#64748b";
                        barHtml += `<div title="${catName}: ${formatDurationHuman(sec)} (${pct}%)" style="width: ${pct}%; background: ${color}; transition: width 0.3s ease;"></div>`;
                    }
                });
                stackedBar.innerHTML = barHtml || `<div style="width: 100%; background: rgba(255,255,255,0.06);"></div>`;
            }
        }

        // Render Category Chips
        let chipsHtml = "";
        Object.entries(CAT_DISPLAY).forEach(([catName, catInfo]) => {
            const sec = catTotals[catName] || 0;
            let pctDisplay = Math.round((sec / effectiveTotal) * 100) + "%";
            if (sec > 0 && Math.round((sec / effectiveTotal) * 100) === 0) {
                pctDisplay = "<1%";
            }
            const isProd = PRODUCTIVE_CATEGORIES.includes(catName);
            const isActive = activeCatFilter === catName;
            chipsHtml += `
                <div class="cat-chip" data-cat="${catName}" title="Click to filter table by ${catName}" style="cursor:pointer;${isActive ? `outline:2px solid ${catInfo.color};outline-offset:2px;box-shadow:0 0 0 1px ${catInfo.color}40;` : ``}">
                    <div class="cat-chip-head">
                        <span style="color: ${catInfo.color}; display: flex; align-items: center;">
                            <span class="cat-chip-dot" style="background: ${catInfo.color};"></span>
                            ${catName}
                        </span>
                        <span class="cat-chip-pct">${pctDisplay}</span>
                    </div>
                    <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 2px;">
                        <span class="cat-chip-val">${formatDurationHuman(sec)}</span>
                        ${isProd ? '<span style="font-size:0.58rem;color:var(--accent-emerald);font-weight:600;">PROD</span>' : ''}
                    </div>
                </div>
            `;
        });
        chipsGrid.innerHTML = chipsHtml;

        // Click-to-filter: clicking a chip filters the usage table by that category
        chipsGrid.addEventListener("click", function(e) {
            const chip = e.target.closest(".cat-chip");
            if (!chip) return;
            const cat = chip.dataset.cat;
            activeCatFilter = (activeCatFilter === cat) ? null : cat;
            if (latestState) renderState(latestState);
        }, { once: true });
    }
    const timelineContainer = document.getElementById("timeline-container");
    const timelineCount = document.getElementById("timeline-count");
    const statusLabel = document.getElementById("status-label");

    // Buttons
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnResetSession = document.getElementById("btn-reset-session");

    let latestState = null;
    let currentActiveViewState = null;

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
       UNIFIED 10-CATEGORY SYSTEM
       Development, Learning, Professional, Communication, Entertainment,
       Social Media, Shopping, News, Utilities, Other
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
        Utilities: { label: "Utilities", color: "#14b8a6" },
        Other: { label: "Other", color: "#64748b" }
    };

    const PRODUCTIVE_CATEGORIES = ["Development", "Learning", "Professional"];

    function displayCategory(category, appName) {
        const cat = (category || "Other").toString();
        const direct = CAT_DISPLAY[cat];
        if (direct) return direct;
        const c = cat.toLowerCase();
        const n = (appName || "").toLowerCase();

        // Check streaming / entertainment keywords first across both title & app name
        if (n.match(/youtube|netflix|spotify|redflix|hotstar|crunchyroll|anime|disney|hulu|peacock|twitch|movie|stream|cinema|tv|video/)) return CAT_DISPLAY.Entertainment;
        if (n.match(/github|stackoverflow|chatgpt|claude|gemini|copilot|leetcode|codepen|openai|replit|vercel|netlify|figma|vs code|code/)) return CAT_DISPLAY.Development;
        if (n.match(/coursera|udemy|khan|wikipedia|chess|typeracer|duolingo|freecodecamp|infosys|w3schools|mdn|typing|tutorial/)) return CAT_DISPLAY.Learning;
        if (n.match(/whatsapp|discord|slack|gmail|teams|zoom|telegram|meet|skype|mail/)) return CAT_DISPLAY.Communication;
        if (n.match(/linkedin|notion|drive|trello|jira|asana|canva|docs|sheets|slides|calendar|sharepoint/)) return CAT_DISPLAY.Professional;
        if (n.match(/instagram|twitter|x\.com|facebook|reddit|snapchat|tiktok|pinterest/)) return CAT_DISPLAY["Social Media"];
        if (n.match(/amazon|flipkart|ebay|shopping|store|cart|myntra|meesho|etsy|walmart/)) return CAT_DISPLAY.Shopping;
        if (n.match(/news|bbc|cnn|times|techcrunch|wired|guardian|bloomberg|reuters|hindu/)) return CAT_DISPLAY.News;
        if (n.match(/terminal|powershell|cmd|notepad|settings|explorer|calculator/)) return CAT_DISPLAY.Utilities;

        if (c === "development") return CAT_DISPLAY.Development;
        if (c === "learning" || c === "education") return CAT_DISPLAY.Learning;
        if (c === "professional" || c === "productivity") return CAT_DISPLAY.Professional;
        if (c === "communication") return CAT_DISPLAY.Communication;
        if (c === "entertainment" || c === "media") return CAT_DISPLAY.Entertainment;
        if (c === "social media") return CAT_DISPLAY["Social Media"];
        if (c === "shopping") return CAT_DISPLAY.Shopping;
        if (c === "news") return CAT_DISPLAY.News;
        if (c === "utilities") return CAT_DISPLAY.Utilities;
        if (c === "system" || c === "general application") return CAT_DISPLAY.Utilities;
        return CAT_DISPLAY.Other;
    }

    /* ========================================================================
       INTELLIGENT FOCUS SCORE & DEDUCTION BREAKDOWN ENGINE
       Continuous, rate-normalized, and flow-resilient scoring.
       Base score: 100
       Deductions & Bonuses:
       - Tab switching: Velocity-based (switches / active hour) (0 to 20 pts)
       - Category usage: Continuous weighted power-curve (0 to 30 pts)
       - Idle time ratio: Micro-break tolerant decay (0 to 20 pts)
       - Focus sessions: Continuous dwell depth & cognitive friction (0 to 20 pts)
       - Flow bonus: Sustained deep work reward (+3 to +5 pts resilience)
       ======================================================================== */
    function computeFocusBreakdown(state) {
        if (!state) {
            return {
                score: 100,
                classification: "Excellent",
                deductions: { tab_switching: 0, category_usage: 0, idle_time: 0, focus_sessions: 0, flow_bonus: 0 },
                totalDeductions: 0,
                sessionType: "Focused Session (0 items)",
                inTabIdleRatio: "0.00%",
                analysis: "No activity records detected yet.",
                recommendations: ["Maintain a focused workflow with structured Pomodoro intervals."],
                topDistractionSite: null
            };
        }
        const summary = state.summary || {};
        const switches = summary.totalSwitches !== undefined ? summary.totalSwitches : 0;
        const apps = state.appUsage || [];
        let totalActiveSec = 0;
        let distractSec = 0;
        let topDistractionSite = null;
        let maxDistractSec = 0;
        let longestDwellSec = 0;

        apps.forEach(a => {
            const sec = a.totalSeconds || 0;
            totalActiveSec += sec;
            const cat = displayCategory(a.category, a.name);
            const isDistract = (cat.label === "Entertainment" || cat.label === "Social Media" || cat.label === "Shopping");
            if (isDistract) {
                distractSec += sec;
                if (sec > maxDistractSec) {
                    maxDistractSec = sec;
                    topDistractionSite = a.name;
                }
            } else if (sec > longestDwellSec) {
                longestDwellSec = sec;
            }
        });

        const idleSec = state.idleSeconds || state.totalIdleSec || 0;
        const totalTimeSec = Math.max(1, totalActiveSec + idleSec);
        const idleRatio = (idleSec / totalTimeSec) * 100;
        const activeHours = Math.max(1 / 60, totalActiveSec / 3600);
        const switchVelocity = switches / activeHours;

        // 1. Tab switching deduction: Velocity-based rate (0 to 20 pts)
        // Up to 15 switches/hr is natural research/navigation (0 pts).
        // 15 to 60 switches/hr scales smoothly from 1 to 20 pts.
        let tabDeduction = 0;
        if (switchVelocity > 15 && totalActiveSec >= 60) {
            const excess = Math.min(45, switchVelocity - 15);
            tabDeduction = Math.min(20, Math.round((excess / 45) * 20));
        }

        // 2. Category usage deduction: Continuous weighted curve (0 to 30 pts)
        // Distractions under 3% are treated as brief checks. Beyond 3%, scales smoothly.
        const distractRatio = totalActiveSec > 0 ? (distractSec / totalActiveSec) : 0;
        let categoryDeduction = 0;
        if (distractRatio > 0.03) {
            categoryDeduction = Math.min(30, Math.round(Math.pow(distractRatio, 0.85) * 32));
        } else if (distractRatio > 0) {
            categoryDeduction = 1;
        }

        // 3. Idle time deduction: Micro-break tolerant decay (0 to 20 pts)
        // Up to 10% idle is considered healthy thinking/reading pauses.
        let idleDeduction = 0;
        if (idleRatio > 10) {
            const excessIdle = Math.min(30, idleRatio - 10);
            idleDeduction = Math.min(20, Math.round((excessIdle / 30) * 20));
        }

        // 4. Focus sessions / dwell depth: Continuous curve (0 to 20 pts)
        // 180s+ average dwell per switch indicates strong flow state.
        const avgDwell = totalActiveSec / Math.max(1, switches + 1);
        let focusSessionDeduction = 0;
        if (avgDwell < 180 && totalActiveSec >= 60) {
            const deficit = 180 - avgDwell;
            focusSessionDeduction = Math.min(20, Math.round(Math.pow(deficit / 180, 1.25) * 20));
        }

        // 5. Deep Work Flow Bonus (Positive Reinforcement)
        // >= 25 min (1500s Pomodoro interval) on a productive task earns +5 resilience pts
        // >= 15 min (900s) earns +3 resilience pts
        let flowBonus = 0;
        if (distractRatio < 0.25) {
            if (longestDwellSec >= 1500) {
                flowBonus = 5;
            } else if (longestDwellSec >= 900) {
                flowBonus = 3;
            }
        }

        const rawDeductions = tabDeduction + categoryDeduction + idleDeduction + focusSessionDeduction;
        const totalDeductions = Math.max(0, rawDeductions - flowBonus);
        const score = Math.max(10, Math.min(100, 100 - totalDeductions));

        let classification = "Fair";
        if (score >= 85) classification = "Excellent";
        else if (score >= 70) classification = "Good";
        else if (score >= 50) classification = "Fair";
        else classification = "Needs Work";

        const totalItems = apps.length || 1;
        const sessionType = (totalItems > 10 || switchVelocity > 25) ? `Multi-Task Session (${totalItems} items)` : `Focused Session (${totalItems} items)`;

        // Narrative Analysis explaining exactly where marks were lost or gained
        const reasons = [];
        if (tabDeduction > 0) reasons.push(`rapid context switching (${Math.round(switchVelocity)}/hr, -${tabDeduction} pts)`);
        if (categoryDeduction > 0) reasons.push(`distraction usage (${Math.round(distractRatio * 100)}% of time, -${categoryDeduction} pts)`);
        if (idleDeduction > 0) reasons.push(`idle drift (${idleRatio.toFixed(1)}%, -${idleDeduction} pts)`);
        if (focusSessionDeduction > 0) reasons.push(`fragmented dwell (${Math.round(avgDwell)}s avg, -${focusSessionDeduction} pts)`);
        if (flowBonus > 0) reasons.push(`sustained deep work bonus (+${flowBonus} pts)`);

        let analysis = "";
        if (reasons.length > 0) {
            analysis = `The user focus score was evaluated with ${reasons.join(", ")}.`;
            if (topDistractionSite) {
                const mins = Math.round(maxDistractSec / 60);
                analysis += ` Non-productive browsing was primarily on ${topDistractionSite}${mins > 0 ? ` (${mins}m)` : ""}.`;
            }
        } else {
            analysis = "The user maintained optimal focus with disciplined dwell velocity and minimal cognitive reorientation.";
        }

        // Varied recommendations (ALWAYS POPULATED, IRRESPECTIVE OF FOCUS SCORE)
        const recs = [];
        if (focusSessionDeduction > 0) recs.push("Integrate a Pomodoro focus timer into your routine to structure work intervals and properly log focus sessions.");
        if (tabDeduction > 0) recs.push("Minimize rapid context switching by closing unrelated tabs and maintaining a single primary task in view.");
        if (idleDeduction > 0) recs.push("Reduce idle drift by setting clear session goals and taking designated breaks rather than idling between windows.");
        if (categoryDeduction > 0 && topDistractionSite) recs.push(`Limit visits to entertainment sites like ${topDistractionSite} during active work periods to maintain continuous concentration.`);

        if (recs.length < 4) {
            if (score >= 80) {
                recs.push("Protect your high flow state by pre-scheduling dedicated 45-minute deep work intervals.");
                recs.push("Take structured 5-minute cognitive rest breaks between major research milestones.");
                recs.push("Consolidate open tabs into browser tab groups at the end of each session to prevent cognitive clutter.");
                recs.push("Mute non-critical instant messaging notifications during peak concentration periods.");
            } else {
                recs.push("Group tabs by task using Chrome Tab Groups to maintain clear mental boundaries.");
                recs.push("Keep a single primary application in the foreground and minimize background distractions.");
            }
        }

        const deductions = {
            tab_switching: tabDeduction,
            category_usage: categoryDeduction,
            idle_time: idleDeduction,
            focus_sessions: focusSessionDeduction,
            flow_bonus: flowBonus
        };

        return {
            score,
            classification,
            deductions,
            totalDeductions,
            sessionType,
            inTabIdleRatio: `${idleRatio.toFixed(2)}%`,
            analysis,
            recommendations: recs.slice(0, 4),
            topDistractionSite
        };
    }

    function computeFocusScore(state) {
        return computeFocusBreakdown(state).score;
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
            const cat = displayCategory(a.category, a.name).label;
            byCategory[cat] = (byCategory[cat] || 0) + (a.totalSeconds || 0);
        });
        const timeLost = Object.entries(byCategory)
            .filter(([cat]) => !PRODUCTIVE_CATEGORIES.includes(cat))
            .map(([cat, sec]) => ({ category: cat, seconds: sec, percent: Math.round((sec / total) * 100) }))
            .sort((a, b) => b.seconds - a.seconds);
        const topDistractions = apps
            .filter(a => !PRODUCTIVE_CATEGORIES.includes(displayCategory(a.category, a.name).label))
            .slice(0, 5)
            .map(a => ({
                name: a.name,
                title: a.title,
                category: displayCategory(a.category, a.name).label,
                seconds: a.totalSeconds || 0
            }));

        const breakdown = computeFocusBreakdown(state);

        return {
            generatedAt: new Date().toISOString(),
            totalActiveSeconds: total,
            totalActiveFormatted: formatDurationHuman(total),
            focusScore: breakdown.score,
            classification: breakdown.classification,
            deductionBreakdown: breakdown.deductions,
            sessionType: breakdown.sessionType,
            realTabSwitches: summaryTotalSwitches(state),
            inTabIdleRatio: breakdown.inTabIdleRatio,
            idleSeconds: state.idleSeconds || 0,
            timeLostByCategory: timeLost,
            topDistractions: topDistractions,
            analysis: breakdown.analysis,
            suggestions: breakdown.recommendations
        };
    }

    function summaryTotalSwitches(state) {
        return (state.summary && state.summary.totalSwitches !== undefined) ? state.summary.totalSwitches : 0;
    }

    function renderAuditCards(targetState, breakdown) {
        const fsWrap = document.getElementById("fs-json-wrap");
        if (!fsWrap || !targetState) return;
        const score = breakdown.score;
        const apps = targetState.appUsage || [];
        let entSec = 0, commSec = 0;
        apps.forEach(a => {
            const cat = displayCategory(a.category, a.name);
            if (cat.label === "Entertainment") entSec += (a.totalSeconds || 0);
            if (cat.label === "Communication") commSec += (a.totalSeconds || 0);
        });
        const totalSec2 = targetState.summary ? (targetState.summary.totalActiveSeconds || 1) : 1;
        const topSink = apps[0];
        const prodSec = apps.filter(a => PRODUCTIVE_CATEGORIES.includes(displayCategory(a.category, a.name).label)).reduce((s,a)=>s+(a.totalSeconds||0),0);
        const rawProdPct2 = (prodSec / Math.max(1, totalSec2)) * 100;
        const prodPct2Display = (rawProdPct2 > 0 && rawProdPct2 < 1) ? rawProdPct2.toFixed(1) + "%" : Math.round(rawProdPct2) + "%";
        const switchCount = (targetState.summary || {}).totalSwitches || 0;
        const distractPct = Math.round(((entSec + commSec) / Math.max(1, totalSec2)) * 100);

        const auditCardsHtml = `<div id="fs-audit-cards" style="margin-bottom:14px;">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;">
                <div style="background:var(--surface-raised);border:1px solid var(--stroke-subtle);border-radius:8px;padding:12px 14px;">
                    <div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:4px;">Top Time Sink</div>
                    <div style="font-weight:700;font-size:0.85rem;color:var(--text-pure);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${topSink ? escapeHtml(topSink.name) : 'None'}">${topSink ? escapeHtml(topSink.name) : 'None'}</div>
                    <div style="font-size:0.72rem;color:#ef4444;margin-top:2px;">${topSink ? formatDurationHuman(topSink.totalSeconds) : '0s'}</div>
                </div>
                <div style="background:var(--surface-raised);border:1px solid var(--stroke-subtle);border-radius:8px;padding:12px 14px;">
                    <div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:4px;">Attention Purity</div>
                    <div style="font-weight:700;font-size:0.85rem;color:${rawProdPct2 >= 60 ? 'var(--accent-emerald)' : rawProdPct2 >= 35 ? '#38bdf8' : '#f59e0b'};">${prodPct2Display} Productive</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${distractPct}% distraction</div>
                </div>
                <div style="background:var(--surface-raised);border:1px solid var(--stroke-subtle);border-radius:8px;padding:12px 14px;">
                    <div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:4px;">Switch Friction</div>
                    <div style="font-weight:700;font-size:0.85rem;color:#f59e0b;">${switchCount} transitions</div>
                    <div style="font-size:0.72rem;color:${score >= 80 ? 'var(--accent-emerald)' : '#f59e0b'};margin-top:2px;">Focus: ${score}/100</div>
                </div>
            </div>

            <!-- Deduction Breakdown & Analysis Block matching meeting guidance -->
            <div style="background:var(--surface-raised);border:1px solid var(--stroke-subtle);border-radius:8px;padding:14px;margin-bottom:10px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
                    <span style="font-size:0.72rem;font-weight:700;color:var(--text-pure);text-transform:uppercase;letter-spacing:0.05em;">Deduction Breakdown (Base: 100 pts)</span>
                    <span style="font-size:0.68rem;padding:2px 8px;border-radius:4px;background:rgba(59,130,246,0.15);color:#38bdf8;">${breakdown.sessionType}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px;">
                    <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px 10px;">
                        <div style="font-size:0.65rem;color:var(--text-muted);">Tab Switching</div>
                        <div style="font-size:0.85rem;font-weight:700;color:${breakdown.deductions.tab_switching > 0 ? '#ef4444' : 'var(--accent-emerald)'};">-${breakdown.deductions.tab_switching} pts</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px 10px;">
                        <div style="font-size:0.65rem;color:var(--text-muted);">Distraction Usage</div>
                        <div style="font-size:0.85rem;font-weight:700;color:${breakdown.deductions.category_usage > 0 ? '#ef4444' : 'var(--accent-emerald)'};">-${breakdown.deductions.category_usage} pts</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px 10px;">
                        <div style="font-size:0.65rem;color:var(--text-muted);">Idle Drift (${breakdown.inTabIdleRatio})</div>
                        <div style="font-size:0.85rem;font-weight:700;color:${breakdown.deductions.idle_time > 0 ? '#ef4444' : 'var(--accent-emerald)'};">-${breakdown.deductions.idle_time} pts</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px 10px;">
                        <div style="font-size:0.65rem;color:var(--text-muted);">Focus Sessions</div>
                        <div style="font-size:0.85rem;font-weight:700;color:${breakdown.deductions.focus_sessions > 0 ? '#ef4444' : 'var(--accent-emerald)'};">-${breakdown.deductions.focus_sessions} pts</div>
                    </div>
                    ${(breakdown.deductions.flow_bonus > 0) ? `
                    <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.25);border-radius:6px;padding:8px 10px;">
                        <div style="font-size:0.65rem;color:var(--accent-emerald);">Flow Bonus</div>
                        <div style="font-size:0.85rem;font-weight:700;color:var(--accent-emerald);">+${breakdown.deductions.flow_bonus} pts</div>
                    </div>` : ''}
                </div>
                <div style="font-size:0.75rem;color:#cbd5e1;line-height:1.45;background:rgba(255,255,255,0.03);border-left:3px solid var(--accent-emerald);padding:8px 10px;border-radius:0 4px 4px 0;margin-bottom:10px;">
                    <strong>Analysis:</strong> ${escapeHtml(breakdown.analysis)}
                </div>
                <div style="font-size:0.75rem;color:#cbd5e1;">
                    <strong style="color:var(--text-pure);display:block;margin-bottom:4px;">Recommendations:</strong>
                    <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px;">
                        ${breakdown.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
                    </ol>
                </div>
            </div>
        </div>`;

        const prevCards = document.getElementById("fs-audit-cards");
        if (prevCards) prevCards.remove();
        fsWrap.insertAdjacentHTML("afterbegin", auditCardsHtml);
        fsWrap.style.display = "block";
    }

    async function generateTimeLossSummary() {
        const stateToUse = currentActiveViewState || latestState;
        if (!stateToUse) {
            alert("No activity data available yet. Start tracking first.");
            return;
        }
        const breakdown = computeFocusBreakdown(stateToUse);
        const score = breakdown.score;
        const fsScore = document.getElementById("fs-score");
        const fsGrade = document.getElementById("fs-grade");
        const fsJson = document.getElementById("fs-json");
        const fsJsonLabel = document.getElementById("fs-json-label");
        const fsWrap = document.getElementById("fs-json-wrap");
        if (fsScore) fsScore.textContent = score;
        if (fsGrade) {
            const g = focusGrade(score);
            fsGrade.textContent = g.label;
            fsGrade.style.backgroundColor = g.color + "15";
            fsGrade.style.color = g.color;
            fsGrade.style.borderColor = g.color + "40";
            if (fsJsonLabel) {
                fsJsonLabel.textContent = `Time-Loss JSON Summary & Attention Audit (${g.label} Focus - ${score}/100)`;
            }
        }
        const summaryObj = buildTimeLossJson(stateToUse);
        let jsonText = JSON.stringify(summaryObj, null, 2);

        // Optional AI API Key enhancement (Gemini/Groq)
        const keys = getApiKeys();
        const provider = keys.gemini ? "gemini" : (keys.groq ? "groq" : null);
        if (provider) {
            try {
                const prompt = "Given this browsing activity and attention deduction JSON, review and optimize the analysis and recommendations while preserving exact deductions. " +
                    "Return ONLY valid JSON with identical schema: focusScore, classification, deductionBreakdown, analysis, suggestions. Data: " + JSON.stringify(summaryObj);
                const aiText = provider === "gemini" ? await callGemini(keys.gemini, prompt) : await callGroq(keys.groq, prompt);
                const parsed = JSON.parse(aiText.replace(/```json/g, "").replace(/```/g, "").trim());
                if (parsed.suggestions && parsed.suggestions.length > 0) {
                    summaryObj.suggestions = parsed.suggestions;
                }
                if (parsed.analysis) {
                    summaryObj.analysis = parsed.analysis;
                }
                jsonText = JSON.stringify(summaryObj, null, 2);
            } catch (e) {
                console.warn("AI summary refinement unavailable, using local engine:", e);
            }
        }
        if (fsJson) fsJson.textContent = jsonText;
        renderAuditCards(stateToUse, breakdown);
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
    // Category chip filter (null = show all categories)
    let activeCatFilter = null;

    function renderState(state) {
        if (!state) return;
        currentActiveViewState = state;
        if (!isHistoricalView) {
            latestState = state;
        }

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
            const curCat = displayCategory(cur.category, cur.appName);
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
                curWindowTitle.textContent = `Archived session log for ${historyDatePicker ? historyDatePicker.value : "selected date"}`;
                curCounter.textContent = formatCounter(summary.totalActiveSeconds || 0);
                curActivated.textContent = "Archived Record";
                curUpdated.textContent = summary.totalActiveFormatted || formatDurationHuman(summary.totalActiveSeconds || 0);
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
            const prevCat = displayCategory(prev.category, prev.appName);
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
            if (focusScoreHint) focusScoreHint.textContent = `Baseline calibration: collecting 60s of telemetry (${totalActiveSec}s / 60s)`;
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

        // Historical Comparison: Today vs Yesterday
        const deltaTotalTime = document.getElementById("delta-total-time");
        const deltaSwitches = document.getElementById("delta-switches");
        if (!isHistoricalView && allHistory) {
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yKey = yesterdayDate.toISOString().slice(0, 10);
            const yData = allHistory[yKey];
            if (yData && yData.totalActiveSeconds !== undefined) {
                const diffSec = (summary.totalActiveSeconds || 0) - yData.totalActiveSeconds;
                if (deltaTotalTime) {
                    deltaTotalTime.style.display = "inline-block";
                    if (diffSec >= 0) {
                        deltaTotalTime.className = "kpi-delta-tag delta-positive";
                        deltaTotalTime.textContent = `+${formatDurationHuman(diffSec)} vs yesterday`;
                    } else {
                        deltaTotalTime.className = "kpi-delta-tag delta-negative";
                        deltaTotalTime.textContent = `-${formatDurationHuman(Math.abs(diffSec))} vs yesterday`;
                    }
                }
                const diffSwitches = (summary.totalSwitches || 0) - (yData.totalSwitches || 0);
                if (deltaSwitches) {
                    deltaSwitches.style.display = "inline-block";
                    if (diffSwitches <= 0) {
                        deltaSwitches.className = "kpi-delta-tag delta-positive";
                        deltaSwitches.textContent = `${diffSwitches} switches vs yesterday`;
                    } else {
                        deltaSwitches.className = "kpi-delta-tag delta-negative";
                        deltaSwitches.textContent = `+${diffSwitches} switches vs yesterday`;
                    }
                }
            } else {
                if (deltaTotalTime) deltaTotalTime.style.display = "none";
                if (deltaSwitches) deltaSwitches.style.display = "none";
            }
        } else {
            if (deltaTotalTime) deltaTotalTime.style.display = "none";
            if (deltaSwitches) deltaSwitches.style.display = "none";
        }

        // Dynamic labels for Tile 1 and Tile 6 based on selected view
        const idleTileLabel = document.getElementById("idle-tile-label");
        const totalUsageTileLabel = document.getElementById("total-usage-tile-label");
        const selectedVal = historyDatePicker ? historyDatePicker.value : "today";
        if (idleTileLabel) {
            if (selectedVal === "today") idleTileLabel.textContent = "Idle Time (Today)";
            else if (selectedVal === "yesterday") idleTileLabel.textContent = "Idle Time (Yesterday)";
            else if (selectedVal === "7days") idleTileLabel.textContent = "Idle Time (Past 7 Days)";
            else if (selectedVal === "30days") idleTileLabel.textContent = "Idle Time (Past 30 Days)";
            else if (selectedVal === "alltime") idleTileLabel.textContent = "Idle Time (All Time)";
            else idleTileLabel.textContent = `Idle Time (${selectedVal})`;
        }
        if (totalUsageTileLabel) {
            if (selectedVal === "today") totalUsageTileLabel.textContent = "Total Active Usage";
            else if (selectedVal === "yesterday") totalUsageTileLabel.textContent = "Total Time (Yesterday)";
            else if (selectedVal === "7days") totalUsageTileLabel.textContent = "Total Time (Past 7 Days)";
            else if (selectedVal === "30days") totalUsageTileLabel.textContent = "Total Time (Past 30 Days)";
            else if (selectedVal === "alltime") totalUsageTileLabel.textContent = "Total Time (All Time)";
            else totalUsageTileLabel.textContent = `Total Time (${selectedVal})`;
        }

        // Idle Time tile (accurate Active vs Idle ratio - no misleading 100% focus purity label)
        const idleSec = state.idleSeconds || 0;
        const idleTimeVal = document.getElementById("idle-time-val");
        const idleStateText = document.getElementById("idle-state-text");
        const idleRatioText = document.getElementById("idle-ratio-text");
        if (idleTimeVal) idleTimeVal.textContent = formatDurationHuman(idleSec);
        if (idleStateText) {
            if (isHistoricalView) {
                idleStateText.textContent = idleSec > 0 ? ("Archived idle: " + formatDurationHuman(idleSec)) : "Archived record (idle unrecorded)";
                idleStateText.style.color = "var(--text-muted)";
            } else if (idleSec >= 600) {
                idleStateText.textContent = "Idle confirmed: " + formatDurationHuman(idleSec);
                idleStateText.style.color = "#ef4444";
            } else if (idleSec > 0) {
                idleStateText.textContent = "Idle: " + formatDurationHuman(idleSec);
                idleStateText.style.color = "#f59e0b";
            } else {
                idleStateText.textContent = "Active on laptop";
                idleStateText.style.color = "var(--text-muted)";
            }
        }
        if (idleRatioText) {
            const totalObserved = (summary.totalActiveSeconds || 0) + idleSec;
            if (isHistoricalView && idleSec === 0) {
                idleRatioText.style.display = "inline-block";
                idleRatioText.textContent = "Idle: Unrecorded";
                idleRatioText.className = "kpi-delta-tag delta-neutral";
            } else if (totalObserved > 0) {
                const activePct = Math.round(((summary.totalActiveSeconds || 0) / totalObserved) * 100);
                idleRatioText.style.display = "inline-block";
                idleRatioText.textContent = `Active Ratio: ${activePct}% active`;
                idleRatioText.className = activePct >= 80 ? "kpi-delta-tag delta-positive" : "kpi-delta-tag delta-neutral";
            } else {
                idleRatioText.style.display = "none";
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
        const rawApps = Array.isArray(apps) ? apps : Object.values(apps);
        const appList = rawApps.filter(app => {
            const n = String(app.name || "").trim();
            return n && n !== "0" && !/^\d+$/.test(n);
        });
        appList.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

        // Scope filter helper: classify each app entry
        function getAppScope(app) {
            if (app.isBrowser || app.isWebsite) return "browser";
            const name = (app.name || "").toLowerCase();
            const cat = (app.category || "").toLowerCase();
            if (cat === "system" || name === "task switching" || name.includes("explorer")) return "system";
            if (name.includes("brave") || name.includes("chrome") || name.includes("edge") || name.includes("firefox") || cat === "web browser" || name.includes("(browser)")) return "browser";
            return "desktop";
        }

        // Apply scope filter + category chip filter
        const scopeFiltered = currentScopeFilter === "all" ? appList : appList.filter(app => getAppScope(app) === currentScopeFilter);
        const filteredAppList = activeCatFilter ? scopeFiltered.filter(app => displayCategory(app.category, app.name).label === activeCatFilter) : scopeFiltered;

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
                const isBrowserProcess = scope === "browser" && !app.isBrowser;
                const browserNote = app.isBrowser
                    ? ' <span style="font-size:0.62rem;color:var(--accent-cyan);font-style:italic;">(browser website)</span>'
                    : (isBrowserProcess ? ' <span style="font-size:0.62rem;color:var(--text-muted);font-style:italic;">(desktop process time)</span>' : "");

                rowsHtml += `
                    <tr>
                        <td class="cell-rank">#${idx + 1}</td>
                        <td title="${escapeHtml(app.name)}">
                            <div class="table-app-cell">
                                <span class="app-glyph">${glyph}</span>
                                <span class="app-name-text">${escapeHtml(app.name)}${browserNote}</span>
                            </div>
                        </td>
                        <td><span class="category-tag" style="color:${displayCategory(app.category,app.name).color};border-color:${displayCategory(app.category,app.name).color}40;background:${displayCategory(app.category,app.name).color}12;">${escapeHtml(displayCategory(app.category,app.name).label)}</span></td>
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

        // Render Pie Chart & 9-Category Attention Breakdown
        const totalSec = summary.totalActiveSeconds || (appList.length > 0 ? appList.reduce((acc, a) => acc + (a.totalSeconds || 0), 0) : 0);
        renderPieChart(appList, totalSec);
        renderCategoryBreakdown(appList, totalSec);

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
            const reversed = [...timeline].reverse();
            // Deduplicate consecutive identical items (e.g. from 1-second polling ticks)
            const deduplicated = [];
            reversed.forEach(item => {
                const name = item.appName || item.name || item.AppName || "Application";
                const title = item.title || item.domain || item.Title || name;
                const durSec = item.durationSec || item.DurationSec || 0;
                const prev = deduplicated[deduplicated.length - 1];
                if (prev && prev.name === name && prev.title === title) {
                    prev.durSec += durSec;
                    prev.durFormatted = formatDurationHuman(prev.durSec);
                } else {
                    deduplicated.push({
                        ...item,
                        name,
                        title,
                        durSec,
                        durFormatted: item.durationFormatted || item.DurationFormatted || formatDurationHuman(durSec)
                    });
                }
            });

            if (timelineCount) timelineCount.textContent = `${deduplicated.length} events`;
            let tlHtml = "";

            // Activity Stream search filter
            const tlSearchEl = document.getElementById("timeline-search");
            const tlSearchVal = tlSearchEl ? tlSearchEl.value.toLowerCase().trim() : "";
            const tlItems = tlSearchVal
                ? deduplicated.filter(item => {
                    const name = (item.name || "").toLowerCase();
                    const title = (item.title || "").toLowerCase();
                    const cat = (item.category || item.Category || "").toLowerCase();
                    return name.includes(tlSearchVal) || title.includes(tlSearchVal) || cat.includes(tlSearchVal);
                })
                : deduplicated;

            tlItems.slice(0, 40).forEach(item => {
                const appName = item.name || "Application";
                const timeVal = item.time || item.timeStr || item.Time || "";
                const titleVal = item.title || item.domain || appName;
                const durFormatted = item.durFormatted || formatDurationHuman(item.durSec || 0);
                const itemCat = displayCategory(item.category || item.Category || "Other", appName);

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

        // Keep Focus Panel in immediate lockstep with active state
        renderFocusPanel(state);
    }

    /**
     * Retrieve extension telemetry via direct chrome.storage (extension tab),
     * localStorage bridge (content_bridge.js on http://127.0.0.1:5500), or external messaging
     */
    function getExtensionTelemetry(callback) {
        // 1. Direct chrome.storage.local (when opened as chrome-extension://...)
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([
                "currentWebsite",
                "previousWebsite",
                "currentDwellSec",
                "totalTabSwitches",
                "siteUsage",
                "timeline",
                "isWindowFocused",
                "historyByDate"
            ], res => {
                if (!chrome.runtime.lastError && res && (res.siteUsage || res.currentWebsite)) {
                    callback(res);
                    return;
                }
                fallbackBridge();
            });
            return;
        }

        fallbackBridge();

        function fallbackBridge() {
            // 2. LocalStorage bridge (populated by content_bridge.js on http://127.0.0.1:5500)
            try {
                const raw = localStorage.getItem("ACTIVITYWATCH_EXTENSION_STATE");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.siteUsage || parsed.currentWebsite)) {
                        callback(parsed);
                        return;
                    }
                }
            } catch (e) {}

            // 3. Direct runtime messaging via externally_connectable
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    chrome.runtime.sendMessage("kmkplinihahhdkeammgenjfffccahnbi", { type: "GET_TELEMETRY" }, resp => {
                        if (!chrome.runtime.lastError && resp && (resp.siteUsage || resp.currentWebsite)) {
                            callback(resp);
                            return;
                        }
                        callback(null);
                    });
                    return;
                } catch (e) {}
            }

            callback(null);
        }
    }

    // Listen for real-time live push messages from content_bridge.js on http://127.0.0.1:5500
    window.addEventListener("message", ev => {
        if (ev.data && ev.data.source === "ACTIVITYWATCH_EXTENSION_BRIDGE" && ev.data.payload) {
            const extRes = ev.data.payload;
            try {
                localStorage.setItem("ACTIVITYWATCH_EXTENSION_STATE", JSON.stringify(extRes));
            } catch (e) {}
            if (!isHistoricalView) {
                if (isDaemonConnected && latestDaemonData && latestDaemonData.summary && latestDaemonData.summary.totalActiveSeconds > 0) {
                    const merged = mergeDaemonAndExtension(latestDaemonData, extRes);
                    renderState(merged);
                } else {
                    const extState = mapExtensionToState(extRes);
                    renderState(extState);
                    if (statusLabel) statusLabel.textContent = "Browser Extension Connected";
                }
            }
        }
    });

    // Request fresh telemetry state on load
    window.postMessage({ source: "ACTIVITYWATCH_DASHBOARD_REQUEST" }, "*");

    /**
     * Convert standalone browser extension telemetry into full dashboard state model
     */
    function mapExtensionToState(extRes) {
        if (!extRes) return null;
        const sites = Object.values(extRes.siteUsage || {});
        const totalSec = sites.reduce((sum, s) => sum + (s.totalSec || 0), 0);
        const switches = extRes.totalTabSwitches || 0;

        const appUsage = sites.map(s => ({
            name: s.name,
            domain: s.domain,
            category: s.category || displayCategory("Web Browser", s.name).label,
            totalSeconds: s.totalSec || 0,
            switchCount: s.visitCount || 1,
            isBrowser: true
        })).sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

        const top = appUsage[0];
        const mostUsed = top ? {
            name: top.name,
            category: top.category,
            durationSeconds: top.totalSeconds,
            durationFormatted: formatDurationHuman(top.totalSeconds),
            percentage: Math.round(((top.totalSeconds || 0) / Math.max(1, totalSec)) * 100)
        } : null;

        const prevSite = extRes.previousWebsite;
        const prevSpent = prevSite ? (prevSite.totalActiveSpent || prevSite.sessionDwellSec || 0) : 0;

        return {
            current: extRes.currentWebsite ? {
                appName: extRes.currentWebsite.name,
                category: extRes.currentWebsite.category || displayCategory("Web Browser", extRes.currentWebsite.name).label,
                title: extRes.currentWebsite.url,
                dwellSeconds: extRes.currentDwellSec || 0,
                activatedTime: extRes.currentWebsite.activatedTime,
                lastUpdated: extRes.currentWebsite.lastUpdatedTime,
                isBrowser: true
            } : null,
            previous: prevSite ? {
                appName: prevSite.name,
                category: prevSite.category || displayCategory("Web Browser", prevSite.name).label,
                title: prevSite.url,
                activeDurationSec: prevSpent,
                activeDurationFormatted: formatDurationHuman(prevSpent),
                lastActiveTime: prevSite.lastActiveTime,
                isBrowser: true
            } : null,
            summary: {
                totalActiveSeconds: totalSec,
                totalActiveFormatted: formatDurationHuman(totalSec),
                totalSwitches: switches,
                distinctAppsCount: appUsage.length,
                mostUsedApp: mostUsed
            },
            appUsage: appUsage,
            timeline: (extRes.timeline || []).map(t => ({
                time: t.timeStr || t.time,
                appName: t.name,
                title: t.actionText || t.title,
                category: displayCategory("Web Browser", t.name).label,
                durationSec: t.durationSec || 0,
                durationFormatted: formatDurationHuman(t.durationSec || 0)
            }))
        };
    }

    /**
     * Unify desktop daemon state and browser extension state into one consistent, synchronized model
     */
    function mergeDaemonAndExtension(daemonData, extRes) {
        if (!daemonData && !extRes) return null;
        if (!daemonData) return mapExtensionToState(extRes);
        if (!extRes || !extRes.siteUsage || Object.keys(extRes.siteUsage).length === 0) return daemonData;

        // 1. Browser websites tracked by the extension
        const extSites = Object.values(extRes.siteUsage || {});
        const extTotalSec = extSites.reduce((sum, s) => sum + (s.totalSec || 0), 0);
        const extSwitches = extRes.totalTabSwitches || 0;

        const browserApps = extSites.map(s => ({
            name: s.name,
            domain: s.domain,
            category: s.category || displayCategory("Web Browser", s.name).label,
            totalSeconds: s.totalSec || 0,
            switchCount: s.visitCount || 1,
            isBrowser: true
        }));

        // 2. Desktop apps from daemon (keep native applications, drop duplicate raw browser wrappers)
        const desktopApps = [];
        let desktopSec = 0;
        let desktopSwitches = 0;

        (daemonData.appUsage || []).forEach(app => {
            const nameLower = (app.name || "").toLowerCase();

            // Check if extension is already tracking this specific site/domain
            const isTrackedByExtension = extSites.some(s => {
                const sName = (s.name || "").toLowerCase();
                const sDom = (s.domain || "").toLowerCase();
                return nameLower.includes(sName) || (sDom && nameLower.includes(sDom));
            });

            // Only drop bare browser process wrappers without site context
            const isGenericBrowserWrapper = nameLower === "brave" ||
                                            nameLower === "brave browser" ||
                                            nameLower === "chrome" ||
                                            nameLower === "google chrome" ||
                                            nameLower === "msedge" ||
                                            nameLower === "microsoft edge";

            // Preserve all Brave Browser and other browser sites if extension is not tracking them
            if (!isTrackedByExtension && !isGenericBrowserWrapper) {
                desktopApps.push({
                    name: app.name,
                    category: app.category || displayCategory(app.category, app.name).label,
                    totalSeconds: app.totalSeconds || 0,
                    switchCount: app.switchCount || 1,
                    isBrowser: nameLower.includes("browser")
                });
                desktopSec += (app.totalSeconds || 0);
                desktopSwitches += (app.switchCount || 0);
            }
        });

        // Combine all applications and websites, sorted by totalSeconds descending
        const combinedApps = [...browserApps, ...desktopApps].sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

        // Combined total seconds & switches
        const unifiedTotalSec = extTotalSec + desktopSec;
        const unifiedSwitches = extSwitches + (daemonData.summary ? (daemonData.summary.totalSwitches || 0) : desktopSwitches);

        const top = combinedApps[0];
        const mostUsed = top ? {
            name: top.name,
            category: top.category,
            durationSeconds: top.totalSeconds,
            durationFormatted: formatDurationHuman(top.totalSeconds),
            percentage: Math.round(((top.totalSeconds || 0) / Math.max(1, unifiedTotalSec)) * 100)
        } : null;

        // Current active window:
        let current = daemonData.current;
        if (extRes.currentWebsite && extRes.isWindowFocused !== false) {
            current = {
                appName: extRes.currentWebsite.name,
                category: extRes.currentWebsite.category || displayCategory("Web Browser", extRes.currentWebsite.name).label,
                title: extRes.currentWebsite.url,
                dwellSeconds: extRes.currentDwellSec || 0,
                activatedTime: extRes.currentWebsite.activatedTime,
                lastUpdated: extRes.currentWebsite.lastUpdatedTime,
                isBrowser: true
            };
        }

        // Previous active window:
        let previous = daemonData.previous;
        if (extRes.previousWebsite) {
            const prevSite = extRes.previousWebsite;
            const prevSpent = prevSite.totalActiveSpent || prevSite.sessionDwellSec || 0;
            previous = {
                appName: prevSite.name,
                category: prevSite.category || displayCategory("Web Browser", prevSite.name).label,
                title: prevSite.url,
                activeDurationSec: prevSpent,
                activeDurationFormatted: formatDurationHuman(prevSpent),
                lastActiveTime: prevSite.lastActiveTime,
                isBrowser: true
            };
        }

        // Combine timelines
        // Helper to convert a time string like "01:12:57 AM" or "13:04:22" into seconds-since-midnight for sorting
        function timeStrToSortKey(timeStr) {
            if (!timeStr) return 0;
            const m12 = /(\d+):(\d+):(\d+)\s*(AM|PM)/i.exec(timeStr);
            if (m12) {
                let h = parseInt(m12[1], 10);
                const min = parseInt(m12[2], 10);
                const sec = parseInt(m12[3], 10);
                const ampm = m12[4].toUpperCase();
                if (ampm === 'AM' && h === 12) h = 0;
                if (ampm === 'PM' && h !== 12) h += 12;
                return h * 3600 + min * 60 + sec;
            }
            const m24 = /(\d+):(\d+):(\d+)/.exec(timeStr);
            if (m24) {
                return parseInt(m24[1], 10) * 3600 + parseInt(m24[2], 10) * 60 + parseInt(m24[3], 10);
            }
            return 0;
        }
        const combinedTimeline = [
            ...(extRes.timeline || []).map(t => ({
                time: t.timeStr || t.time,
                appName: t.name,
                title: t.actionText || t.title,
                category: displayCategory("Web Browser", t.name).label,
                durationSec: t.durationSec || 0,
                durationFormatted: formatDurationHuman(t.durationSec || 0),
                _sortKey: t.timestamp || timeStrToSortKey(t.timeStr || t.time)
            })),
            ...(daemonData.timeline || []).map(t => ({
                time: t.Time || t.time,
                appName: t.AppName || t.appName,
                title: t.Title || t.title,
                category: t.Category || t.category || "General Application",
                durationSec: t.DurationSec || t.durationSec || 0,
                durationFormatted: t.DurationFormatted || formatDurationHuman(t.DurationSec || t.durationSec || 0),
                _sortKey: timeStrToSortKey(t.Time || t.time)
            }))
        ].sort((a, b) => a._sortKey - b._sortKey).slice(-60);

        return {
            current: current,
            previous: previous,
            summary: {
                totalActiveSeconds: unifiedTotalSec,
                totalActiveFormatted: formatDurationHuman(unifiedTotalSec),
                totalSwitches: unifiedSwitches,
                distinctAppsCount: combinedApps.length,
                mostUsedApp: mostUsed
            },
            appUsage: combinedApps,
            timeline: combinedTimeline,
            browserTotalSec: extTotalSec,
            desktopTotalSec: desktopSec
        };
    }

    let latestDaemonData = null;

    /**
     * Poll desktop daemon state and seamlessly merge with browser extension telemetry in real time
     */
    async function pollDaemonState() {
        if (isHistoricalView) return; // Retain past date inspection

        let daemonData = null;
        try {
            const res = await fetch(`activity_state.json?t=${Date.now()}`);
            if (res.ok) {
                daemonData = await res.json();
                isDaemonConnected = true;
                latestDaemonData = daemonData;
            } else {
                isDaemonConnected = false;
            }
        } catch {
            isDaemonConnected = false;
        }

        getExtensionTelemetry(extRes => {
            const isPaused = extRes && (extRes.isWindowFocused === false || extRes.isPaused === true || !extRes.currentWebsite);
            const extTrackingLabel = isPaused ? "Connected (Tracking Standby/Paused)" : "Connected & Monitoring";
            if (daemonData && extRes && extRes.siteUsage && Object.keys(extRes.siteUsage).length > 0) {
                hasLoadedFirstState = true;
                const merged = mergeDaemonAndExtension(daemonData, extRes);
                renderState(merged);
                if (statusLabel) statusLabel.textContent = `Desktop Daemon Connected | Browser Extension ${extTrackingLabel}`;
            } else if (extRes && (extRes.currentWebsite || (extRes.siteUsage && Object.keys(extRes.siteUsage).length > 0))) {
                hasLoadedFirstState = true;
                const extState = mapExtensionToState(extRes);
                renderState(extState);
                if (statusLabel) statusLabel.textContent = `Browser Extension ${extTrackingLabel}`;
            } else if (daemonData) {
                hasLoadedFirstState = true;
                renderState(daemonData);
                if (statusLabel) statusLabel.textContent = "Desktop Daemon Connected";
            } else if (latestState) {
                renderState(latestState);
                if (statusLabel) statusLabel.textContent = isDaemonConnected ? "Desktop Daemon Connected" : "Daemon Offline - Showing last collected data";
            }
        });
    }

    /**
     * Poll and populate multi-day activity history from both activity_history.json and chrome.storage.local
     */
    async function fetchHistory() {
        try {
            const res = await fetch(`activity_history.json?t=${Date.now()}`);
            if (res.ok) {
                const hist = await res.json();
                allHistory = hist || {};
            }
        } catch {
            // No local history file or running inside browser extension sandbox
        }

        // Bridge and merge multi-day browser extension history
        getExtensionTelemetry(res => {
            if (!res) {
                updateHistoryDropdown();
                return;
            }
            const todayKey = new Date().toISOString().slice(0, 10);

            // Mirror today's live unified data into allHistory for accurate historical deltas
            if (res.siteUsage && Object.keys(res.siteUsage).length > 0) {
                if (latestDaemonData) {
                    const mergedToday = mergeDaemonAndExtension(latestDaemonData, res);
                    if (mergedToday && mergedToday.summary) {
                        allHistory[todayKey] = {
                            totalActiveSeconds: mergedToday.summary.totalActiveSeconds || 0,
                            totalActiveFormatted: mergedToday.summary.totalActiveFormatted || formatDurationHuman(mergedToday.summary.totalActiveSeconds || 0),
                            totalSwitches: mergedToday.summary.totalSwitches || 0,
                            distinctAppsCount: (mergedToday.appUsage || []).length,
                            appUsage: mergedToday.appUsage || [],
                            timeline: mergedToday.timeline || []
                        };
                    }
                } else {
                    const todaySites = Object.values(res.siteUsage);
                    const todayTotal = todaySites.reduce((sum, s) => sum + (s.totalSec || 0), 0);
                    allHistory[todayKey] = {
                        totalActiveSeconds: todayTotal,
                        totalActiveFormatted: formatDurationHuman(todayTotal),
                        totalSwitches: res.totalTabSwitches || 0,
                        distinctAppsCount: todaySites.length,
                        appUsage: todaySites.map(s => ({
                            name: s.name,
                            category: s.category || displayCategory("Web Browser", s.name).label,
                            totalSeconds: s.totalSec || 0,
                            switchCount: s.visitCount || 1,
                            isBrowser: true
                        })),
                        timeline: (res.timeline || []).map(t => ({
                            time: t.timeStr || t.time || "",
                            appName: t.name || t.appName || "Website",
                            title: t.actionText || t.title || t.name,
                            category: displayCategory("Web Browser", t.name || t.appName).label,
                            durationSec: t.durationSec || 0,
                            durationFormatted: formatDurationHuman(t.durationSec || 0)
                        }))
                    };
                }
            }

            // Merge past days from historyByDate
            if (res.historyByDate && Object.keys(res.historyByDate).length > 0) {
                Object.entries(res.historyByDate).forEach(([dKey, dVal]) => {
                    const sites = Object.values(dVal.siteUsage || {});
                    const extTotalSec = sites.reduce((sum, s) => sum + (s.totalSec || 0), 0);
                    const extSwitches = dVal.totalTabSwitches || 0;
                    const extAppUsage = sites.map(s => ({
                        name: s.name,
                        category: s.category || displayCategory("Web Browser", s.name).label,
                        totalSeconds: s.totalSec || 0,
                        switchCount: s.visitCount || 1,
                        isBrowser: true
                    })).sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

                    const extTimeline = (dVal.timeline || []).map(t => ({
                        time: t.timeStr || t.time || "",
                        appName: t.name || t.appName || "Website",
                        title: t.actionText || t.title || t.name,
                        category: displayCategory("Web Browser", t.name).label,
                        durationSec: t.durationSec || 0,
                        durationFormatted: formatDurationHuman(t.durationSec || 0)
                    }));

                    if (!allHistory[dKey]) {
                        allHistory[dKey] = {
                            totalActiveSeconds: extTotalSec,
                            totalActiveFormatted: formatDurationHuman(extTotalSec),
                            totalSwitches: extSwitches,
                            distinctAppsCount: extAppUsage.length,
                            appUsage: extAppUsage,
                            timeline: extTimeline
                        };
                    } else {
                        // Merge missing sites into existing date history
                        const existing = allHistory[dKey];
                        existing.appUsage = existing.appUsage || [];
                        const appMap = {};
                        existing.appUsage.forEach(a => { appMap[a.name] = a; });
                        extAppUsage.forEach(a => {
                            if (!appMap[a.name]) {
                                existing.appUsage.push(a);
                                existing.totalActiveSeconds = (existing.totalActiveSeconds || 0) + a.totalSeconds;
                                existing.totalActiveFormatted = formatDurationHuman(existing.totalActiveSeconds);
                            }
                        });
                    }
                });
            }
            updateHistoryDropdown();
        });
    }

    function updateHistoryDropdown() {
        if (!historyDatePicker) return;
        const currentVal = historyDatePicker.value;
        const dates = Object.keys(allHistory).sort().reverse();
        
        let html = `
            <option value="today">Today (Live)</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Past 7 Days</option>
            <option value="30days">Past 30 Days</option>
            <option value="alltime">All Time (All Days)</option>
        `;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const pastDates = dates.filter(d => d !== todayStr);
        if (pastDates.length > 0) {
            html += `<optgroup label="Specific Past Dates">`;
            pastDates.forEach(d => {
                html += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
            });
            html += `</optgroup>`;
        }
        historyDatePicker.innerHTML = html;
        const validValues = ["today", "yesterday", "7days", "30days", "alltime", ...pastDates];
        if (validValues.includes(currentVal)) {
            historyDatePicker.value = currentVal;
        } else {
            historyDatePicker.value = "today";
        }
    }

    function mapYesterdayHistory() {
        const now = new Date();
        now.setDate(now.getDate() - 1);
        const yStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        if (allHistory[yStr]) {
            const day = allHistory[yStr];
            const cleanApps = (day.appUsage || []).filter(a => {
                const n = String(a.name || "").trim();
                return n && n !== "0" && !/^\d+$/.test(n);
            });
            const top = cleanApps[0];
            return {
                current: null,
                previous: null,
                summary: {
                    totalActiveSeconds: day.totalActiveSeconds || 0,
                    totalActiveFormatted: day.totalActiveFormatted || formatDurationHuman(day.totalActiveSeconds || 0),
                    totalSwitches: day.totalSwitches || 0,
                    distinctAppsCount: cleanApps.length,
                    mostUsedApp: top ? {
                        name: top.name,
                        category: top.category,
                        durationFormatted: formatDurationHuman(top.totalSeconds || 0),
                        percentage: Math.round(((top.totalSeconds || 0) / Math.max(1, day.totalActiveSeconds || 1)) * 100)
                    } : null
                },
                idleSeconds: day.totalIdleSec || day.idleSeconds || 0,
                appUsage: cleanApps,
                timeline: day.timeline || []
            };
        }
        return mapRangeHistory([yStr]);
    }

    function mapRangeHistory(targetDates) {
        let totalActiveSeconds = 0;
        let totalSwitches = 0;
        let totalIdleSeconds = 0;
        const appMap = {};
        const timeline = [];

        targetDates.forEach(dt => {
            const day = allHistory[dt];
            if (day) {
                totalActiveSeconds += (day.totalActiveSeconds || 0);
                totalSwitches += (day.totalSwitches || 0);
                totalIdleSeconds += (day.totalIdleSec || day.idleSeconds || 0);
                (day.timeline || []).forEach(t => timeline.push(t));
                (day.appUsage || []).forEach(a => {
                    const rawName = String(a.name || "").trim();
                    if (!rawName || rawName === "0" || /^\d+$/.test(rawName)) return;
                    const key = rawName;
                    if (!appMap[key]) {
                        appMap[key] = {
                            name: key,
                            category: a.category || "Other",
                            totalSeconds: 0,
                            switchCount: 0
                        };
                    }
                    appMap[key].totalSeconds += (a.totalSeconds || 0);
                    appMap[key].switchCount += (a.switchCount || 0);
                });
            }
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
            idleSeconds: totalIdleSeconds,
            appUsage: appUsage,
            timeline: timeline.slice(0, 200)
        };
    }

    function mapPastDays(daysCount) {
        const targetDates = [];
        const now = new Date();
        for (let i = 0; i < daysCount; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            targetDates.push(dStr);
        }
        return mapRangeHistory(targetDates);
    }

    /**
     * Aggregate every stored day into one "All Time" view so the dashboard never
     * starts from zero when a new day begins.
     */
    function mapAllTimeHistory() {
        let totalActiveSeconds = 0;
        let totalSwitches = 0;
        let totalIdleSeconds = 0;
        const appMap = {};
        const timeline = [];

        Object.values(allHistory || {}).forEach(day => {
            totalActiveSeconds += (day.totalActiveSeconds || 0);
            totalSwitches += (day.totalSwitches || 0);
            totalIdleSeconds += (day.totalIdleSec || day.idleSeconds || 0);
            (day.timeline || []).forEach(t => timeline.push(t));
            (day.appUsage || []).forEach(a => {
                const rawName = String(a.name || "").trim();
                if (!rawName || rawName === "0" || /^\d+$/.test(rawName)) return;
                const key = rawName;
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
            idleSeconds: totalIdleSeconds,
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
                if (statusLabel) statusLabel.textContent = isDaemonConnected ? "Desktop Daemon Connected" : "Browser Extension Connected";
            } else if (val === "yesterday") {
                isHistoricalView = true;
                const state = mapYesterdayHistory();
                renderState(state);
                renderFocusPanel(state);
                if (statusLabel) statusLabel.textContent = "Historical View: Yesterday";
            } else if (val === "7days") {
                isHistoricalView = true;
                const state = mapPastDays(7);
                renderState(state);
                renderFocusPanel(state);
                if (statusLabel) statusLabel.textContent = "Historical View: Past 7 Days";
            } else if (val === "30days") {
                isHistoricalView = true;
                const state = mapPastDays(30);
                renderState(state);
                renderFocusPanel(state);
                if (statusLabel) statusLabel.textContent = "Historical View: Past 30 Days";
            } else if (val === "alltime") {
                isHistoricalView = true;
                const state = mapAllTimeHistory();
                renderState(state);
                renderFocusPanel(state);
                if (statusLabel) statusLabel.textContent = "Historical View: All Time (All Days)";
            } else if (allHistory[val]) {
                isHistoricalView = true;
                const histDay = allHistory[val];
                const cleanApps = (histDay.appUsage || []).filter(a => {
                    const n = String(a.name || "").trim();
                    return n && n !== "0" && !/^\d+$/.test(n);
                });
                const mappedHist = {
                    current: null,
                    previous: null,
                    summary: {
                        totalActiveSeconds: histDay.totalActiveSeconds || 0,
                        totalActiveFormatted: histDay.totalActiveFormatted || formatDurationHuman(histDay.totalActiveSeconds || 0),
                        totalSwitches: histDay.totalSwitches || 0,
                        distinctAppsCount: cleanApps.length,
                        mostUsedApp: cleanApps.length > 0 ? {
                            name: cleanApps[0].name,
                            category: cleanApps[0].category,
                            durationFormatted: formatDurationHuman(cleanApps[0].totalSeconds),
                            percentage: Math.round(((cleanApps[0].totalSeconds || 0) / Math.max(1, histDay.totalActiveSeconds || 1)) * 100)
                        } : null
                    },
                    idleSeconds: histDay.totalIdleSec || histDay.idleSeconds || 0,
                    appUsage: cleanApps,
                    timeline: histDay.timeline || []
                };
                renderState(mappedHist);
                renderFocusPanel(mappedHist);
                if (statusLabel) statusLabel.textContent = `Historical View: ${val}`;
            }
        });
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
    const headerScopeIndicator = document.getElementById("header-scope-indicator");
    scopeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            scopeButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentScopeFilter = btn.getAttribute("data-scope") || "all";
            if (headerScopeIndicator) {
                const scopeLabels = {
                    all: "Scope: All Activity",
                    desktop: "Scope: Desktop Applications",
                    browser: "Scope: Browser Websites",
                    system: "Scope: System Context"
                };
                headerScopeIndicator.textContent = scopeLabels[currentScopeFilter] || "Scope: All Activity";
            }
            if (latestState) renderState(latestState);
        });
    });

    // Print / PDF Report Export
    const btnPrintReport = document.getElementById("btn-print-report");
    if (btnPrintReport) {
        btnPrintReport.addEventListener("click", () => {
            window.print();
        });
    }

    /* ========================================================================
       FOCUS PANEL: live score + time-loss breakdown + AI JSON summary
       ======================================================================== */
    function renderFocusPanel(targetState) {
        const stateToUse = targetState || currentActiveViewState || latestState;
        if (!stateToUse) return;
        const summary = stateToUse.summary || {};
        const totalActiveSec = summary.totalActiveSeconds || 0;
        const panelCalibrating = totalActiveSec < 60 && !isHistoricalView;
        const breakdown = computeFocusBreakdown(stateToUse);
        const score = breakdown.score;
        const g = focusGrade(score);
        const fsScore = document.getElementById("fs-score");
        const fsGrade = document.getElementById("fs-grade");
        const fsJsonLabel = document.getElementById("fs-json-label");
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
            if (fsJsonLabel) {
                fsJsonLabel.textContent = `Time-Loss JSON Summary & Attention Audit (${g.label} Focus - ${score}/100)`;
            }
        }
        const apps = stateToUse.appUsage || [];
        let entSec = 0, commSec = 0;
        apps.forEach(a => {
            const cat = displayCategory(a.category, a.name);
            if (cat.label === "Entertainment") entSec += (a.totalSeconds || 0);
            if (cat.label === "Communication") commSec += (a.totalSeconds || 0);
        });
        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el("fs-switches", stateToUse.summary ? (stateToUse.summary.totalSwitches !== undefined ? stateToUse.summary.totalSwitches : 0) : 0);
        el("fs-idle", formatDurationHuman(stateToUse.idleSeconds || 0));
        el("fs-ent", formatDurationHuman(entSec));
        el("fs-comm", formatDurationHuman(commSec));

        // Keep audit cards and JSON in sync if already displayed
        const fsWrap = document.getElementById("fs-json-wrap");
        if (fsWrap && fsWrap.style.display !== "none" && document.getElementById("fs-audit-cards")) {
            renderAuditCards(stateToUse, breakdown);
            const fsJson = document.getElementById("fs-json");
            if (fsJson) {
                const summaryObj = buildTimeLossJson(stateToUse);
                fsJson.textContent = JSON.stringify(summaryObj, null, 2);
            }
        }

        // Readiness badges
        const fsReady = document.getElementById("fs-readiness");
        if (fsReady) fsReady.innerHTML = readinessHtml("focus-score", "Focus Score");
        const tlReady = document.getElementById("timeloss-readiness");
        if (tlReady) tlReady.innerHTML = readinessHtml("time-loss", "Time Loss Summary");
    }

    if (document.getElementById("fs-btn-summary")) {
        document.getElementById("fs-btn-summary").addEventListener("click", generateTimeLossSummary);
    }
    // AI API Keys Modal Management
    const apiKeyModal = document.getElementById("api-key-modal");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    const modalDoneBtn = document.getElementById("modal-done-btn");
    const inputGeminiKey = document.getElementById("input-gemini-key");
    const inputGroqKey = document.getElementById("input-groq-key");
    const btnSaveGemini = document.getElementById("btn-save-gemini");
    const btnRemoveGemini = document.getElementById("btn-remove-gemini");
    const btnSaveGroq = document.getElementById("btn-save-groq");
    const btnRemoveGroq = document.getElementById("btn-remove-groq");
    const geminiStatusBadge = document.getElementById("gemini-status-badge");
    const groqStatusBadge = document.getElementById("groq-status-badge");

    function updateApiKeyModalUi() {
        const keys = getApiKeys();
        if (keys.gemini) {
            if (geminiStatusBadge) {
                geminiStatusBadge.textContent = "Configured";
                geminiStatusBadge.className = "key-status-badge status-ready";
            }
            if (inputGeminiKey) inputGeminiKey.placeholder = "Key saved (Enter new key to change)";
            if (btnRemoveGemini) btnRemoveGemini.style.display = "inline-block";
        } else {
            if (geminiStatusBadge) {
                geminiStatusBadge.textContent = "Not Configured";
                geminiStatusBadge.className = "key-status-badge";
            }
            if (inputGeminiKey) {
                inputGeminiKey.value = "";
                inputGeminiKey.placeholder = "Enter Gemini API key (AIzaSy...)";
            }
            if (btnRemoveGemini) btnRemoveGemini.style.display = "none";
        }

        if (keys.groq) {
            if (groqStatusBadge) {
                groqStatusBadge.textContent = "Configured";
                groqStatusBadge.className = "key-status-badge status-ready";
            }
            if (inputGroqKey) inputGroqKey.placeholder = "Key saved (Enter new key to change)";
            if (btnRemoveGroq) btnRemoveGroq.style.display = "inline-block";
        } else {
            if (groqStatusBadge) {
                groqStatusBadge.textContent = "Not Configured";
                groqStatusBadge.className = "key-status-badge";
            }
            if (inputGroqKey) {
                inputGroqKey.value = "";
                inputGroqKey.placeholder = "Enter Groq API key (gsk_...)";
            }
            if (btnRemoveGroq) btnRemoveGroq.style.display = "none";
        }
    }

    function openApiKeyModal() {
        updateApiKeyModalUi();
        if (apiKeyModal) apiKeyModal.style.display = "flex";
    }

    function closeApiKeyModal() {
        if (apiKeyModal) apiKeyModal.style.display = "none";
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeApiKeyModal);
    if (modalDoneBtn) modalDoneBtn.addEventListener("click", closeApiKeyModal);
    if (apiKeyModal) {
        apiKeyModal.addEventListener("click", (e) => {
            if (e.target === apiKeyModal) closeApiKeyModal();
        });
    }

    if (btnSaveGemini) {
        btnSaveGemini.addEventListener("click", () => {
            const val = (inputGeminiKey.value || "").trim();
            if (val) {
                setApiKey("gemini", val);
                inputGeminiKey.value = "";
                updateApiKeyModalUi();
            }
        });
    }

    if (btnRemoveGemini) {
        btnRemoveGemini.addEventListener("click", () => {
            const keys = getApiKeys();
            delete keys.gemini;
            try { localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(keys)); } catch {}
            updateApiKeyModalUi();
        });
    }

    if (btnSaveGroq) {
        btnSaveGroq.addEventListener("click", () => {
            const val = (inputGroqKey.value || "").trim();
            if (val) {
                setApiKey("groq", val);
                inputGroqKey.value = "";
                updateApiKeyModalUi();
            }
        });
    }

    if (btnRemoveGroq) {
        btnRemoveGroq.addEventListener("click", () => {
            const keys = getApiKeys();
            delete keys.groq;
            try { localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(keys)); } catch {}
            updateApiKeyModalUi();
        });
    }

    if (document.getElementById("fs-btn-api")) {
        document.getElementById("fs-btn-api").addEventListener("click", openApiKeyModal);
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

    // Activity Stream: re-render on search input
    const tlSearchInput = document.getElementById('timeline-search');
    if (tlSearchInput) {
        tlSearchInput.addEventListener('input', () => {
            if (latestState) renderState(latestState);
        });
    }
});
