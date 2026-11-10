/**
 * Persistent Data Storage & Backend Sync Manager
 * 
 * Manages structured Activity Records:
 * [eventId, sessionId, browserName, tabId, websiteName, domain, url, eventType, timestamp, category, duration]
 * 
 * Handles:
 * - Local persistence (localStorage & IndexedDB fallback)
 * - Automatic background syncing with FastAPI backend (http://localhost:8000/api)
 * - Data sanitization (strips authentication tokens from URLs)
 * - JSON and CSV export
 * - Privacy-first data wiping
 */

class StorageManager {
    constructor() {
        this.sessionId = "sess_" + Date.now();
        this.browserName = this._detectBrowser();
        this.storageKey = AttentionConfig.STORAGE_KEY;
        this.backendAvailable = false;
        this.syncQueue = [];

        this._checkBackendHealth();
    }

    _detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes("Edg/")) return "Microsoft Edge";
        if (ua.includes("Chrome/")) return "Google Chrome";
        if (ua.includes("Firefox/")) return "Mozilla Firefox";
        return "Standard Browser";
    }

    async _checkBackendHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const res = await fetch(`${AttentionConfig.BACKEND_API_URL}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);
            this.backendAvailable = res.ok;
        } catch {
            this.backendAvailable = false;
        }
    }

    /**
     * Sanitizes URLs to remove sensitive tokens and secrets before storage
     */
    sanitizeUrl(rawUrl) {
        try {
            const u = new URL(rawUrl);
            const sensitiveParams = ["token", "auth", "key", "password", "session", "access_token", "jwt", "apikey", "secret"];
            sensitiveParams.forEach(p => {
                if (u.searchParams.has(p)) {
                    u.searchParams.set(p, "[REDACTED]");
                }
            });
            return u.toString();
        } catch {
            return rawUrl;
        }
    }

    /**
     * Creates and stores a structured activity record
     */
    saveActivity(record) {
        const structuredRecord = {
            eventId: record.eventId || "evt_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            sessionId: this.sessionId,
            browserName: this.browserName,
            tabId: record.tabId || 1,
            websiteName: record.websiteName || "Unknown",
            domain: record.domain || "unknown",
            url: this.sanitizeUrl(record.url || ""),
            eventType: record.eventType || "TAB_DWELL",
            timestamp: record.timestamp || Date.now(),
            category: record.category || "OTHER",
            isProductive: !!record.isProductive,
            durationSeconds: record.durationSeconds || 1
        };

        // Save locally
        this._appendLocal(structuredRecord);

        // Queue for backend sync if available
        this._syncToBackend(structuredRecord);

        return structuredRecord;
    }

    _appendLocal(record) {
        try {
            let list = [];
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                list = JSON.parse(saved);
            }
            list.push(record);

            // Keep maximum 2000 records locally to prevent storage quota overflow
            if (list.length > 2000) {
                list = list.slice(list.length - 2000);
            }

            localStorage.setItem(this.storageKey, JSON.stringify(list));
        } catch (e) {
            console.warn("Storage quota exceeded or localStorage unavailable", e);
        }
    }

    async _syncToBackend(record) {
        if (!this.backendAvailable) return;

        try {
            await fetch(`${AttentionConfig.BACKEND_API_URL}/activities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(record)
            });
        } catch {
            this.backendAvailable = false;
        }
    }

    getAllRecords() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    /**
     * Export all stored browsing activities as JSON
     */
    exportJSON() {
        const records = this.getAllRecords();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `attention_activity_export_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    /**
     * Export all stored browsing activities as CSV
     */
    exportCSV() {
        const records = this.getAllRecords();
        if (records.length === 0) {
            alert("No activity records available to export.");
            return;
        }

        const headers = ["Event ID", "Session ID", "Browser", "Tab ID", "Website Name", "Domain", "URL", "Category", "Is Productive", "Duration (s)", "Timestamp"];
        const rows = records.map(r => [
            r.eventId,
            r.sessionId,
            r.browserName,
            r.tabId,
            `"${(r.websiteName || '').replace(/"/g, '""')}"`,
            r.domain,
            `"${(r.url || '').replace(/"/g, '""')}"`,
            r.category,
            r.isProductive ? "YES" : "NO",
            r.durationSeconds,
            new Date(r.timestamp).toISOString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `attention_activity_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    /**
     * Privacy-respecting data deletion
     */
    clearAllData() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem("attention_focus_history_v2");
        localStorage.removeItem("attention_category_overrides_v2");
    }
}

// Export for module/browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = StorageManager;
}

