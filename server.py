"""Serves the dashboard and accepts a same-machine session reset.

Open http://127.0.0.1:5500/ after starting this file. Fetching the JSON
state from a file:// page is blocked by the browser.
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
RESET_FLAG = ROOT / "activity_reset.flag"


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
        super().end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/local/reset":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)
        apply_reset()
        body = json.dumps({"status": "reset"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Silence all HTTP request logging so no console spam is generated
        pass


def main():
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    print(f"Dashboard: http://{HOST}:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDashboard server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
