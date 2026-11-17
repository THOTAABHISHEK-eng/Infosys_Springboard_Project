"""Serves the dashboard and accepts real browsing telemetry from the Chrome extension.

Open http://127.0.0.1:5500/ after starting this file.
Type sync() in the Chrome Extension Service Worker console to analyze real browsing history.
"""

import json
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 5500
STATE_FILE = ROOT / "activity_state.json"
HISTORY_FILE = ROOT / "activity_history.json"
ACTIVITY_DATA_FILE = ROOT / "activity_data.json"
RESET_FLAG = ROOT / "activity_reset.flag"

CATEGORY_CLASSIFICATION = {
    "youtube.com": ("Entertainment", False),
    "netflix.com": ("Entertainment", False),
    "spotify.com": ("Entertainment", False),
    "primevideo.com": ("Entertainment", False),
    "instagram.com": ("Social Media", False),
    "facebook.com": ("Social Media", False),
    "reddit.com": ("Social Media", False),
    "twitter.com": ("Social Media", False),
    "x.com": ("Social Media", False),
    "github.com": ("Development", True),
    "stackoverflow.com": ("Development", True),
    "chatgpt.com": ("Learning", True),
    "claude.ai": ("Learning", True),
    "meet.google.com": ("Communication", True),
    "zoom.us": ("Communication", True),
    "web.whatsapp.com": ("Communication", False),
    "mail.google.com": ("Professional", True),
}


def guess_category(domain, name=""):
    d = (domain or "").lower()
    for key, (cat, _) in CATEGORY_CLASSIFICATION.items():
        if key in d:
            return cat
    if any(k in d for k in ["docs", "learn", "course", "edu", "wiki"]):
        return "Learning"
    if any(k in d for k in ["shop", "amazon", "flipkart", "ebay", "cart"]):
        return "Shopping"
    if any(k in d for k in ["news", "bbc", "cnn", "techcrunch"]):
        return "News"
    return "Utilities"


def compute_focus_analysis(data):
    """
    Computes transparent Focus Score, Deduction Breakdown, Analysis, and Recommendations
    matching the team specification and meeting guidance.
    """
    switches = data.get("totalTabSwitches") or data.get("switches") or 0
    site_usage = data.get("siteUsage") or {}
    total_idle_sec = data.get("totalIdleSec") or data.get("idleSeconds") or 0

    total_active_sec = sum(
        s.get("totalSec") or s.get("totalSeconds") or 0
        for s in site_usage.values()
    )
    total_time_sec = max(1, total_active_sec + total_idle_sec)
    idle_ratio = (total_idle_sec / total_time_sec) * 100

    # 1. Deduction: Tab switching (0 to 20 pts)
    if switches > 50:
        tab_deduction = 20
    elif switches > 25:
        tab_deduction = 15
    elif switches > 10:
        tab_deduction = 10
    elif switches > 5:
        tab_deduction = 5
    else:
        tab_deduction = 0

    # 2. Deduction: Category usage (0 to 30 pts)
    distraction_sec = 0
    top_distraction_site = None
    max_distract_sec = 0

    for domain, s in site_usage.items():
        cat = s.get("category") or guess_category(domain, s.get("name", ""))
        sec = s.get("totalSec") or s.get("totalSeconds") or 0
        cat_lower = cat.lower()
        if any(d in cat_lower for d in ["entertain", "social", "shop"]):
            distraction_sec += sec
            if sec > max_distract_sec:
                max_distract_sec = sec
                top_distraction_site = s.get("name") or domain

    distract_ratio = distraction_sec / max(1, total_active_sec) if total_active_sec > 0 else 0
    category_deduction = min(30, round(distract_ratio * 35))

    # 3. Deduction: Idle time (0 to 20 pts)
    if idle_ratio >= 35:
        idle_deduction = 20
    elif idle_ratio >= 20:
        idle_deduction = 15
    elif idle_ratio >= 10:
        idle_deduction = 10
    elif idle_ratio >= 5:
        idle_deduction = 5
    else:
        idle_deduction = 0

    # 4. Deduction: Focus sessions / dwell depth (0 to 20 pts)
    avg_dwell = total_active_sec / max(1, switches + 1)
    if avg_dwell < 30:
        focus_session_deduction = 20
    elif avg_dwell < 60:
        focus_session_deduction = 15
    elif avg_dwell < 120:
        focus_session_deduction = 10
    else:
        focus_session_deduction = 0

    deductions = {
        "tab_switching": tab_deduction,
        "category_usage": category_deduction,
        "idle_time": idle_deduction,
        "focus_sessions": focus_session_deduction,
    }

    total_deductions = tab_deduction + category_deduction + idle_deduction + focus_session_deduction
    focus_score = max(10, min(100, 100 - total_deductions))

    # Classification
    if focus_score >= 85:
        classification = "Excellent"
    elif focus_score >= 70:
        classification = "Good"
    elif focus_score >= 50:
        classification = "Average"
    else:
        classification = "Poor"

    total_tabs = len(site_usage) if site_usage else 1
    session_type = (
        f"Multi-Tab Session ({total_tabs} tabs)"
        if total_tabs > 10 or switches > 20
        else f"Focused Session ({total_tabs} tabs)"
    )

    # Narrative Analysis
    reasons = []
    if tab_deduction > 0:
        reasons.append(f"heavy tab switching (-{tab_deduction} points)")
    if category_deduction > 0:
        reasons.append(f"distraction category usage (-{category_deduction} points)")
    if idle_deduction > 0:
        reasons.append(f"significant idle time (-{idle_deduction} points)")
    if focus_session_deduction > 0:
        reasons.append(f"a lack of tracked focus sessions (-{focus_session_deduction} points)")

    if reasons:
        analysis = f"The user's focus score decreased due to {', '.join(reasons)}."
        if top_distraction_site:
            mins = round(max_distract_sec / 60)
            analysis += (
                f" Distractions were primarily driven by browsing on {top_distraction_site}"
                f"{f' ({mins}m)' if mins > 0 else ''}, which accounted for the bulk of non-productive duration."
            )
    else:
        analysis = (
            "The user maintained optimal focus with zero deductions across all monitored metrics. "
            "Browsing was disciplined with strong dwell times and minimal cognitive reorientation."
        )

    # Recommendations: ALWAYS GIVEN IRRESPECTIVE OF FOCUS SCORE, BUT VARIED
    recs = []
    if focus_session_deduction > 0:
        recs.append("Integrate a Pomodoro focus timer into your routine to structure work intervals and properly log focus sessions.")
    if tab_deduction > 0:
        recs.append("Minimize frequent tab switching by closing unrelated tabs and focusing on a single task at a time.")
    if idle_deduction > 0:
        recs.append("Reduce idle time by setting clear session goals and taking designated breaks rather than drifting between tabs.")
    if category_deduction > 0 and top_distraction_site:
        recs.append(f"Limit visits to entertainment sites like {top_distraction_site} during active work periods to maintain continuous concentration.")

    if len(recs) < 4:
        if focus_score >= 80:
            recs.append("Protect your high flow state by pre-scheduling dedicated 45-minute deep work intervals.")
            recs.append("Take structured 5-minute cognitive rest breaks between major research milestones.")
            recs.append("Consolidate open tabs into browser tab groups at the end of each session to prevent cognitive clutter.")
            recs.append("Mute non-critical instant messaging notifications during peak concentration periods.")
        else:
            recs.append("Group tabs by task using Chrome Tab Groups to maintain clear mental boundaries.")
            recs.append("Keep a single primary application in the foreground and minimize background distractions.")

    return {
        "focus_score": focus_score,
        "classification": classification,
        "deduction_breakdown": deductions,
        "session_type": session_type,
        "real_tab_switches": switches,
        "in_tab_idle_ratio": f"{idle_ratio:.2f}%",
        "analysis": analysis,
        "recommendations": recs[:4],
        "top_distraction_site": top_distraction_site or "None",
    }


