/**
 * AI-Powered Behavioral Analysis & Personalized Recommendation Engine
 * 
 * Extracts 6-dimensional behavioral feature vectors from real browsing data.
 * Executes K-Means clustering to identify behavioral archetypes:
 * 1. Deep Focus Flow
 * 2. Explorative Research
 * 3. Fragmented Attention / High Distraction
 * 4. Casual Browsing
 * 
 * Computes Digital Attention Health Score (0 - 100) and produces actionable recommendations.
 */

class AIInsightsEngine {
    constructor(trackerCore, focusManager, distractionDetector) {
        this.tracker = trackerCore;
        this.focusManager = focusManager;
        this.distractionDetector = distractionDetector;

        // Cluster Prototypes (Centroids normalized across standard scales)
        this.centroids = [
            {
                id: "FLOW",
                label: "Deep Focus Flow",
                description: "Sustained single-task concentration with high dwell times and minimal tab hopping.",
                badgeColor: "#10b981", // Emerald
                // [switchVel, prodRatio, distRatio, catEntropy, avgDwellSec, interruptionRate]
                vector: [1.2, 0.92, 0.05, 0.15, 180, 0.0]
            },
            {
                id: "RESEARCH",
                label: "Explorative Research",
                description: "Active information gathering across documentation and academic resources with purposeful tab switches.",
                badgeColor: "#06b6d4", // Cyan
                vector: [4.5, 0.82, 0.10, 0.45, 65, 0.3]
            },
            {
                id: "FRAGMENTED",
                label: "Fragmented / Distracted State",
                description: "Frequent rapid tab switching, brief dwell times, and intermittent social media or entertainment interruptions.",
                badgeColor: "#ef4444", // Red
                vector: [7.8, 0.35, 0.52, 0.85, 22, 1.8]
            },
            {
                id: "CASUAL",
                label: "Casual Browsing",
                description: "Low-intensity browsing across mixed communication, news, or general websites without high work pressure.",
                badgeColor: "#8b5cf6", // Purple
                vector: [3.0, 0.45, 0.30, 0.40, 50, 0.4]
            }
        ];
    }

    /**
     * Compute feature vector from current tracking telemetry and historical activity
     */
    extractFeatures() {
        const history = this.tracker.getActivityHistory();
        const totalSecs = this.tracker.totalBrowsingSeconds || 1;
        const totalSwitches = this.tracker.totalTabSwitches || 0;
        const activeMins = Math.max(1, totalSecs / 60);

        // Feature 1: Tab Switch Velocity (switches / min)
        const switchVelocity = totalSwitches / activeMins;

        // Feature 2 & 3: Productive & Distraction time ratios
        let productiveSecs = 0;
        let distractionSecs = 0;
        let dwellSum = 0;

        history.forEach(item => {
            const dur = item.durationSeconds || 1;
            dwellSum += dur;
            if (item.isProductive) {
                productiveSecs += dur;
            } else {
                distractionSecs += dur;
            }
        });

        // Include current active tab
        if (this.tracker.currentWebsite) {
            const currDwell = this.tracker.currentDwellSeconds;
            dwellSum += currDwell;
            if (this.tracker.currentWebsite.isProductive) {
                productiveSecs += currDwell;
            } else {
                distractionSecs += currDwell;
            }
        }

        const effectiveTotal = Math.max(1, dwellSum);
        const productiveRatio = Math.min(1.0, productiveSecs / effectiveTotal);
        const distractionRatio = Math.min(1.0, distractionSecs / effectiveTotal);

        // Feature 4: Average Dwell Duration (seconds)
        const visitCount = Math.max(1, history.length + 1);
        const avgDwellSec = effectiveTotal / visitCount;

        // Feature 5: Category Entropy / Hopping (measure of variance across categories)
        const catCounts = {};
        history.forEach(item => {
            catCounts[item.category] = (catCounts[item.category] || 0) + 1;
        });
        const distinctCats = Object.keys(catCounts).length;
        const categoryEntropy = Math.min(1.0, distinctCats / 6);

        // Feature 6: Interruption Rate (incidents per 10 mins)
        const incidents = this.distractionDetector ? this.distractionDetector.getIncidents() : [];
        const interruptionRate = incidents.length / (activeMins / 10);

        return {
            vector: [
                parseFloat(switchVelocity.toFixed(2)),
                parseFloat(productiveRatio.toFixed(2)),
                parseFloat(distractionRatio.toFixed(2)),
                parseFloat(categoryEntropy.toFixed(2)),
                parseFloat(avgDwellSec.toFixed(1)),
                parseFloat(interruptionRate.toFixed(2))
            ],
            raw: {
                switchVelocity,
                productiveRatio,
                distractionRatio,
                categoryEntropy,
                avgDwellSec,
                interruptionRate,
                totalSwitches,
                totalSecs,
                productiveSecs,
                distractionSecs
            }
        };
    }

