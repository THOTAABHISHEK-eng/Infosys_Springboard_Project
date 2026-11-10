# System Activity & Usage Tracker
### Infosys Springboard Internship &bull; Week 1 Deliverable

A lightweight, high-precision activity tracker that monitors both **system-wide desktop applications** (WhatsApp, Visual Studio Code, Spotify, Discord, File Explorer, Terminal) and **browser tabs** (Brave, Google Chrome, Microsoft Edge) with zero page refreshing and zero artificial dummy data.

---

## 🛠️ Architecture & Resolution of Previous Limitations

### 1. Authentic Engineering Interface (Elimination of "AI Look")
- **Clean Developer Aesthetics**: Removed neon gradient cards, animated pulsating radars, and tacky emoji clutter.
- **Data-First Layout**: Modeled after standard professional developer dashboards (Linear, Vercel, GitHub) with clean slate borders, high-density data tables, and crisp monospace timers.

### 2. Multi-App & Multi-Browser Support (Brave, Chrome, Edge & Desktop Apps)
- **The Challenge**: A browser extension running inside Edge cannot see tabs or windows in Brave, Chrome, or installed desktop applications like WhatsApp due to browser sandbox isolation.
- **The Solution**: Added a lightweight Windows Native Daemon (`tracker-daemon.ps1` / `run-terminal.bat`) utilizing the Windows Win32 API (`GetForegroundWindow`, `GetWindowText`, `GetWindowThreadProcessId`).
- **Full Coverage**: Automatically monitors:
  - **Desktop Apps**: WhatsApp Desktop, VS Code, Discord, Slack, Microsoft Teams, Spotify, File Explorer.
  - **All Browsers**: Brave, Google Chrome, Microsoft Edge, Mozilla Firefox.

### 3. Zero Hardcoded / Pre-Seeded Data
- Completely eliminated hardcoded placeholder seeds (Google, LeetCode, YouTube).
- The system starts in a **100% true clean state**. It only logs what you actually open on your laptop.

### 4. Self-Exclusion Guard (Tracker Never Tracks Itself)
- The tracking engine filters out `index.html`, extension internal URLs, and terminal windows. It will never label itself as "Infosys Springboard" or displace your real active window.

### 5. Internship Week 1 Additions
- **Active Window Guard**: Only counts dwell time when a window is focused. Pauses counting when minimized.
- **CSV Audit Report Exporter**: Generates a downloadable `.csv` spreadsheet showing timestamps, application names, window titles, and duration for internship evaluations.
- **Session Reset Control**: Cleanly resets the tracking baseline with one click.

---

## 🚀 How to Run on Your Laptop

### Option A: Complete System Tracking (Desktop Apps + All Browsers)
This tracks **WhatsApp, Brave, Chrome, Edge, VS Code, Spotify, and all desktop apps**:

1. Navigate to:
   ```
   C:\Users\ABHI\Desktop\infosys_springboard
   ```
2. Double-click **`start.bat`**.
   - Launches the background tracking daemon (`tracker-daemon.ps1`).
   - Opens the clean analytics dashboard (`index.html`) in your browser.
3. Switch between any applications on your laptop (e.g., WhatsApp, VS Code, Brave, Edge). The dashboard updates in real time with zero delay.
4. Click **Export Report (CSV)** to download your activity audit report.

---

### Option B: Terminal CLI Monitor
If you want to view live active window telemetry directly inside PowerShell / Command Prompt:

1. Double-click **`run-terminal.bat`**.
2. As you click on WhatsApp, VS Code, Brave, or Chrome on your laptop, the terminal prints:
   ```text
   [03:15:20 PM] >>> ACTIVATED: WhatsApp Desktop - WhatsApp
   [03:16:10 PM] >>> ACTIVATED: Brave Browser - GitHub: Where the world builds software
   ```
3. Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to stop.

---

### Option C: Browser Extension (Edge / Chrome / Brave)
If you specifically want a toolbar extension popup inside Chromium browsers:

1. Open **Edge**, **Chrome**, or **Brave**.
2. Navigate to:
   - Edge: `edge://extensions`
   - Chrome / Brave: `chrome://extensions`
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the folder:
   ```
   C:\Users\ABHI\Desktop\infosys_springboard\extension
   ```