def empty_state():
    today = datetime.now().strftime("%Y-%m-%d")
    return {
        "date": today,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "current": None,
        "previous": None,
        "summary": {
            "totalActiveSeconds": 0,
            "totalActiveFormatted": "0s",
            "totalSwitches": 0,
            "distinctAppsCount": 0,
            "mostUsedApp": None,
        },
        "appUsage": [],
        "timeline": [],
    }


def apply_reset():
    RESET_FLAG.write_text("reset", encoding="utf-8")
    STATE_FILE.write_text(json.dumps(empty_state(), indent=2), encoding="utf-8")
    history = {}
    if HISTORY_FILE.exists():
        try:
            loaded = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                history = loaded
        except json.JSONDecodeError:
            history = {}
    history.pop(datetime.now().strftime("%Y-%m-%d"), None)
    HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length") or 0)
        body_bytes = self.rfile.read(length) if length else b"{}"

        if path == "/local/reset":
            apply_reset()
            resp = json.dumps({"status": "reset"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        if path == "/api/sync":
            try:
                payload = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                payload = {}

            # Analyze payload
            analysis_result = compute_focus_analysis(payload)

            # Save full record to activity_data.json
            save_record = {
                "received_at": datetime.now().isoformat(),
                "telemetry": payload,
                "analysis": analysis_result,
            }
            ACTIVITY_DATA_FILE.write_text(json.dumps(save_record, indent=2), encoding="utf-8")

            # Print exact formatted block to console matching meeting specifications
            print("\n========================================================================")
            print("[SYNC SUCCESS] RECEIVED REAL BROWSING HISTORY FROM CHROME")
            print("========================================================================")
            print(f"Focus Score:         {analysis_result['focus_score']} / 100")
            print(f"Classification:      {analysis_result['classification']}")
            print(f"Deduction Breakdown: {analysis_result['deduction_breakdown']}")
            print(f"Session Type:        {analysis_result['session_type']}")
            print(f"Real Tab Switches:   {analysis_result['real_tab_switches']}")
            print(f"In-Tab Idle Ratio:   {analysis_result['in_tab_idle_ratio']}")
            print("\nAnalysis:")
            print(analysis_result["analysis"])
            print("\nRecommendations:")
            for i, rec in enumerate(analysis_result["recommendations"], 1):
                print(f"{i}. {rec}")
            print("Saved to activity_data.json. Waiting for next sync from browser...\n")

            resp = json.dumps({"status": "success", "result": analysis_result}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        self.send_error(404)

    def log_message(self, fmt, *args):
        # Silence standard HTTP access logging to keep terminal focused on sync events
        pass


def main():
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    print("========================================================================")
    print("SYSTEM-WIDE APPLICATION & BROWSER USAGE TRACKER")
    print(f"Dashboard running on: http://{HOST}:{PORT}/")
    print("========================================================================")
    print("Instructions:")
    print("1. Browse normally in Google Chrome with the extension loaded.")
    print("2. In Chrome DevTools (Service worker console), type: sync()")
    print("3. Your REAL browser history is received and analyzed instantly!")
    print("Press Ctrl+C to stop the server.")
    print("========================================================================\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDashboard server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
