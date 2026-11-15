/**
 * Rule-Based & Statistical Distraction Detection Engine
 * 
 * Identifies:
 * 1. Rapid tab-switching velocity (fragmented attention)
 * 2. Frequent interruptions & short bounces (<20s away from focus)
 * 3. Prolonged social media / entertainment dwell
 * 4. Focus session goal violations
 * 5. Erratic cross-category hopping
 */

class DistractionDetector {
    constructor(trackerCore, focusManager) {
        this.tracker = trackerCore;
        this.focusManager = focusManager;
        this.incidents = [];
        this.listeners = [];

        // State trackers
        this.consecutiveDistractionSeconds = 0;
        this.lastProductiveSite = null;
        this.categoryHistory = [];

        this._initListeners();
    }

    _initListeners() {
        if (!this.tracker) return;

        // Listen for transitions
        this.tracker.on("transition", (data) => {
            this._evaluateTransition(data);
        });

        // Listen for 1-second ticks
        this.tracker.on("tick", (data) => {
            this._evaluateTick(data);
        });
    }

    _evaluateTransition(data) {
        const current = data.currentWebsite;
        const previous = data.previousWebsite;
        const now = Date.now();

        if (!current) return;

        // Keep track of category trail (last 6 transitions)
        this.categoryHistory.push({ category: current.category, timestamp: now });
        if (this.categoryHistory.length > 8) {
            this.categoryHistory.shift();
        }

        // Rule 1: Focus Session Violation
        if (this.focusManager && this.focusManager.isSessionActive()) {
            if (!current.isProductive) {
                this._recordIncident({
                    type: "FOCUS_SESSION_VIOLATION",
                    severity: "HIGH",
                    title: "Focus Session Interrupted",
                    description: `Navigated to distracting site (${current.websiteName}) during active focus session "${this.focusManager.getCurrentGoal()}".`,
                    domain: current.domain,
                    action: "Return to your active focus task to maintain your flow state score."
                });

                if (this.focusManager.recordInterruption) {
                    this.focusManager.recordInterruption(current.domain);
                }
            }
        }

        // Rule 2: Short Attention Bounce / Interruption
        // If previous site was productive, but current site is distracting and previous dwell was short (<20s)
        if (previous && previous.isProductive && !current.isProductive) {
            this.lastProductiveSite = previous;
        } else if (previous && !previous.isProductive && this.lastProductiveSite) {
            if (previous.durationSeconds < AttentionConfig.THRESHOLDS.RAPID_BOUNCE_SEC) {
                this._recordIncident({
                    type: "RAPID_BOUNCE",
                    severity: "MEDIUM",
                    title: "Quick Distraction Bounce",
                    description: `Quickly bounced to ${previous.websiteName} for ${previous.durationSeconds}s before switching away from ${this.lastProductiveSite.websiteName}.`,
                    domain: previous.domain,
                    action: "Notice impulse checking: try waiting 30 seconds before acting on the urge to check other tabs."
                });
            }
        }

        // Rule 3: Category Hopping (Context fragmentation)
        const recent3Min = now - 180000;
        const recentCategories = this.categoryHistory.filter(c => c.timestamp >= recent3Min);
        const uniqueCategories = new Set(recentCategories.map(c => c.category));

        if (uniqueCategories.size >= AttentionConfig.THRESHOLDS.CATEGORY_HOP_MAX_IN_3MIN) {
            this._recordIncident({
                type: "CATEGORY_HOPPING",
                severity: "MEDIUM",
                title: "Rapid Context Switching",
                description: `Shifted between ${uniqueCategories.size} unrelated website categories in under 3 minutes. High cognitive switching penalty.`,
                domain: current.domain,
                action: "Group similar tasks together. Finish your current goal before starting a different activity."
            });
            // Clear to prevent spamming
            this.categoryHistory = [];
        }

        // Reset consecutive distraction seconds when returning to productive sites
        if (current.isProductive) {
            this.consecutiveDistractionSeconds = 0;
        }
    }

    _evaluateTick(data) {
        const current = data.currentWebsite;

        // Rule 4: Excessive Tab Switching Velocity
        if (data.switchVelocity >= 5.0 && data.tickCount % 20 === 0) {
            this._recordIncident({
                type: "EXCESSIVE_TAB_SWITCHING",
                severity: data.switchVelocity > 7.0 ? "HIGH" : "MEDIUM",
                title: "High Tab Switching Velocity",
                description: `Tab switching frequency is currently ${data.switchVelocity} switches/min (Normal: 1-2).`,
                domain: current ? current.domain : "browser",
                action: "Close non-essential tabs and focus on a single primary active window."
            });
        }

        // Rule 5: Prolonged Consecutive Distraction
        if (current && !current.isProductive && data.isWindowFocused) {
            this.consecutiveDistractionSeconds++;

            if (this.consecutiveDistractionSeconds === AttentionConfig.THRESHOLDS.MAX_CONSECUTIVE_DISTRACTION_SEC) {
                this._recordIncident({
                    type: "PROLONGED_DISTRACTION",
                    severity: "HIGH",
                    title: "Extended Distraction Time",
                    description: `Spent 10 continuous minutes on ${current.websiteName} (${current.category}).`,
                    domain: current.domain,
                    action: "Step away for a 2-minute physical stretch or launch a structured Pomodoro block."
                });
            }
        }
    }

    _recordIncident(incident) {
        const fullIncident = {
            id: "dist_" + Date.now() + "_" + Math.floor(Math.random() * 100),
            timestamp: Date.now(),
            formattedTime: new Date().toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            ...incident
        };

        this.incidents.unshift(fullIncident); // Newest first

        // Keep last 50 incidents in memory
        if (this.incidents.length > 50) {
            this.incidents.pop();
        }

        this._notify(fullIncident);
    }

    onDistraction(callback) {
        this.listeners.push(callback);
    }

    _notify(incident) {
        this.listeners.forEach(cb => {
            try {
                cb(incident);
            } catch (e) {
                console.error("Error in distraction listener:", e);
            }
        });
    }

    getIncidents() {
        return [...this.incidents];
    }

    clearIncidents() {
        this.incidents = [];
    }
}

// Export for module/browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = DistractionDetector;
}

