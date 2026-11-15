/**
 * Core URL Tracking Engine
 * Manages Current and Previous URL states and runs continuous 1-second monitoring loop.
 */

class URLTracker {
    constructor() {
        // Initial state
        this.current = null;
        this.previous = null;
        this.history = [];

        // Timer control
        this.intervalId = null;
        this.intervalMs = 1000; // 1 second as strictly required
        this.isMonitoring = false;
        this.tickCount = 0;
        this.startTime = null;

        // Callback subscribers
        this.tickListeners = [];
        this.changeListeners = [];

        // Set initial default demo data (Infosys Springboard as Current, Google as initial Previous)
        this._initDefaultState();
    }

    /**
     * Initializes a realistic default state so the dashboard looks immediately alive on launch.
     */
    _initDefaultState() {
        const now = new Date();
        const prevTime = new Date(now.getTime() - 15000); // 15 seconds ago

        this.previous = {
            websiteName: 'Google Search',
            domain: 'www.google.com',
            url: 'https://www.google.com/search?q=infosys+springboard',
            lastUpdated: this._formatTime(prevTime),
            timestamp: prevTime
        };

        this.current = {
            websiteName: 'Infosys Springboard',
            domain: 'springboard.infosys.com',
            url: 'https://springboard.infosys.com/learning-tracker',
            lastUpdated: this._formatTime(now),
            timestamp: now
        };

        this.history.push({ ...this.previous });
        this.history.push({ ...this.current });
    }

    /**
     * Helper to format Date into human-readable 12-hour/24-hour string with seconds.
     * E.g. "06:18:24 PM"
     */
    _formatTime(date) {
        if (!date) return 'N/A';
        const d = (date instanceof Date) ? date : new Date(date);
        return d.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Helper to format ISO timestamp with millisecond precision for audit logs.
     */
    _formatExactTimestamp(date) {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(date);
        return d.toISOString().replace('T', ' ').substring(0, 19);
    }

    /**
     * Navigates to a new URL.
     * Transitions current URL to previous, and installs the new URL as current.
     * @param {string} rawUrl - The target URL string
     * @returns {{success: boolean, error: string|null, current: object|null}}
     */
    navigateTo(rawUrl) {
        // Validate URL
        const validation = URLParser.validateURL(rawUrl);
        if (!validation.isValid) {
            return { success: false, error: validation.error, current: this.current };
        }

        const urlObj = validation.urlObj;
        const normalizedUrl = urlObj.href;

        // Check if navigating to the exact same URL
        if (this.current && this.current.url === normalizedUrl) {
            // Update timestamp of current
            const now = new Date();
            this.current.lastUpdated = this._formatTime(now);
            this.current.timestamp = now;
            this._notifyChange();
            return { success: true, error: null, current: this.current, duplicate: true };
        }

        // Shift Current to Previous
        if (this.current) {
            this.previous = { ...this.current };
        }

        // Create new Current record
        const now = new Date();
        const domain = URLParser.extractDomain(urlObj, false);
        const websiteName = URLParser.extractWebsiteName(urlObj);

        this.current = {
            websiteName: websiteName,
            domain: domain,
            url: normalizedUrl,
            lastUpdated: this._formatTime(now),
            timestamp: now
        };

        // Append to history
        this.history.push({ ...this.current });

        // Notify change listeners
        this._notifyChange();

        return { success: true, error: null, current: this.current };
    }

    /**
     * Starts continuous monitoring with setInterval(..., 1000)
     */
    start() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.startTime = Date.now();

        // Immediate first tick
        this._tick();

        // Setup 1000ms recurring interval strictly as required
        this.intervalId = setInterval(() => {
            this._tick();
        }, this.intervalMs);
    }

    /**
     * Stops/Pauses the monitoring interval.
     */
    stop() {
        if (!this.isMonitoring) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isMonitoring = false;
    }

    /**
     * Toggles monitoring between active and paused.
     */
    toggle() {
        if (this.isMonitoring) {
            this.stop();
        } else {
            this.start();
        }
        return this.isMonitoring;
    }

    /**
     * Internal tick executed every 1000 milliseconds.
     */
    _tick() {
        this.tickCount++;

        // Produce formatted console output matching the exact requirement:
        // CURRENT WEBSITE
        // Website Name: ...
        // Domain: ...
        // URL: ...
        //
        // PREVIOUS WEBSITE
        // Website Name: ...
        // Domain: ...
        // URL: ...
        const consoleOutputText = this.getFormattedConsoleString();

        // Print to browser developer console
        console.log(consoleOutputText);

        // Notify all registered tick listeners with current state and formatted string
        const tickData = {
            tickNumber: this.tickCount,
            timestamp: new Date(),
            formattedTime: this._formatTime(new Date()),
            current: this.current,
            previous: this.previous,
            consoleOutput: consoleOutputText
        };

        this.tickListeners.forEach(listener => {
            try {
                listener(tickData);
            } catch (err) {
                console.error('Error in URLTracker tick listener:', err);
            }
        });
    }

    /**
     * Produces the exact console string specified in requirements:
     * CURRENT WEBSITE
     * Website Name: ...
     * Domain: ...
     * URL: ...
     * 
     * PREVIOUS WEBSITE
     * Website Name: ...
     * Domain: ...
     * URL: ...
     */
    getFormattedConsoleString() {
        const curName = this.current ? this.current.websiteName : 'None';
        const curDomain = this.current ? this.current.domain : 'None';
        const curUrl = this.current ? this.current.url : 'None';

        const prevName = this.previous ? this.previous.websiteName : 'None';
        const prevDomain = this.previous ? this.previous.domain : 'None';
        const prevUrl = this.previous ? this.previous.url : 'None';

        return `CURRENT WEBSITE\nWebsite Name: ${curName}\nDomain: ${curDomain}\nURL: ${curUrl}\n\nPREVIOUS WEBSITE\nWebsite Name: ${prevName}\nDomain: ${prevDomain}\nURL: ${prevUrl}`;
    }

    /**
     * Register a listener for each 1-second tick.
     */
    onTick(fn) {
        if (typeof fn === 'function') {
            this.tickListeners.push(fn);
        }
    }

    /**
     * Register a listener for URL navigation/change events.
     */
    onChange(fn) {
        if (typeof fn === 'function') {
            this.changeListeners.push(fn);
        }
    }

    _notifyChange() {
        const data = {
            current: this.current,
            previous: this.previous,
            history: this.history
        };
        this.changeListeners.forEach(listener => {
            try {
                listener(data);
            } catch (err) {
                console.error('Error in URLTracker change listener:', err);
            }
        });
    }

    /**
     * Resets tracker history.
     */
    clearHistory() {
        this.history = [];
        if (this.current) {
            this.history.push({ ...this.current });
        }
    }
}

// Export for module/global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = URLTracker;
}
