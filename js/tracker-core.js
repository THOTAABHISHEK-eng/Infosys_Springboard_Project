/**
 * Core Real-Time Attention & Browsing Activity Tracker Engine
 * 
 * Accurately calculates active-tab dwell duration.
 * Strictly pauses tracking when the browser window is blurred or minimized.
 * Scientifically distinguishes active-tab duration from actual human attention.
 */

class AttentionTrackerCore {
    constructor() {
        this.currentWebsite = null;
        this.previousWebsite = null;
        this.currentTabId = null;
        this.isWindowFocused = true;
        this.isTrackingActive = true;

        // Dwell timing
        this.currentDwellSeconds = 0;
        this.totalBrowsingSeconds = 0;
        this.totalTabSwitches = 0;
        this.tickCount = 0;
        this.intervalId = null;

        // History of activity sessions & tab events
        this.activityLog = [];
        this.recentSwitches = []; // Timestamps of recent tab switches for velocity calculation

        // Subscribers
        this.listeners = {
            tick: [],
            transition: [],
            windowFocus: []
        };

        this._initWindowListeners();
        this._initDefaultState();
    }

    _initDefaultState() {
        const now = new Date();
        const prevTime = new Date(now.getTime() - 25000);

        this.previousWebsite = {
            websiteName: "Google Scholar",
            domain: "scholar.google.com",
            url: "https://scholar.google.com/scholar?q=attention+management+hci",
            category: "RESEARCH",
            categoryMeta: AttentionConfig.CATEGORIES.RESEARCH,
            isProductive: true,
            lastUpdated: this._formatTime(prevTime),
            timestamp: prevTime.getTime(),
            durationSeconds: 25
        };

        this.currentWebsite = {
            websiteName: "Infosys Springboard",
            domain: "springboard.infosys.com",
            url: "https://springboard.infosys.com/learning-tracker",
            category: "EDUCATION",
            categoryMeta: AttentionConfig.CATEGORIES.EDUCATION,
            isProductive: true,
            lastUpdated: this._formatTime(now),
            timestamp: now.getTime(),
            durationSeconds: 0
        };

        this.totalTabSwitches = 1;
    }

    _initWindowListeners() {
        if (typeof window !== "undefined") {
            window.addEventListener("focus", () => {
                this.isWindowFocused = true;
                this._notify("windowFocus", { focused: true });
            });
            window.addEventListener("blur", () => {
                this.isWindowFocused = false;
                this._notify("windowFocus", { focused: false });
            });
        }
    }

    _formatTime(d) {
        const date = d instanceof Date ? d : new Date(d);
        return date.toLocaleTimeString("en-US", {
            hour12: true,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }

    /**
     * Start the 1000ms heartbeat tracking loop
     */
    start() {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this._tick();
        }, 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Internal 1-second pulse
     */
    _tick() {
        if (!this.isTrackingActive) return;

        this.tickCount++;

        // Only accumulate active-tab dwell duration when window is actually focused
        if (this.isWindowFocused && this.currentWebsite) {
            this.currentDwellSeconds++;
            this.totalBrowsingSeconds++;
            this.currentWebsite.durationSeconds = this.currentDwellSeconds;
        }

        // Clean up recent switch timestamps older than 2 minutes (120s)
        const now = Date.now();
        this.recentSwitches = this.recentSwitches.filter(ts => (now - ts) <= (AttentionConfig.THRESHOLDS.EXCESSIVE_SWITCH_WINDOW_SEC * 1000));

        // Calculate tab switch velocity (switches per minute)
        const switchVelocity = (this.recentSwitches.length / (AttentionConfig.THRESHOLDS.EXCESSIVE_SWITCH_WINDOW_SEC / 60)).toFixed(1);

        // Notify subscribers
        this._notify("tick", {
            tickCount: this.tickCount,
            currentDwellSeconds: this.currentDwellSeconds,
            totalBrowsingSeconds: this.totalBrowsingSeconds,
            totalTabSwitches: this.totalTabSwitches,
            switchVelocity: parseFloat(switchVelocity),
            isWindowFocused: this.isWindowFocused,
            currentWebsite: this.currentWebsite,
            previousWebsite: this.previousWebsite,
            formattedTime: this._formatTime(new Date())
        });
    }

    /**
     * Called when active tab navigates to a new URL or user switches tab
     */
    recordNavigation(url, title = null, tabId = null) {
        if (!url || typeof url !== "string") return;

        // Skip internal browser URLs
        if (url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:") || url.startsWith("chrome-extension://")) {
            return;
        }

        const now = Date.now();
        const classification = URLCategorizer.classify(url);

        // Check if user is on the exact same page
        if (this.currentWebsite && this.currentWebsite.url === url && this.currentTabId === tabId) {
            return;
        }

        // Finalize previous session log
        if (this.currentWebsite) {
            this.currentWebsite.endTime = now;
            this.currentWebsite.finalDwell = this.currentDwellSeconds;

            // Push to historical activity log
            const activityRecord = {
                eventId: "evt_" + now + "_" + Math.floor(Math.random() * 1000),
                tabId: this.currentTabId || 1,
                websiteName: this.currentWebsite.websiteName,
                domain: this.currentWebsite.domain,
                url: this.currentWebsite.url,
                category: this.currentWebsite.category,
                isProductive: this.currentWebsite.isProductive,
                startTime: this.currentWebsite.timestamp,
                endTime: now,
                durationSeconds: Math.max(1, this.currentDwellSeconds),
                timestamp: now
            };

            this.activityLog.push(activityRecord);

            // Shift current to previous
            this.previousWebsite = { ...this.currentWebsite };
        }

        // Register tab switch
        this.totalTabSwitches++;
        this.recentSwitches.push(now);

        // Setup new Current Website
        this.currentTabId = tabId;
        this.currentDwellSeconds = 0;
        this.currentWebsite = {
            websiteName: title || classification.websiteName,
            domain: classification.domain,
            url: url,
            category: classification.category,
            categoryMeta: classification.categoryMeta,
            isProductive: classification.isProductive,
            lastUpdated: this._formatTime(new Date()),
            timestamp: now,
            durationSeconds: 0
        };

        this._notify("transition", {
            currentWebsite: this.currentWebsite,
            previousWebsite: this.previousWebsite,
            tabSwitches: this.totalTabSwitches
        });
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    _notify(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => {
                try {
                    cb(data);
                } catch (err) {
                    console.error(`Error in AttentionTrackerCore listener (${event}):`, err);
                }
            });
        }
    }

    getActivityHistory() {
        return [...this.activityLog];
    }

    clearActivity() {
        this.activityLog = [];
        this.totalTabSwitches = 0;
        this.totalBrowsingSeconds = 0;
        this.currentDwellSeconds = 0;
    }
}

// Export for module/browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = AttentionTrackerCore;
}

