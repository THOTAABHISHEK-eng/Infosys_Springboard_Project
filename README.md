# AI-Powered Digital Attention Management System
### Distraction Detection and Focus Enhancement | Milestone 1 Deliverable
**Infosys Springboard Virtual Internship 7.0 (November 2026)**  
**Author:** Thota Abhishek | **Branch:** `ThotaAbhishek_milestone1`

---

## Quick Overview

A dual-layer telemetry system that monitors, classifies, and visualizes digital attention across Windows desktop applications and web browsing activity in real time. It identifies context switching, detects distractions, and provides actionable focus analytics.

```
+---------------------------+       +---------------------------+
|    Desktop Apps (Win32)   |       |   Browser Tabs (Chrome)   |
|     tracker-daemon.ps1    |       |    Manifest V3 Extension  |
+-------------+-------------+       +-------------+-------------+
              |                                   |
              +-----------------+-----------------+
                                |
                                v
               +---------------------------------+
               |  Unified Intelligence Dashboard |
               |     http://127.0.0.1:5500/      |
               +----------------+----------------+
                                |
                                v
               +---------------------------------+
               |   FastAPI & ML Attention Engine |
               +---------------------------------+
```

---

## Key Features (Milestone 1)

- **System-Wide Desktop Tracking**: Native Win32 background daemon (`tracker-daemon.ps1`) tracking active process titles, session dwell time, and user idle states without high CPU overhead.
- **Browser Activity Extension**: Chrome Manifest V3 extension measuring per-tab dwell time, tab switches, and cumulative session durations.
- **9-Category Unified Taxonomy**: Auto-classifies apps and sites into *Development*, *Learning*, *Professional*, *Communication*, *Entertainment*, *Social Media*, *News*, *Shopping*, and *Utilities*.
- **Live Unified Dashboard**: Dark-mode Pro analytics UI at `http://127.0.0.1:5500/` synchronizing desktop and browser telemetry via real-time content bridge.
- **Attention Scoring & ML Backend**: FastAPI service with SQLite database and scikit-learn models evaluating focus scores and distraction clusters.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Desktop Tracking** | PowerShell, Windows Win32 API (`user32.dll`) |
| **Browser Extension** | Chrome Extensions API (Manifest V3), JavaScript |
| **Frontend Dashboard** | HTML5, CSS3, JavaScript (ES6+), Chart.js |
| **Backend & ML** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, SQLite, Scikit-learn |

---

## Quick Start in 2 Minutes

### 1. Launch the System
Double-click **`start.bat`** in the project folder (or run in terminal):
```powershell
.\start.bat
```
This automatically starts the Win32 tracker daemon, launches the local dashboard server, and opens `http://127.0.0.1:5500/` in your browser.

### 2. Load the Chrome Extension
1. Open Chrome and go to `chrome://extensions`.
2. Toggle on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Pin the extension to track active browser tabs and dwell times.

---

## Project Structure

```
├── backend/               # FastAPI server, ML attention engine, models & schemas
├── css/                   # Pro Intelligence dashboard dark-theme styles
├── extension/             # Chrome Manifest V3 extension (background worker & popup)
├── js/                    # Dashboard UI logic, telemetry bridge & classification
├── tests/                 # Automated test suite for attention engine (pytest)
├── activity_history.json  # Aggregated historical records
├── activity_state.json    # Live tracking state buffer
├── index.html             # Usage analytics web dashboard
├── server.py              # Lightweight local HTTP server (port 5500)
├── start.bat              # One-click launcher script
└── tracker-daemon.ps1     # Win32 desktop activity tracking daemon
```

---

## Verification & Tests

```bash
# Run backend test suite
pytest tests/test_attention.py -v

# Validate JavaScript syntax
node -c js/app.js
node -c extension/background.js
node -c extension/popup.js
```

---

## Milestone 1 Submission Checklist

- [x] Win32 desktop application tracking with idle detection
- [x] Chrome extension tab dwell timing with session duration preservation
- [x] Automated 9-category attention taxonomy
- [x] Real-time content bridge linking extension data to local dashboard
- [x] Pushed to designated branch: `ThotaAbhishek_milestone1`