5. Pin the extension to your toolbar. It will track active tabs with zero dummy data.

---

## 📁 Project Structure

```
infosys_springboard/
├── start.bat                   # 1-Click Launcher (Starts Daemon + Opens Dashboard)
├── run-terminal.bat            # Terminal Launcher for Windows Daemon
├── tracker-daemon.ps1          # Windows Win32 API System-Wide Active Window Daemon
├── activity_state.json         # Real-time state bridge (Zero dummy data)
├── index.html                  # Minimalist Engineering Dashboard
├── README.md                   # Documentation
│
├── css/
│   └── styles.css              # Clean, professional engineering stylesheet
│
├── js/
│   └── app.js                  # Dashboard controller & CSV exporter
│
└── extension/                  # Manifest V3 Extension (Edge, Brave, Chrome)
    ├── manifest.json           # Extension configuration
    ├── background.js           # Service worker with self-exclusion & zero dummy data
    ├── popup.html              # Clean minimalist popup interface
    ├── popup.css               # Clean popup styles
    ├── popup.js                # Live active counter & comparison updater
    └── icons/                  # 16px, 48px, 128px icons
```

## 📖 Detailed Terminal Usage Guide

Below is a step‑by‑step guide to run the **System Activity & Usage Tracker** directly from the Windows terminal (PowerShell or Command Prompt). This mode is useful when you prefer a CLI view, need to redirect output to a file, or want to run the tracker on machines without a graphical browser.

### Prerequisites
- **Windows 10/11** (PowerShell 5+ is built‑in).
- No additional software required; the daemon uses only built‑in Win32 APIs.
- Ensure the execution policy allows scripts to run. If you see an *ExecutionPolicy* error, run the following once in an elevated PowerShell window:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
  ```

### How to Start the Tracker
1. **Open a terminal**:
   - *PowerShell*: Press `Win + X` → *Windows PowerShell*.
   - *Command Prompt*: Press `Win + R`, type `cmd`, hit **Enter**.
2. **Navigate to the project folder** (if not already there):
   ```
   cd C:\Users\ABHI\Desktop\infosys_springboard
   ```
3. **Launch the daemon** using the provided batch file:
   - From PowerShell:
     ```powershell
     .\run-terminal.bat
     ```
   - From Command Prompt:
     ```cmd
     run-terminal.bat
     ```
   The script starts `tracker-daemon.ps1` which prints a timestamped line each time the active window changes.

### Sample Output
```
[03:15:20 PM] >>> ACTIVATED: WhatsApp Desktop - WhatsApp
[03:16:10 PM] >>> ACTIVATED: Brave Browser - GitHub: Where the world builds software
[03:18:45 PM] >>> ACTIVATED: Visual Studio Code - main.py - MyProject
```
- The **first part** (`[HH:MM:SS]`) is the local time.
- `ACTIVATED:` indicates a focus change.
- After the colon you see the **process name** followed by the **window title**.

### How to Stop the Tracker
- Press **Ctrl + C** in the same terminal window. The PowerShell script catches the interrupt and exits cleanly, showing a short shutdown message.

### Redirecting Output (Optional)
If you want to keep a permanent log, redirect the batch output to a file:
```cmd
run-terminal.bat > activity.log 2>&1
```
The file `activity.log` will contain the same lines shown on screen, which you can later analyse or import into Excel.

### Common Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `.un-terminal.bat : File not found` | Wrong working directory | `cd` into the project folder first (see step 2). |
| `execution of scripts is disabled on this system` | PowerShell execution policy | Run the `Set-ExecutionPolicy` command shown in *Prerequisites*. |
| No output appears after launching | Daemon failed to load Win32 API (requires 64‑bit PowerShell) | Ensure you are using the default 64‑bit PowerShell (`$PSVersionTable.PSEdition` should be `Desktop`). |
| Terminal shows `ERROR: Access is denied` | Insufficient permissions to query other processes | Run the terminal **as administrator** (right‑click → *Run as administrator*). |

### Next Steps
- To view the data graphically, keep the daemon running and open `index.html` (the web dashboard) in any browser. The dashboard reads the same `activity_state.json` file that the daemon updates.
- Explore the CSV export button on the dashboard to generate a spreadsheet of the captured activity.

---

Feel free to ask if you need any additional customisations or want to integrate this data with the browser extension UI.
