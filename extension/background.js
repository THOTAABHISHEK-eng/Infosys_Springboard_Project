/**
 * Current and Previous Website Usage Tracker - Extension Background Service Worker (Manifest V3)
 * High-precision active-tab monitoring across Edge, Brave, and Chrome.
 * 
 * Rules:
 * 1. ZERO dummy/pre-seeded websites (starts completely empty until user browses).
 * 2. Never tracks the Tracker itself (ignores index.html, extensions, internal browser URLs).
 * 3. Never falsely labels local files as "Infosys Springboard".
 * 4. Strictly pauses dwell counter when browser window is minimized or unfocused.
 */

let currentWebsite = null;
let previousWebsite = null;
let currentDwellSec = 0;
let isWindowFocused = true;
let totalTabSwitches = 0;
let siteUsage = {}; // domain -> { name, domain, totalSec, visitCount, lastActive }
let timeline = [];  // Chronological activity records
let todayDateStr = getTodayDateStr();

// Track last known URL per tab to avoid counting spurious onUpdated events
// (title/favicon/status changes that aren't real navigations)
const lastTabUrls = {};

// Idle-time tracking (user inactivity)
// Idle time only starts counting AFTER 180 seconds of continuous inactivity.
// Before that we show progress toward the threshold (e.g. "29/180").
let idleState = "active";        // "active" | "idle" | "locked"
let idleProgressSeconds = 0;     // seconds of inactivity so far (0 -> 180)
let idleTimeSeconds = 0;         // actual idle time counted after threshold crossed
let totalIdleSec = 0;            // total idle seconds accrued today (post-threshold only)
let idleStartTime = null;        // timestamp when current idle stretch began
let lastActiveTime = Date.now(); // timestamp of last user activity detected

const IDLE_THRESHOLD_SEC = 180;  // user-facing idle threshold in seconds

const KNOWN_SITES = {
    "google.com": "Google",
    "youtube.com": "YouTube",
    "github.com": "GitHub",
    "stackoverflow.com": "Stack Overflow",
    "wikipedia.org": "Wikipedia",
    "springboard.infosys.com": "Infosys Springboard",
    "linkedin.com": "LinkedIn",
    "reddit.com": "Reddit",
    "twitter.com": "Twitter",
    "x.com": "X (Twitter)",
    "instagram.com": "Instagram",
    "facebook.com": "Facebook",
    "leetcode.com": "LeetCode",
    "chatgpt.com": "ChatGPT",
    "openai.com": "OpenAI",
    "claude.ai": "Claude AI",
    "developer.mozilla.org": "MDN Web Docs",
    "docs.python.org": "Python Docs",
    "netflix.com": "Netflix",
    "amazon.com": "Amazon",
    "amazon.in": "Amazon India",
    "medium.com": "Medium",
    "coursera.org": "Coursera"
};

function getTodayDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatClockTime(dateObj) {
    const d = dateObj || new Date();
    return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });
}

function extractDomain(urlStr) {
    try {
        const u = new URL(urlStr);
        let host = u.hostname.toLowerCase();
        if (host.startsWith("www.")) host = host.slice(4);
        return host;
    } catch {
        return "unknown";
    }
}

function formatDurationHuman(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const remS = s % 60;
    if (h > 0) return `${h}h ${m}m ${remS}s`;
    if (m > 0) return `${m}m ${remS}s`;
    return `${remS}s`;
}

function extractWebsiteName(urlStr, pageTitle) {
    const domain = extractDomain(urlStr);
    if (domain === "springboard.infosys.com") return "Infosys Springboard";
    if (KNOWN_SITES[domain]) return KNOWN_SITES[domain];
    if (KNOWN_SITES["www." + domain]) return KNOWN_SITES["www." + domain];

    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
        return (pageTitle && !pageTitle.startsWith("http")) ? pageTitle.split(" - ")[0].split(" | ")[0] : domain;
    }
    if (domain === "localhost") {
        return (pageTitle && !pageTitle.startsWith("http")) ? pageTitle.split(" - ")[0].split(" | ")[0] : "Localhost";
    }

    // Clean up domain slug
    const parts = domain.split(".");
    if (parts.length >= 2) {
        const brand = parts.length > 2 && ["co", "gov", "ac", "edu"].includes(parts[parts.length - 2]) 
            ? parts[parts.length - 3] 
            : parts[parts.length - 2];
        if (brand && isNaN(brand)) {
            return brand.charAt(0).toUpperCase() + brand.slice(1);
        }
    }
    return pageTitle ? pageTitle.split(" - ")[0].split(" | ")[0] : domain;
}

