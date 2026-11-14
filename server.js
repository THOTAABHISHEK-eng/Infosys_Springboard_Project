/**
 * Lightweight Dashboard HTTP Server (Node.js fallback for Python)
 * Serves the ActivityWatch dashboard on http://127.0.0.1:5500/
 * Handles static files and the /local/reset endpoint silently without console spam.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5500;
const HOST = "127.0.0.1";
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, "activity_state.json");
const HISTORY_FILE = path.join(ROOT, "activity_history.json");
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
    // Silence request logging so console remains clean
    const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

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

    if (pathname === "/") {
        pathname = "/index.html";
    }

    const filePath = path.join(ROOT, pathname);

    // Prevent directory traversal
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
    // Started silently
});

