/**
 * Focus Session & Pomodoro Management Engine
 * 
 * Manages:
 * - Active focus sessions & countdown timer
 * - Study/work goals
 * - Interruption logging & focus score computation
 * - Break reminders
 * - Daily goal progress tracking
 */

class FocusManager {
    constructor() {
        this.activeSession = null;
        this.timerInterval = null;
        this.sessionHistory = [];
        this.dailyGoalMinutes = AttentionConfig.FOCUS_DEFAULTS.DAILY_TARGET_MINUTES;
        this.listeners = {
            tick: [],
            sessionComplete: [],
            sessionStart: [],
            sessionInterrupted: []
        };

        this._loadHistory();
    }

    _loadHistory() {
        try {
            const saved = localStorage.getItem("attention_focus_history_v2");
            if (saved) {
                this.sessionHistory = JSON.parse(saved);
            }
            const savedGoal = localStorage.getItem("attention_daily_goal_minutes");
            if (savedGoal) {
                this.dailyGoalMinutes = parseInt(savedGoal, 10) || 180;
            }
        } catch (e) {
            console.warn("Could not load focus history from localStorage", e);
        }
    }

    _saveHistory() {
        try {
            localStorage.setItem("attention_focus_history_v2", JSON.stringify(this.sessionHistory));
            localStorage.setItem("attention_daily_goal_minutes", this.dailyGoalMinutes.toString());
        } catch (e) {
            console.warn("Could not save focus history", e);
        }
    }

    /**
     * Start a new focus session
     */
    startSession(goal = "Deep Study Block", durationMinutes = 25) {
        if (this.activeSession) {
            this.stopSession(false);
        }

        const totalSeconds = durationMinutes * 60;
        this.activeSession = {
            id: "focus_" + Date.now(),
            goal: goal || "Deep Work",
            targetDurationMinutes: durationMinutes,
            totalSeconds: totalSeconds,
            remainingSeconds: totalSeconds,
            elapsedSeconds: 0,
            startTime: Date.now(),
            interruptions: 0,
            interruptionLog: [],
            focusScore: 100,
            isPaused: false,
            status: "IN_PROGRESS"
        };

        this._startTimer();
        this._notify("sessionStart", this.activeSession);
        return this.activeSession;
    }

    _startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (!this.activeSession || this.activeSession.isPaused) return;

            this.activeSession.remainingSeconds--;
            this.activeSession.elapsedSeconds++;

            // Check completion
            if (this.activeSession.remainingSeconds <= 0) {
                this.completeSession();
                return;
            }

            this._notify("tick", this.activeSession);
        }, 1000);
    }

    pauseSession() {
        if (this.activeSession) {
            this.activeSession.isPaused = !this.activeSession.isPaused;
            this._notify("tick", this.activeSession);
        }
    }

    recordInterruption(domain = "Distracting Site") {
        if (!this.activeSession) return;

        this.activeSession.interruptions++;
        this.activeSession.interruptionLog.push({
            domain: domain,
            timestamp: Date.now()
        });

        // Deduct 10 points per interruption (min score 20%)
        this.activeSession.focusScore = Math.max(20, 100 - (this.activeSession.interruptions * 10));
        this._notify("sessionInterrupted", { session: this.activeSession, domain: domain });
    }

    completeSession() {
        if (!this.activeSession) return;

        clearInterval(this.timerInterval);
        this.activeSession.status = "COMPLETED";
        this.activeSession.endTime = Date.now();

        const sessionRecord = { ...this.activeSession };
        this.sessionHistory.unshift(sessionRecord);
        this._saveHistory();

        this._notify("sessionComplete", sessionRecord);
        this.activeSession = null;
    }

    stopSession(saveAsInterrupted = true) {
        if (!this.activeSession) return;

        clearInterval(this.timerInterval);

        if (saveAsInterrupted && this.activeSession.elapsedSeconds >= 60) {
            this.activeSession.status = "INTERRUPTED";
            this.activeSession.endTime = Date.now();
            this.sessionHistory.unshift({ ...this.activeSession });
            this._saveHistory();
        }

        this.activeSession = null;
        this._notify("tick", null);
    }

    isSessionActive() {
        return !!this.activeSession && this.activeSession.status === "IN_PROGRESS";
    }

    getCurrentGoal() {
        return this.activeSession ? this.activeSession.goal : "";
    }

    getActiveSession() {
        return this.activeSession;
    }

    getHistory() {
        return [...this.sessionHistory];
    }

    setDailyGoalMinutes(mins) {
        this.dailyGoalMinutes = Math.max(15, parseInt(mins, 10) || 180);
        this._saveHistory();
    }

    getTodayFocusMinutes() {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayMs = startOfToday.getTime();

        const completedToday = this.sessionHistory.filter(s => s.startTime >= todayMs);
        const totalSeconds = completedToday.reduce((acc, s) => acc + (s.elapsedSeconds || 0), 0);
        return Math.round(totalSeconds / 60);
    }

    on(event, cb) {
        if (this.listeners[event]) {
            this.listeners[event].push(cb);
        }
    }

    _notify(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => {
                try { cb(data); } catch (e) { console.error(`Error in FocusManager ${event} listener:`, e); }
            });
        }
    }
}

// Export for module/browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = FocusManager;
}