function categorizeSite(domain, siteName) {
    const text = ((domain || "") + " " + (siteName || "")).toLowerCase();
    if (text.match(/youtube|netflix|spotify|twitch|crunchyroll|anime|disney|hotstar|hulu|peacock|prime video|movie|video/)) return "Entertainment";
    if (text.match(/github|stackoverflow|chatgpt|gemini|copilot|leetcode|codepen|openai|replit|vercel|netlify|figma|dev|developer/)) return "Development";
    if (text.match(/coursera|udemy|khan|wikipedia|chess|typeracer|duolingo|freecodecamp|infosys|w3schools|mdn|typing|tutorial|learn/)) return "Learning";
    if (text.match(/whatsapp|discord|slack|gmail|teams|zoom|telegram|meet|skype|mail|outlook/)) return "Communication";
    if (text.match(/linkedin|notion|drive|trello|jira|asana|canva|docs|sheets|slides|calendar|sharepoint|office/)) return "Professional";
    if (text.match(/instagram|twitter|x\.com|facebook|reddit|snapchat|tiktok|pinterest|tumblr/)) return "Social Media";
    if (text.match(/amazon|flipkart|ebay|shopping|store|cart|myntra|meesho|etsy|walmart/)) return "Shopping";
    if (text.match(/news|bbc|cnn|times|techcrunch|wired|guardian|bloomberg|reuters|hindu/)) return "News";
    return "Other";
}


// Load real persisted state from chrome.storage.local
chrome.storage.local.get(["todayDateStr", "siteUsage", "timeline", "totalTabSwitches", "currentWebsite", "previousWebsite", "historyByDate", "idleState", "totalIdleSec", "currentIdleSec", "idleStartTime", "lastActiveTime", "isWindowFocused"], res => {
    const history = res.historyByDate || {};

    if (res.todayDateStr === todayDateStr && res.siteUsage) {
        siteUsage = res.siteUsage || {};
        timeline = res.timeline || [];
        totalTabSwitches = res.totalTabSwitches || 0;
        currentWebsite = res.currentWebsite || null;
        previousWebsite = res.previousWebsite || null;
        idleState = res.idleState || "active";
        totalIdleSec = res.totalIdleSec || 0;
        idleProgressSeconds = res.idleProgressSeconds || 0;
        idleTimeSeconds = res.idleTimeSeconds || 0;
        idleStartTime = res.idleStartTime || null;
        lastActiveTime = res.lastActiveTime || Date.now();
        if (typeof res.isWindowFocused === "boolean") isWindowFocused = res.isWindowFocused;
    } else {
        // If transitioning from yesterday to today, archive yesterday's data!
        if (res.todayDateStr && res.siteUsage && Object.keys(res.siteUsage).length > 0) {
            history[res.todayDateStr] = {
                siteUsage: res.siteUsage,
                timeline: res.timeline || [],
                totalTabSwitches: res.totalTabSwitches || 0,
                totalIdleSec: res.totalIdleSec || 0
            };
            chrome.storage.local.set({ historyByDate: history });
        }

        // Fresh day baseline
        siteUsage = {};
        timeline = [];
        totalTabSwitches = 0;
        currentWebsite = null;
        previousWebsite = null;
        idleState = "active";
        totalIdleSec = 0;
        idleProgressSeconds = 0;
        idleTimeSeconds = 0;
        idleStartTime = null;
        lastActiveTime = Date.now();
    }
});

