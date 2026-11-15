# AI-Powered Digital Attention Management System for Distraction Detection and Focus Enhancement

**Infosys Springboard Virtual Internship 7.0 (November 2026)**  
**Milestone 1 Deliverable**  
**Author:** Thota Abhishek  

---

## 1. Project Overview

Modern digital work environments present constant distractions, rapid context switching, and fragmented attention spans. The **AI-Powered Digital Attention Management System** is designed to quantify, analyze, and optimize digital productivity by providing granular, multi-layered telemetry across desktop applications and web browsing sessions.

In **Milestone 1**, the primary focus is establishing robust, multi-source telemetry collection, real-time behavioral classification, persistent multi-day data aggregation, and an interactive intelligence dashboard.

```
+-----------------------------------------------------------------------+
|                            USER WORKSPACE                             |
+-----------------------------------+-----------------------------------+
|      Windows Desktop Apps         |          Browser Activity         |
|  (VS Code, Terminals, Office)     |     (Chrome, Brave, Edge Tabs)    |
+-----------------------------------+-----------------------------------+
                  |                                   |
                  v                                   v
+-----------------------------------+   +-------------------------------+
|  Windows Win32 Tracking Daemon    |   | Chrome Extension (Manifest V3)|
|       (tracker-daemon.ps1)        |   | (background.js & popup.js)    |
+-----------------------------------+   +-------------------------------+
                  |                                   |
                  v                                   v
        [activity_state.json]               [chrome.storage.local]
        [activity_history.json]                       |
                  |                                   v
                  |                     +-------------------------------+
                  |                     |  Content Bridge Script        |
                  |                     |  (content_bridge.js)          |
                  |                     +-------------------------------+
                  +-----------------+                 |
                                    |                 |
                                    v                 v
                  +-----------------------------------------------------+
                  |           Unified Intelligence Dashboard            |
                  |             (index.html & js/app.js)                |
                  |                 http://127.0.0.1:5500/              |
                  +-----------------------------------------------------+
                                            |
                                            v
                  +-----------------------------------------------------+
                  |             FastAPI & ML Attention Engine           |
                  |           (backend/main.py & ml_engine.py)          |
                  +-----------------------------------------------------+
```

---

## 2. Key Architecture Components

### A. Windows Desktop Activity Daemon (`tracker-daemon.ps1`)
- **Win32 Polling Engine**: Leverages native Windows APIs (`GetForegroundWindow`, `GetWindowText`, `GetWindowThreadProcessId`) to track active window titles and process binaries with low system overhead.
- **Idle Detection**: Evaluates `GetLastInputInfo` to differentiate active computer interaction from idle standby (automatic threshold trigger).
- **Persistent State Recovery**: Reads existing `activity_state.json` on startup to preserve today's accumulated telemetry across daemon restarts.
- **Context Switch Counter**: Tracks transitions between discrete applications and browser scopes.

### B. Chrome Browser Extension (Manifest V3 - `extension/`)
- **Active Tab Dwell Engine (`background.js`)**: Listens to `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` to calculate precise dwell time per domain.
- **Cumulative Previous Duration**: Preserves total active time when switching websites, preventing 0s duration display bugs.
- **Unified 9-Category Taxonomy**: Automatically maps visited web domains into standardized productivity categories.
- **Multi-Day Storage (`historyByDate`)**: Persists daily aggregates in `chrome.storage.local` across Today, Yesterday, 7 Days, and 30 Days.
- **Content Bridge (`content_bridge.js`)**: Bridges extension storage to web dashboard clients via `localStorage` and `postMessage` on `http://127.0.0.1:5500/`.

### C. Pro Intelligence Dashboard (`index.html`, `js/app.js`, `css/styles.css`)
- **KPI Metrics**: Real-time display for Total Active Usage, Distinct Apps and Sites, Context Switches, Idle Time, and Focus Score.
- **Dual Telemetry Merge**: Seamlessly merges desktop application records with browser extension records into a unified dataset.
- **Attention Breakdown**: Visual distribution bars for all 9 activity categories.
- **Live Active Foreground Focus**: Displays the current active process, window title, and session dwell timer in real time.

### D. FastAPI Backend & ML Attention Engine (`backend/`)
- **RESTful Endpoints**: Built with FastAPI and SQLAlchemy for activity ingestion and reporting.
- **Attention & Distraction Analysis (`ml_engine.py`)**: Computes focus scores, attention decay coefficients, and distraction clusters based on session length and frequency of context switching.
- **Automated Validation**: Pydantic models for request/response schemas and integrity checking.

---

## 3. Standardized 9-Category Attention Taxonomy

All activities from desktop applications and web domains are classified into nine unified categories:

| Category | Typical Applications / Domains | Classification Type |
|---|---|---|
| **Development** | VS Code, GitHub, Stack Overflow, Windows Terminal | Productive |
| **Learning** | Coursera, edX, MDN Web Docs, LeetCode, Documentation | Productive |
| **Professional** | Gmail, Slack, Microsoft Teams, Jira, LinkedIn | Productive / Neutral |
| **Communication** | WhatsApp, Discord, Telegram, Zoom | Neutral |
| **Entertainment** | YouTube, Netflix, Spotify, Prime Video | Non-Productive |
| **Social Media** | Instagram, Reddit, Twitter / X, Facebook | Distraction Risk |
| **News** | BBC, CNN, TechCrunch, The Verge | Neutral / Distraction |
| **Shopping** | Amazon, Flipkart, eBay | Non-Productive |
| **Utilities** | System Settings, File Explorer, Calculator, Notepad | Neutral |