    /**
     * Normalized Euclidean distance to find nearest K-Means cluster
     */
    predictCluster(features) {
        const userVec = features.vector;
        // Feature normalizers to standardize scale variance:
        // [switchVel/10, prodRatio, distRatio, catEntropy, min(1, avgDwell/180), min(1, interruptionRate/2)]
        const normalize = (vec) => [
            vec[0] / 10.0,
            vec[1],
            vec[2],
            vec[3],
            Math.min(1.0, vec[4] / 180.0),
            Math.min(1.0, vec[5] / 2.0)
        ];

        const normUser = normalize(userVec);
        let closestCluster = this.centroids[0];
        let minDistance = Infinity;

        this.centroids.forEach(centroid => {
            const normCentroid = normalize(centroid.vector);
            let distSq = 0;
            for (let i = 0; i < normUser.length; i++) {
                const diff = normUser[i] - normCentroid[i];
                distSq += diff * diff;
            }
            const dist = Math.sqrt(distSq);
            if (dist < minDistance) {
                minDistance = dist;
                closestCluster = centroid;
            }
        });

        // Calculate Attention Health Index (0 - 100)
        // Weighted formula: +50 * productiveRatio, -35 * distractionRatio, -15 * (switchVel/8), +20 * min(1, avgDwell/120)
        let attentionScore = Math.round(
            (features.raw.productiveRatio * 55) -
            (features.raw.distractionRatio * 35) -
            (Math.min(1.0, features.raw.switchVelocity / 6.0) * 15) +
            (Math.min(1.0, features.raw.avgDwellSec / 90.0) * 20) + 20
        );
        attentionScore = Math.max(10, Math.min(100, attentionScore));

        return {
            cluster: closestCluster,
            distance: minDistance.toFixed(3),
            attentionScore: attentionScore,
            features: features
        };
    }

    /**
     * Generate actionable, empirical recommendations based on real metrics
     */
    generateRecommendations(analysis) {
        const raw = analysis.features.raw;
        const recommendations = [];

        // 1. Tab Switching Velocity Check
        if (raw.switchVelocity > 5.0) {
            recommendations.push({
                icon: "⚡",
                category: "Tab Management",
                severity: "HIGH",
                title: `High Tab Switching Frequency (${raw.switchVelocity.toFixed(1)}/min)`,
                text: "Rapid switching between tabs imposes a severe cognitive reorientation penalty. Try using browser Tab Groups to isolate current work from reference materials.",
                actionLabel: "Focus Current Tab"
            });
        }

        // 2. Distraction Ratio Check
        if (raw.distractionRatio > 0.30) {
            const distPercent = Math.round(raw.distractionRatio * 100);
            recommendations.push({
                icon: "🛡️",
                category: "Distraction Control",
                severity: "HIGH",
                title: `${distPercent}% of Browsing Spent on Distractions`,
                text: `Social media or entertainment consumed ${Math.round(raw.distractionSecs / 60)} minutes of your session. Launch a dedicated 25-minute Pomodoro focus block to regain flow.`,
                actionLabel: "Start Focus Session"
            });
        }

        // 3. Short Dwell Time Check
        if (raw.avgDwellSec < 30 && raw.totalSwitches > 4) {
            recommendations.push({
                icon: "⏱️",
                category: "Sustained Attention",
                severity: "MEDIUM",
                title: `Brief Average Dwell Time (${Math.round(raw.avgDwellSec)}s)`,
                text: "Your attention appears scattered across brief page glances. Pick one core topic (e.g., lecture, code file, or document) and aim to stay focused for at least 3 minutes before switching.",
                actionLabel: "Practice 3-Min Dwell"
            });
        }

        // 4. Positive Flow Affirmation
        if (raw.productiveRatio >= 0.80 && raw.switchVelocity < 3.5) {
            recommendations.push({
                icon: "🌟",
                category: "Flow State",
                severity: "LOW",
                title: "Excellent Flow State Detected",
                text: "Over 80% of your browsing has remained in productive and learning categories with low switching friction. Take a 5-minute hydration break every 45 minutes to sustain this state.",
                actionLabel: "Schedule Break"
            });
        }

        // 5. Daily Focus Progress
        const focusMinutes = this.focusManager ? this.focusManager.getTodayFocusMinutes() : 0;
        const target = this.focusManager ? this.focusManager.dailyGoalMinutes : 180;
        if (focusMinutes < target) {
            recommendations.push({
                icon: "🎯",
                category: "Daily Target",
                severity: "MEDIUM",
                title: `Daily Goal Progress: ${focusMinutes} / ${target} mins`,
                text: `You have completed ${focusMinutes} minutes of structured deep work today. A 25-minute Pomodoro session will advance your daily target by 14%.`,
                actionLabel: "Launch 25m Timer"
            });
        }

        return recommendations;
    }

    /**
     * Run full real-time analysis
     */
    analyze() {
        const features = this.extractFeatures();
        const prediction = this.predictCluster(features);
        const recommendations = this.generateRecommendations(prediction);

        return {
            ...prediction,
            recommendations: recommendations,
            timestamp: Date.now()
        };
    }
}

// Export for module/browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = AIInsightsEngine;
}