function syncToStorage() {
    chrome.storage.local.get(["historyByDate"], histRes => {
        const history = histRes.historyByDate || {};
        // Keep current day mirrored into history map
        history[todayDateStr] = {
            siteUsage: siteUsage,
            timeline: timeline.slice(-60),
            totalTabSwitches: totalTabSwitches
        };

        chrome.storage.local.set({
            todayDateStr: todayDateStr,
            currentWebsite: currentWebsite,
            previousWebsite: previousWebsite,
            currentDwellSec: currentDwellSec,
            isWindowFocused: isWindowFocused,
            totalTabSwitches: totalTabSwitches,
            siteUsage: siteUsage,
            timeline: timeline.slice(-60),
            idleState: idleState,
            totalIdleSec: totalIdleSec,
            idleProgressSeconds: idleProgressSeconds,
            idleTimeSeconds: idleTimeSeconds,
            idleStartTime: idleStartTime,
            lastActiveTime: lastActiveTime,
            historyByDate: history,
            lastSynced: Date.now()
        });
    });
}

function isValidExternalUrl(urlStr) {
    if (!urlStr) return false;
    const u = urlStr.toLowerCase();
    if (u.startsWith("chrome://") || 
        u.startsWith("edge://") || 
        u.startsWith("brave://") || 
        u.startsWith("about:") || 
        u.startsWith("chrome-extension://") || 
        u.startsWith("edge-extension://") ||
        u.includes("kmkplinihahhdkeammgenjfffccahnbi") ||
        u.includes("infosys_springboard") ||
        u.includes("127.0.0.1") ||
        u.includes("localhost") ||
        u.endsWith("index.html") ||
        u.startsWith("file://") ||
        u === "about:blank") {
        return false;
    }
    return true;
}

/**
 * Scan all open tabs across all browser windows so opened tabs are immediately detected
 */
function scanAllOpenTabs() {
    if (!chrome.tabs || !chrome.tabs.query) return;
    chrome.tabs.query({}, tabs => {
        if (!tabs || chrome.runtime.lastError) return;
        let changed = false;
        const now = new Date();
        tabs.forEach(tab => {
            const url = tab.url || tab.pendingUrl;
            if (url) lastTabUrls[tab.id] = url;
            if (isValidExternalUrl(url)) {
                const domain = extractDomain(url);
                const siteName = extractWebsiteName(url, tab.title);
                if (!siteUsage[domain]) {
                    siteUsage[domain] = {
                        name: siteName,
                        domain: domain,
                        category: categorizeSite(domain, siteName),
                        totalSec: 0,
                        visitCount: 1,
                        firstSeen: formatClockTime(now),
                        lastActive: formatClockTime(now),
                        lastActiveTimestamp: Date.now()
                    };
                    changed = true;
                } else if (!siteUsage[domain].category) {
                    siteUsage[domain].category = categorizeSite(domain, siteName);
                    changed = true;
                }
            }
        });
        if (changed) {
            syncToStorage();
        }
    });
}

/**
 * Handle tab navigation or tab activation
 */
