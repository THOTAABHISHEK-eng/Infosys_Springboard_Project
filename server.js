/**
 * Lightweight Dashboard HTTP Server (Node.js fallback for Python)
 * Serves the ActivityWatch dashboard on http://127.0.0.1:5500/
 * Handles static files and the /api/sync endpoint matching the meeting requirements.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5500;
const HOST = "127.0.0.1";
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, "activity_state.json");
const HISTORY_FILE = path.join(ROOT, "activity_history.json");
const ACTIVITY_DATA_FILE = path.join(ROOT, "activity_data.json");
const RESET_FLAG = path.join(ROOT, "activity_reset.flag");

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

const CATEGORY_MAP = {
    "youtube.com": "Entertainment",
    "netflix.com": "Entertainment",
    "spotify.com": "Entertainment",
    "primevideo.com": "Entertainment",
    "instagram.com": "Social Media",
    "facebook.com": "Social Media",
    "reddit.com": "Social Media",
    "twitter.com": "Social Media",
    "x.com": "Social Media",
    "github.com": "Development",
    "stackoverflow.com": "Development",
    "chatgpt.com": "Learning",
    "claude.ai": "Learning",
    "meet.google.com": "Communication",
    "zoom.us": "Communication",
    "web.whatsapp.com": "Communication",
    "mail.google.com": "Professional"
};

function guessCategory(domain, name) {
    const d = (domain || "").toLowerCase();
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
        if (d.includes(key)) return cat;
    }
    if (d.includes("docs") || d.includes("learn") || d.includes("edu") || d.includes("wiki")) return "Learning";
    if (d.includes("shop") || d.includes("amazon") || d.includes("flipkart")) return "Shopping";
    if (d.includes("news") || d.includes("bbc") || d.includes("cnn")) return "News";
    return "Utilities";
}

function computeFocusAnalysis(data) {
    const switches = data.totalTabSwitches || data.switches || 0;
    const siteUsage = data.siteUsage || {};
    const totalIdleSec = data.totalIdleSec || data.idleSeconds || 0;

    let totalActiveSec = 0;
    Object.values(siteUsage).forEach(s => {
        totalActiveSec += (s.totalSec || s.totalSeconds || 0);
    });

    const totalTimeSec = Math.max(1, totalActiveSec + totalIdleSec);
    const idleRatio = (totalIdleSec / totalTimeSec) * 100;

    // 1. Deduction: Tab switching (0 to 20 pts)
    let tabDeduction = 0;
    if (switches > 50) tabDeduction = 20;
    else if (switches > 25) tabDeduction = 15;
    else if (switches > 10) tabDeduction = 10;
    else if (switches > 5) tabDeduction = 5;

    // 2. Deduction: Category usage (0 to 30 pts)
    let distractionSec = 0;
    let topDistractionSite = null;
    let maxDistractSec = 0;

    for (const [domain, s] of Object.entries(siteUsage)) {
        const cat = s.category || guessCategory(domain, s.name);
        const sec = s.totalSec || s.totalSeconds || 0;
        const catLower = (cat || "").toLowerCase();
        if (catLower.includes("entertain") || catLower.includes("social") || catLower.includes("shop")) {
            distractionSec += sec;
            if (sec > maxDistractSec) {
                maxDistractSec = sec;
                topDistractionSite = s.name || domain;
            }
        }
    }

    const distractRatio = totalActiveSec > 0 ? (distractionSec / totalActiveSec) : 0;
    const categoryDeduction = Math.min(30, Math.round(distractRatio * 35));

    // 3. Deduction: Idle time (0 to 20 pts)
    let idleDeduction = 0;
    if (idleRatio >= 35) idleDeduction = 20;
    else if (idleRatio >= 20) idleDeduction = 15;
    else if (idleRatio >= 10) idleDeduction = 10;
    else if (idleRatio >= 5) idleDeduction = 5;

    // 4. Deduction: Focus sessions / dwell depth (0 to 20 pts)
    const avgDwell = totalActiveSec / Math.max(1, switches + 1);
    let focusSessionDeduction = 0;
    if (avgDwell < 30) focusSessionDeduction = 20;
    else if (avgDwell < 60) focusSessionDeduction = 15;
    else if (avgDwell < 120) focusSessionDeduction = 10;

    const deductions = {
        tab_switching: tabDeduction,
        category_usage: categoryDeduction,
        idle_time: idleDeduction,
        focus_sessions: focusSessionDeduction
    };

    const totalDeductions = tabDeduction + categoryDeduction + idleDeduction + focusSessionDeduction;
    const focusScore = Math.max(10, Math.min(100, 100 - totalDeductions));

    let classification = "Average";
    if (focusScore >= 85) classification = "Excellent";
    else if (focusScore >= 70) classification = "Good";
    else if (focusScore >= 50) classification = "Average";
    else classification = "Poor";

    const totalTabs = Object.keys(siteUsage).length || 1;
    const sessionType = (totalTabs > 10 || switches > 20)
        ? `Multi-Tab Session (${totalTabs} tabs)`
        : `Focused Session (${totalTabs} tabs)`;

    // Narrative Analysis
    const reasons = [];
    if (tabDeduction > 0) reasons.push(`heavy tab switching (-${tabDeduction} points)`);
    if (categoryDeduction > 0) reasons.push(`distraction category usage (-${categoryDeduction} points)`);
    if (idleDeduction > 0) reasons.push(`significant idle time (-${idleDeduction} points)`);
    if (focusSessionDeduction > 0) reasons.push(`a lack of tracked focus sessions (-${focusSessionDeduction} points)`);

    let analysis = "";
    if (reasons.length > 0) {
        analysis = `The user's focus score decreased due to ${reasons.join(", ")}.`;
        if (topDistractionSite) {
            const mins = Math.round(maxDistractSec / 60);
            analysis += ` Distractions were primarily driven by browsing on ${topDistractionSite}${mins > 0 ? ` (${mins}m)` : ""}, which accounted for the bulk of non-productive duration.`;
        }
    } else {
        analysis = "The user maintained optimal focus with zero deductions across all monitored metrics. Browsing was disciplined with strong dwell times and minimal cognitive reorientation.";
    }

    // Recommendations (always given, varied)
    const recs = [];
    if (focusSessionDeduction > 0) {
        recs.push("Integrate a Pomodoro focus timer into your routine to structure work intervals and properly log focus sessions.");
    }
    if (tabDeduction > 0) {
        recs.push("Minimize frequent tab switching by closing unrelated tabs and focusing on a single task at a time.");
    }
    if (idleDeduction > 0) {
        recs.push("Reduce idle time by setting clear session goals and taking designated breaks rather than drifting between tabs.");
    }
    if (categoryDeduction > 0 && topDistractionSite) {
        recs.push(`Limit visits to entertainment sites like ${topDistractionSite} during active work periods to maintain continuous concentration.`);
    }

    if (recs.length < 4) {
        if (focusScore >= 80) {
            recs.push("Protect your high flow state by pre-scheduling dedicated 45-minute deep work intervals.");
            recs.push("Take structured 5-minute cognitive rest breaks between major research milestones.");
            recs.push("Consolidate open tabs into browser tab groups at the end of each session to prevent cognitive clutter.");
            recs.push("Mute non-critical instant messaging notifications during peak concentration periods.");
        } else {
            recs.push("Group tabs by task using Chrome Tab Groups to maintain clear mental boundaries.");
            recs.push("Keep a single primary application in the foreground and minimize background distractions.");
        }
    }

    return {
        focus_score: focusScore,
        classification: classification,
        deduction_breakdown: deductions,
        session_type: sessionType,
        real_tab_switches: switches,
        in_tab_idle_ratio: `${idleRatio.toFixed(2)}%`,
        analysis: analysis,
        recommendations: recs.slice(0, 4),
        top_distraction_site: topDistractionSite || "None"
    };
}

function emptyState() {
    const today = new Date().toISOString().slice(0, 10);
    return {
        date: today,
        timestamp: new Date().toISOString().slice(0, 19),
        current: null,
        previous: null,
        summary: {
            totalActiveSeconds: 0,
            totalActiveFormatted: "0s",
            totalSwitches: 0,
            distinctAppsCount: 0,
            mostUsedApp: null
        },
        appUsage: [],
        timeline: []
    };
}

function applyReset() {
    try {
        fs.writeFileSync(RESET_FLAG, "reset", "utf8");
        fs.writeFileSync(STATE_FILE, JSON.stringify(emptyState(), null, 2), "utf8");

        let history = {};
        if (fs.existsSync(HISTORY_FILE)) {
            try {
                history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
            } catch {
                history = {};
            }
        }
        const today = new Date().toISOString().slice(0, 10);
        delete history[today];
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
    } catch (e) {
        console.error("Reset error:", e);
    }
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    // Endpoint: POST /local/reset
    if (req.method === "POST" && pathname === "/local/reset") {
        applyReset();
        const body = JSON.stringify({ status: "reset" });
        res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            "Cache-Control": "no-store"
        });
        res.end(body);
        return;
    }

    // Endpoint: POST /api/sync
    if (req.method === "POST" && pathname === "/api/sync") {
        let bodyStr = "";
        req.on("data", chunk => { bodyStr += chunk; });
        req.on("end", () => {
            let payload = {};
            try { payload = JSON.parse(bodyStr); } catch (e) {}

            const analysisResult = computeFocusAnalysis(payload);

            const saveRecord = {
                received_at: new Date().toISOString(),
                telemetry: payload,
                analysis: analysisResult
            };
            fs.writeFileSync(ACTIVITY_DATA_FILE, JSON.stringify(saveRecord, null, 2), "utf8");

            console.log("\n========================================================================");
            console.log("[SYNC SUCCESS] RECEIVED REAL BROWSING HISTORY FROM CHROME");
            console.log("========================================================================");
            console.log(`Focus Score:         ${analysisResult.focus_score} / 100`);
            console.log(`Classification:      ${analysisResult.classification}`);
            console.log(`Deduction Breakdown: ${JSON.stringify(analysisResult.deduction_breakdown)}`);
            console.log(`Session Type:        ${analysisResult.session_type}`);
            console.log(`Real Tab Switches:   ${analysisResult.real_tab_switches}`);
            console.log(`In-Tab Idle Ratio:   ${analysisResult.in_tab_idle_ratio}`);
            console.log("\nAnalysis:");
            console.log(analysisResult.analysis);
            console.log("\nRecommendations:");
            analysisResult.recommendations.forEach((rec, idx) => {
                console.log(`${idx + 1}. ${rec}`);
            });
            console.log("Saved to activity_data.json. Waiting for next sync from browser...\n");

            const resp = JSON.stringify({ status: "success", result: analysisResult });
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(resp),
                "Cache-Control": "no-store"
            });
            res.end(resp);
        });
        return;
    }

    if (pathname === "/") {
        pathname = "/index.html";
    }

    const filePath = path.join(ROOT, pathname);

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "no-store"
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, HOST, () => {
    console.log("========================================================================");
    console.log("SYSTEM-WIDE APPLICATION & BROWSER USAGE TRACKER");
    console.log(`Dashboard running on: http://${HOST}:${PORT}/`);
    console.log("========================================================================");
    console.log("Instructions:");
    console.log("1. Browse normally in Google Chrome with the extension loaded.");
    console.log("2. In Chrome DevTools (Service worker console), type: sync()");
    console.log("3. Your REAL browser history is received and analyzed instantly!");
    console.log("Press Ctrl+C to stop the server.");
    console.log("========================================================================\n");
});