---

## 4. Repository Structure

```
├── .github/
│   └── workflows/ci.yml         # GitHub Actions automated test workflow
├── backend/
│   ├── database.py              # SQLAlchemy database session and engine setup
│   ├── main.py                  # FastAPI server routes and activity ingestion
│   ├── ml_engine.py             # Attention scoring and ML distraction clustering
│   ├── models.py                # Database entity models
│   ├── requirements.txt         # Python dependencies
│   ├── run_backend.bat          # Backend server launch script
│   └── schemas.py               # Pydantic data schemas
├── css/
│   └── styles.css               # Pro Intelligence dark-mode dashboard styling
├── extension/
│   ├── background.js            # Background service worker (dwell timing & taxonomy)
│   ├── content_bridge.js        # Storage bridge to http://127.0.0.1:5500/
│   ├── manifest.json            # Chrome Manifest V3 configuration
│   ├── popup.css                # Extension popup interface styling
│   ├── popup.html               # Extension popup layout
│   ├── popup.js                 # Popup UI logic and date range aggregation
│   └── icons/                   # Extension icons (16px, 48px, 128px)
├── js/
│   ├── ai-insights.js           # Client-side behavioral insight generator
│   ├── app.js                   # Main dashboard application logic and bridge listener
│   ├── config.js                # System configuration constants
│   ├── dashboard-ui.js          # Chart rendering and DOM manipulation
│   ├── distraction-detector.js  # Heuristic distraction detection rules
│   └── tracker-core.js          # Core tracking utility functions
├── tests/
│   └── test_attention.py        # Automated test suite for attention engine and API
├── activity_history.json        # Aggregated historical telemetry records
├── activity_state.json          # Live tracking state buffer
├── index.html                   # Main web analytics dashboard
├── package.json                 # Web client metadata and dependencies
├── run-terminal.bat             # Terminal launcher utility
├── server.py                    # Local HTTP server for dashboard (port 5500)
├── start.bat                    # One-click system launcher
└── tracker-daemon.ps1           # Windows Win32 background tracking daemon
```

---

## 5. Quick Start & Setup Guide

### Prerequisites
- Windows 10 or 11
- Python 3.10+ installed and added to PATH
- Google Chrome, Brave, or Microsoft Edge
- PowerShell 5.1+ (built into Windows)

### Option 1: One-Click Launch (Recommended)
Double-click `start.bat` in the project root directory. This script automatically:
1. Starts the background Win32 activity tracking daemon (`tracker-daemon.ps1`).
2. Launches the local dashboard HTTP server on `http://127.0.0.1:5500/`.
3. Opens the dashboard in your default browser.

### Option 2: Step-by-Step Manual Launch

#### 1. Start the Windows Tracking Daemon
Open PowerShell in the project directory and execute:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tracker-daemon.ps1
```

#### 2. Start the Local Dashboard Server
In a separate terminal, run:
```bash
python server.py
```
Access the dashboard at: `http://127.0.0.1:5500/`

#### 3. Load the Browser Extension
1. Open Google Chrome (or Brave / Edge) and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select the `extension/` directory from this repository.
4. Pin the extension to your toolbar to view live browser dwell metrics.

#### 4. (Optional) Start the FastAPI Backend
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API documentation will be accessible at `http://127.0.0.1:8000/docs`.

---

## 6. Testing & Quality Verification

Run the automated test suite to verify the attention engine, scoring logic, and validation schemas:

```bash
pytest tests/test_attention.py -v
```

Syntax and integrity checks for JavaScript and PowerShell:
```bash
# Verify JavaScript files
node -c js/app.js
node -c extension/background.js
node -c extension/popup.js
node -c extension/content_bridge.js

# Verify PowerShell tracking script
powershell -Command "[System.Management.Automation.Language.Parser]::ParseInput((Get-Content tracker-daemon.ps1 -Raw), [ref]$null, [ref]$null)"
```

---

## 7. Milestone 1 Deliverables Summary

- [x] **Desktop Telemetry Capture**: Win32 foreground polling with idle state detection (`tracker-daemon.ps1`).
- [x] **Browser Telemetry Capture**: Chrome Manifest V3 extension with live dwell and previous website duration tracking (`extension/`).
- [x] **Standardized 9-Category Taxonomy**: Unified categorization across desktop processes and web domains.
- [x] **Dual Telemetry Bridge**: Real-time synchronization between browser extension storage and the local dashboard (`extension/content_bridge.js`).
- [x] **Pro Intelligence Dashboard**: Visual KPI tiles, category breakdown, active focus inspector, and time-range filters (`index.html`, `js/app.js`).
- [x] **Code Submission**: Committed and pushed to official Springboard branch `ThotaAbhishek_milestone1`.