function handleTabTransition(newUrl, newTitle, tabId) {
    // 1. Strict filter against internal, extension, or tracker self-URLs
    if (!isValidExternalUrl(newUrl)) {
        return; // Never track internal or tracker URLs
    }

    const now = new Date();
    const domain = extractDomain(newUrl);
    const siteName = extractWebsiteName(newUrl, newTitle);

    // Prevent duplicate triggers if already on the exact same URL
    if (currentWebsite && currentWebsite.url === newUrl && currentWebsite.tabId === tabId) {
        return;
    }

    // Sub-navigation within the same website domain on the same tab:
    // Update URL/title seamlessly without creating a false switch or wiping previous website history
    if (currentWebsite && currentWebsite.domain === domain && currentWebsite.tabId === tabId) {
        currentWebsite.url = newUrl;
        currentWebsite.name = siteName;
        currentWebsite.lastUpdatedTime = formatClockTime(now);
        lastTabUrls[tabId] = newUrl;
        syncToStorage();
        return;
    }

    // 2. Finalize previous website visit
    if (currentWebsite) {
        const elapsedSec = currentDwellSec;
        const prevDomain = currentWebsite.domain;
        const prevCategory = currentWebsite.category || categorizeSite(prevDomain, currentWebsite.name);

        if (!siteUsage[prevDomain]) {
            siteUsage[prevDomain] = {
                name: currentWebsite.name,
                domain: prevDomain,
                category: prevCategory,
                totalSec: elapsedSec,
                visitCount: 1,
                lastActiveTimestamp: Date.now()
            };
        } else {
            // Dwell is updated per-second in the heartbeat loop. Guard against race conditions:
            if (siteUsage[prevDomain].totalSec < elapsedSec) {
                siteUsage[prevDomain].totalSec = elapsedSec;
            }
            if (!siteUsage[prevDomain].category) {
                siteUsage[prevDomain].category = prevCategory;
            }
        }
        siteUsage[prevDomain].lastActive = formatClockTime(now);
        siteUsage[prevDomain].lastActiveTimestamp = Date.now();

        // Calculate accurate previous total duration: cumulative total on that site today
        const prevTotalToday = (siteUsage[prevDomain] && siteUsage[prevDomain].totalSec > 0)
            ? siteUsage[prevDomain].totalSec
            : Math.max(1, elapsedSec);

        // Record transition in timeline
        timeline.push({
            id: "tl_" + Date.now(),
            name: currentWebsite.name,
            appName: currentWebsite.name,
            domain: prevDomain,
            category: prevCategory,
            title: currentWebsite.name,
            timeStr: currentWebsite.activatedTime,
            time: currentWebsite.activatedTime,
            durationSec: Math.max(1, elapsedSec),
            durationFormatted: formatDurationHuman(Math.max(1, elapsedSec)),
            actionText: `Switched to ${siteName}`,
            timestamp: now.getTime()
        });

        previousWebsite = {
            name: currentWebsite.name,
            domain: prevDomain,
            category: prevCategory,
            url: currentWebsite.url,
            sessionDwellSec: elapsedSec,
            totalActiveSpent: prevTotalToday,
            lastActiveTime: formatClockTime(now)
        };
    }

    // 3. Set new Current Website (only count as a switch when transitioning after meaningful dwell)
    if (currentWebsite && currentDwellSec >= 1) {
        totalTabSwitches++;
    }
    currentDwellSec = 0;

    const currentCategory = categorizeSite(domain, siteName);
    if (!siteUsage[domain]) {
        siteUsage[domain] = {
            name: siteName,
            domain: domain,
            category: currentCategory,
            totalSec: 0,
            visitCount: 1,
            firstSeen: formatClockTime(now),
            lastActive: formatClockTime(now),
            lastActiveTimestamp: Date.now()
        };
    } else {
        siteUsage[domain].visitCount++;
        siteUsage[domain].lastActive = formatClockTime(now);
        siteUsage[domain].lastActiveTimestamp = Date.now();
        if (!siteUsage[domain].category) {
            siteUsage[domain].category = currentCategory;
        }
    }

    currentWebsite = {
        tabId: tabId,
        name: siteName,
        domain: domain,
        category: currentCategory,
        url: newUrl,
        activatedTime: formatClockTime(now),
        lastUpdatedTime: formatClockTime(now),
        timestamp: now.getTime()
    };

    syncToStorage();
}

// 1. Tab Activation (User clicks different tab)
chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
        if (chrome.runtime.lastError || !tab) return;
        const url = tab.url || tab.pendingUrl;
        if (url) {
            lastTabUrls[tab.id] = url;
            handleTabTransition(url, tab.title, tab.id);
        }
        scanAllOpenTabs();
    });
});

// 2. Tab Navigation (URL change in active tab)
// Only count a switch when the URL actually changes for this tab.
// onUpdated fires for title/favicon/status changes too - ignore those.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status && changeInfo.status !== "complete" && !changeInfo.url) {
        return;
    }
    const url = tab.url || tab.pendingUrl;
    if (url) {
        const prevUrl = lastTabUrls[tabId];
        if (prevUrl !== url) {
            lastTabUrls[tabId] = url;
            if (tab.active) {
                handleTabTransition(url, tab.title, tab.id);
            }
        }
    }
    scanAllOpenTabs();
});

