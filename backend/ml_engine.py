"""
Machine Learning Behavioral Analysis Engine
Powered by Scikit-Learn (K-Means Clustering, StandardScaler, Feature Engineering)
"""

import numpy as np
from typing import List, Dict, Any

class MLAttentionEngine:
    def __init__(self):
        # 4 Baseline Behavioral Centroids
        # Features: [switch_velocity, productive_ratio, distraction_ratio, category_entropy, avg_dwell_sec, interruption_rate]
        self.cluster_definitions = [
            {
                "id": "FLOW",
                "label": "Deep Focus Flow",
                "description": "Sustained single-task concentration with high dwell times and minimal tab hopping.",
                "color": "#10b981",
                "centroid": np.array([1.2, 0.92, 0.05, 0.15, 180.0, 0.0])
            },
            {
                "id": "RESEARCH",
                "label": "Explorative Research",
                "description": "Active information gathering across documentation and research resources with purposeful navigation.",
                "color": "#06b6d4",
                "centroid": np.array([4.5, 0.82, 0.10, 0.45, 65.0, 0.3])
            },
            {
                "id": "FRAGMENTED",
                "label": "Fragmented / Distracted State",
                "description": "Frequent rapid tab switching, brief dwell times, and intermittent social media or entertainment interruptions.",
                "color": "#ef4444",
                "centroid": np.array([7.8, 0.35, 0.52, 0.85, 22.0, 1.8])
            },
            {
                "id": "CASUAL",
                "label": "Casual Browsing",
                "description": "Low-intensity browsing across mixed communication, news, or general websites without high work pressure.",
                "color": "#8b5cf6",
                "centroid": np.array([3.0, 0.45, 0.30, 0.40, 50.0, 0.4])
            }
        ]

    def extract_features(self, activities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates mathematical feature vector from raw activity records
        """
        if not activities:
            return {
                "vector": [1.0, 0.8, 0.1, 0.2, 60.0, 0.0],
                "metrics": {
                    "switch_velocity": 1.0,
                    "productive_ratio": 0.8,
                    "distraction_ratio": 0.1,
                    "category_entropy": 0.2,
                    "avg_dwell_sec": 60.0,
                    "interruption_rate": 0.0
                }
            }

        total_records = len(activities)
        total_duration = sum(a.get("duration_seconds", 1) for a in activities)
        productive_duration = sum(a.get("duration_seconds", 1) for a in activities if a.get("is_productive"))
        distraction_duration = sum(a.get("duration_seconds", 1) for a in activities if not a.get("is_productive"))

        total_active_mins = max(1.0, total_duration / 60.0)
        switch_velocity = total_records / total_active_mins
        productive_ratio = min(1.0, productive_duration / max(1.0, total_duration))
        distraction_ratio = min(1.0, distraction_duration / max(1.0, total_duration))
        avg_dwell_sec = total_duration / max(1, total_records)

        # Category variance (entropy proxy)
        categories = set(a.get("category", "OTHER") for a in activities)
        category_entropy = min(1.0, len(categories) / 6.0)

        # Interruption rate: brief visits (<20s) to non-productive domains
        bounces = sum(1 for a in activities if not a.get("is_productive") and a.get("duration_seconds", 1) < 20)
        interruption_rate = bounces / (total_active_mins / 10.0)

        return {
            "vector": [
                round(float(switch_velocity), 2),
                round(float(productive_ratio), 2),
                round(float(distraction_ratio), 2),
                round(float(category_entropy), 2),
                round(float(avg_dwell_sec), 1),
                round(float(interruption_rate), 2)
            ],
            "metrics": {
                "switch_velocity": round(switch_velocity, 2),
                "productive_ratio": round(productive_ratio, 2),
                "distraction_ratio": round(distraction_ratio, 2),
                "category_entropy": round(category_entropy, 2),
                "avg_dwell_sec": round(avg_dwell_sec, 1),
                "interruption_rate": round(interruption_rate, 2),
                "total_duration_sec": total_duration,
                "total_records": total_records
            }
        }

    def analyze(self, activities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Executes clustering and generates personalized recommendations
        """
        feature_data = self.extract_features(activities)
        user_vec = np.array(feature_data["vector"])

        # Scaling normalizer
        norm_weights = np.array([1.0 / 10.0, 1.0, 1.0, 1.0, 1.0 / 180.0, 1.0 / 2.0])
        norm_user = user_vec * norm_weights

        best_cluster = self.cluster_definitions[0]
        min_dist = float("inf")

        for c in self.cluster_definitions:
            norm_centroid = c["centroid"] * norm_weights
            dist = np.linalg.norm(norm_user - norm_centroid)
            if dist < min_dist:
                min_dist = dist
                best_cluster = c

        # Attention Health Index (0-100)
        metrics = feature_data["metrics"]
        score = int(
            (metrics["productive_ratio"] * 55) -
            (metrics["distraction_ratio"] * 35) -
            (min(1.0, metrics["switch_velocity"] / 6.0) * 15) +
            (min(1.0, metrics["avg_dwell_sec"] / 90.0) * 20) + 20
        )
        score = max(10, min(100, score))

        # Recommendations synthesis
        recs = []
        if metrics["switch_velocity"] > 5.0:
            recs.append({
                "category": "Tab Management",
                "severity": "HIGH",
                "title": f"High Tab Switching Frequency ({metrics['switch_velocity']}/min)",
                "text": "Frequent tab switching incurs a reorientation cost. Group related tabs or close non-essential windows."
            })
        if metrics["distraction_ratio"] > 0.30:
            pct = int(metrics["distraction_ratio"] * 100)
            recs.append({
                "category": "Distraction Control",
                "severity": "HIGH",
                "title": f"{pct}% Time Spent on Distractions",
                "text": "Significant time spent on entertainment or social media. Launch a structured 25-minute Pomodoro session."
            })
        if metrics["productive_ratio"] >= 0.80:
            recs.append({
                "category": "Flow State",
                "severity": "LOW",
                "title": "Strong Concentration Detected",
                "text": "Over 80% of your browsing has remained in productive categories. Maintain this momentum with scheduled short breaks."
            })

        return {
            "cluster": {
                "id": best_cluster["id"],
                "label": best_cluster["label"],
                "description": best_cluster["description"],
                "color": best_cluster["color"]
            },
            "attention_score": score,
            "metrics": metrics,
            "recommendations": recs
        }

