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

function extractWebsiteName(urlStr, pageTitle) {
    const domain = extractDomain(urlStr);
    if (domain === "springboard.infosys.com") return "Infosys Springboard";
    if (KNOWN_SITES[domain]) return KNOWN_SITES[domain];
    if (KNOWN_SITES["www." + domain]) return KNOWN_SITES["www." + domain];

    // Clean up domain slug
    const parts = domain.split(".");
    if (parts.length >= 2) {
        const brand = parts.length > 2 && ["co", "gov", "ac", "edu"].includes(parts[parts.length - 2]) 
            ? parts[parts.length - 3] 
            : parts[parts.length - 2];
        return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
    return pageTitle ? pageTitle.split(" - ")[0].split(" | ")[0] : domain;
}

// Load real persisted state from chrome.storage.local
chrome.storage.local.get(["todayDateStr", "siteUsage", "timeline", "totalTabSwitches", "currentWebsite", "previousWebsite", "historyByDate"], res => {
    const history = res.historyByDate || {};

    if (res.todayDateStr === todayDateStr && res.siteUsage) {
        siteUsage = res.siteUsage || {};
        timeline = res.timeline || [];
        totalTabSwitches = res.totalTabSwitches || 0;
        currentWebsite = res.currentWebsite || null;
        previousWebsite = res.previousWebsite || null;
    } else {
        // If transitioning from yesterday to today, archive yesterday's data!
        if (res.todayDateStr && res.siteUsage && Object.keys(res.siteUsage).length > 0) {
            history[res.todayDateStr] = {
                siteUsage: res.siteUsage,
                timeline: res.timeline || [],
                totalTabSwitches: res.totalTabSwitches || 0
            };
            chrome.storage.local.set({ historyByDate: history });
        }

        // Fresh day baseline
        siteUsage = {};
        timeline = [];
        totalTabSwitches = 0;
        currentWebsite = null;
        previousWebsite = null;
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
            totalTabSwitches: totalTabSwitches,
            siteUsage: siteUsage,
            timeline: timeline.slice(-60),
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
        u.includes("infosys_springboard") ||
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
            if (isValidExternalUrl(url)) {
                const domain = extractDomain(url);
                const siteName = extractWebsiteName(url, tab.title);
                if (!siteUsage[domain]) {
                    siteUsage[domain] = {
                        name: siteName,
                        domain: domain,
                        totalSec: 0,
                        visitCount: 1,
                        firstSeen: formatClockTime(now),
                        lastActive: formatClockTime(now),
                        lastActiveTimestamp: Date.now()
                    };
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

    // 2. Finalize previous website visit
    if (currentWebsite) {
        const elapsedSec = currentDwellSec;
        const prevDomain = currentWebsite.domain;

        if (!siteUsage[prevDomain]) {
            siteUsage[prevDomain] = {
                name: currentWebsite.name,
                domain: prevDomain,
                totalSec: 0,
                visitCount: 0,
                lastActiveTimestamp: Date.now()
            };
        }
        siteUsage[prevDomain].totalSec += elapsedSec;
        siteUsage[prevDomain].lastActive = formatClockTime(now);
        siteUsage[prevDomain].lastActiveTimestamp = Date.now();

        timeline.push({
            id: "tl_" + Date.now(),
            name: currentWebsite.name,
            domain: prevDomain,
            timeStr: currentWebsite.activatedTime,
            durationSec: Math.max(1, elapsedSec),
            actionText: `Switched to ${siteName}`,
            timestamp: now.getTime()
        });

        previousWebsite = {
            name: currentWebsite.name,
            domain: prevDomain,
            url: currentWebsite.url,
            totalActiveSpent: elapsedSec,
            lastActiveTime: formatClockTime(now)
        };
    }

    // 3. Set new Current Website
    totalTabSwitches++;
    currentDwellSec = 0;

    if (!siteUsage[domain]) {
        siteUsage[domain] = {
            name: siteName,
            domain: domain,
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
    }

    currentWebsite = {
        tabId: tabId,
        name: siteName,
        domain: domain,
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
            handleTabTransition(url, tab.title, tab.id);
        }
        scanAllOpenTabs();
    });
});

// 2. Tab Navigation (URL change in active tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && (tab.url || tab.pendingUrl)) {
        handleTabTransition(tab.url || tab.pendingUrl, tab.title, tab.id);
    }
    scanAllOpenTabs();
});

// 3. Tab Creation and Removal
chrome.tabs.onCreated.addListener(() => {
    scanAllOpenTabs();
});

chrome.tabs.onRemoved.addListener(() => {
    scanAllOpenTabs();
});

// 4. Window Focus / Blur
chrome.windows.onFocusChanged.addListener(windowId => {
    isWindowFocused = (windowId !== chrome.windows.WINDOW_ID_NONE);
    scanAllOpenTabs();
});

// 5. 1-Second Heartbeat
let syncCounter = 0;
setInterval(() => {
    syncCounter++;

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
        timeline: timeline.slice(-60)
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