// 3. Tab Creation and Removal
chrome.tabs.onCreated.addListener(() => {
    scanAllOpenTabs();
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete lastTabUrls[tabId];
    if (currentWebsite && currentWebsite.tabId === tabId) {
        // Active tab was closed: preserve previous website information cleanly
        const elapsedSec = currentDwellSec;
        const now = new Date();
        const prevDomain = currentWebsite.domain;
        const prevCategory = currentWebsite.category || categorizeSite(prevDomain, currentWebsite.name);
        const prevTotalToday = (siteUsage[prevDomain] && siteUsage[prevDomain].totalSec > 0)
            ? siteUsage[prevDomain].totalSec
            : Math.max(1, elapsedSec);

        previousWebsite = {
            name: currentWebsite.name,
            domain: prevDomain,
            category: prevCategory,
            url: currentWebsite.url,
            sessionDwellSec: elapsedSec,
            totalActiveSpent: prevTotalToday,
            lastActiveTime: formatClockTime(now)
        };
        currentWebsite = null;
        currentDwellSec = 0;
        syncToStorage();
    }
    scanAllOpenTabs();
});

// 4. Window Focus / Blur
chrome.windows.onFocusChanged.addListener(windowId => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        chrome.windows.getLastFocused({ populate: false }, win => {
            if (win && win.focused) {
                isWindowFocused = true;
            } else {
                isWindowFocused = false;
            }
            scanAllOpenTabs();
        });
    } else {
        isWindowFocused = true;
        scanAllOpenTabs();
    }
});

// Idle state changes (user steps away from keyboard/mouse)
if (chrome.idle && chrome.idle.onStateChanged) {
    chrome.idle.onStateChanged.addListener((newState) => {
        const now = Date.now();
        idleState = newState;

        if (newState === "idle" || newState === "locked") {
            // User went idle: start tracking inactivity
            idleStartTime = now;
            idleProgressSeconds = 0;
            idleTimeSeconds = 0;
            lastActiveTime = now;
        } else if (newState === "active") {
            // User returned: add any post-threshold idle time to daily total
            if (idleStartTime) {
                const inactiveSec = Math.floor((now - idleStartTime) / 1000);
                if (inactiveSec > IDLE_THRESHOLD_SEC) {
                    totalIdleSec += (inactiveSec - IDLE_THRESHOLD_SEC);
                }
            }
            idleStartTime = null;
            idleProgressSeconds = 0;
            idleTimeSeconds = 0;
            lastActiveTime = now;
        }

        syncToStorage();
    });
}

// 5. 1-Second Heartbeat
let syncCounter = 0;
setInterval(() => {
    syncCounter++;

    // Track continuous idle progression while user remains idle/locked
    if ((idleState === "idle" || idleState === "locked") && idleStartTime) {
        const inactiveSec = Math.floor((Date.now() - idleStartTime) / 1000);
        idleProgressSeconds = Math.min(inactiveSec, IDLE_THRESHOLD_SEC);
        idleTimeSeconds = Math.max(0, inactiveSec - IDLE_THRESHOLD_SEC);
        lastActiveTime = idleStartTime; // keep last activity at idle start
    }

    // Periodically reconcile idle state with chrome.idle (keeps state correct after sleep/wake)
    if (syncCounter % 15 === 0 && chrome.idle && chrome.idle.queryState) {
        chrome.idle.queryState(IDLE_THRESHOLD_SEC, (state) => {
            if (state !== idleState) {
                // Treat external query result as source of truth for active/idle flips
                const now = Date.now();
                if (state === "idle" || state === "locked") {
                    idleState = state;
                    idleStartTime = now;
                    idleProgressSeconds = 0;
                    idleTimeSeconds = 0;
                    lastActiveTime = now;
                } else if (state === "active" && idleStartTime) {
                    const inactiveSec = Math.floor((now - idleStartTime) / 1000);
                    if (inactiveSec > IDLE_THRESHOLD_SEC) {
                        totalIdleSec += (inactiveSec - IDLE_THRESHOLD_SEC);
                    }
                    idleStartTime = null;
                    idleProgressSeconds = 0;
                    idleTimeSeconds = 0;
                    lastActiveTime = now;
                }
                idleState = state;
                syncToStorage();
            }
        });
    }

    if (isWindowFocused && currentWebsite) {
        currentDwellSec++;
        currentWebsite.lastUpdatedTime = formatClockTime(new Date());

        const dom = currentWebsite.domain;
        if (siteUsage[dom]) {
            siteUsage[dom].totalSec++;
            siteUsage[dom].lastActiveTimestamp = Date.now();
        }
    }

    // Broadcast live state to open extension popups
    chrome.runtime.sendMessage({
        type: "TICK_1S",
        currentWebsite: currentWebsite,
        previousWebsite: previousWebsite,
        currentDwellSec: currentDwellSec,
        isWindowFocused: isWindowFocused,
        totalTabSwitches: totalTabSwitches,
        siteUsage: siteUsage,
        timeline: timeline.slice(-60),
        idleState: idleState,
        idleProgressSeconds: idleProgressSeconds,
        idleTimeSeconds: idleTimeSeconds,
        totalIdleSec: totalIdleSec,
        lastActiveTime: lastActiveTime
    }).catch(() => {});

    if (syncCounter % 3 === 0) {
        syncToStorage();
    }
}, 1000);

