/**
 * ActivityWatch Bridge: Syncs extension telemetry directly into the dashboard
 * when loaded on http://127.0.0.1:5500 or http://localhost:5500
 */
(function() {
    function pushStateToPage() {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
        chrome.storage.local.get([
            "currentWebsite",
            "previousWebsite",
            "currentDwellSec",
            "totalTabSwitches",
            "siteUsage",
            "timeline",
            "isWindowFocused",
            "historyByDate",
            "idleState",
            "totalIdleSec",
            "idleProgressSeconds",
            "idleTimeSeconds"
        ], res => {
            if (chrome.runtime.lastError || !res) return;
            const stateStr = JSON.stringify(res);
            try {
                window.localStorage.setItem("ACTIVITYWATCH_EXTENSION_STATE", stateStr);
            } catch (e) {}
            window.postMessage({
                source: "ACTIVITYWATCH_EXTENSION_BRIDGE",
                type: "SYNC_TELEMETRY",
                payload: res
            }, "*");
        });
    }

    // Push immediately on load
    pushStateToPage();

    // Listen to changes in storage and push to page in real time
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === "local") {
                pushStateToPage();
            }
        });
    }

    // 1-second interval heartbeat sync
    setInterval(pushStateToPage, 1000);

    // Also respond to ping requests from app.js
    window.addEventListener("message", ev => {
        if (ev.data && ev.data.source === "ACTIVITYWATCH_DASHBOARD_REQUEST") {
            pushStateToPage();
        }
    });
})();