// Initialize with currently open tabs
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs && tabs.length > 0 && (tabs[0].url || tabs[0].pendingUrl)) {
        handleTabTransition(tabs[0].url || tabs[0].pendingUrl, tabs[0].title, tabs[0].id);
    }
    scanAllOpenTabs();
});

// External message listener for web pages declared in externally_connectable (http://127.0.0.1:5500)
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
        sendResponse({
            currentWebsite: currentWebsite,
            previousWebsite: previousWebsite,
            currentDwellSec: currentDwellSec,
            isWindowFocused: isWindowFocused,
            totalTabSwitches: totalTabSwitches,
            siteUsage: siteUsage,
            timeline: timeline.slice(-60),
            idleState: idleState,
            totalIdleSec: totalIdleSec,
            lastActiveTime: lastActiveTime
        });
        return true;
    });
}

// Keep Manifest V3 service worker active and continuously sync telemetry to dashboard
if (typeof chrome !== "undefined" && chrome.alarms) {
    chrome.alarms.create("TELEMETRY_SYNC_ALARM", { periodInMinutes: 0.25 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === "TELEMETRY_SYNC_ALARM") {
            syncToStorage();
            autoPushTelemetry();
        }
    });
}

async function autoPushTelemetry() {
    const payload = {
        timestamp: new Date().toISOString(),
        todayDateStr: todayDateStr,
        totalTabSwitches: totalTabSwitches,
        totalIdleSec: totalIdleSec,
        siteUsage: siteUsage,
        timeline: timeline,
        currentWebsite: currentWebsite,
        previousWebsite: previousWebsite
    };
    try {
        await fetch("http://127.0.0.1:5500/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        // Silently ignore if server is not yet running
    }
}

// Expose global sync() function in the Service Worker DevTools Console
self.sync = async function() {
    console.log("[SYNC] Preparing browsing telemetry payload...");
    const payload = {
        timestamp: new Date().toISOString(),
        todayDateStr: todayDateStr,
        totalTabSwitches: totalTabSwitches,
        totalIdleSec: totalIdleSec,
        siteUsage: siteUsage,
        timeline: timeline,
        currentWebsite: currentWebsite,
        previousWebsite: previousWebsite
    };
    try {
        const res = await fetch("http://127.0.0.1:5500/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("========================================================================");
        console.log("[SYNC SUCCESS] RECEIVED REAL BROWSING HISTORY FROM CHROME");
        console.log("========================================================================");
        if (data && data.result) {
            console.log(`Focus Score:         ${data.result.focus_score} / 100`);
            console.log(`Classification:      ${data.result.classification}`);
            console.log(`Deduction Breakdown: ${JSON.stringify(data.result.deduction_breakdown)}`);
            console.log(`Session Type:        ${data.result.session_type}`);
            console.log(`Real Tab Switches:   ${data.result.real_tab_switches}`);
            console.log(`In-Tab Idle Ratio:   ${data.result.in_tab_idle_ratio}`);
            console.log("\nAnalysis:\n" + data.result.analysis);
            console.log("\nRecommendations:\n" + data.result.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n"));
        }
        return data;
    } catch (err) {
        console.error("[SYNC ERROR] Failed to connect to http://127.0.0.1:5500/api/sync:", err);
        return { error: err.message };
    }
};
