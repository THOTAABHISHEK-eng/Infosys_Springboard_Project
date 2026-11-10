/**
 * AI-Powered Digital Attention Management System
 * System Configuration & Default Category Dictionaries
 */

const AttentionConfig = {
    // Application Info
    APP_NAME: "AI-Powered Digital Attention Management System",
    VERSION: "2.0.0",
    BACKEND_API_URL: "http://localhost:8000/api",
    STORAGE_KEY: "attention_system_state_v2",

    // Standard Website Categories
    CATEGORIES: {
        EDUCATION: {
            id: "EDUCATION",
            name: "Education & Learning",
            color: "#10b981", // Emerald
            isProductiveDefault: true,
            icon: "🎓"
        },
        PROGRAMMING: {
            id: "PROGRAMMING",
            name: "Programming & Development",
            color: "#3b82f6", // Blue
            isProductiveDefault: true,
            icon: "💻"
        },
        RESEARCH: {
            id: "RESEARCH",
            name: "Research & Documentation",
            color: "#06b6d4", // Cyan
            isProductiveDefault: true,
            icon: "📚"
        },
        PRODUCTIVITY: {
            id: "PRODUCTIVITY",
            name: "Productivity & Tools",
            color: "#8b5cf6", // Purple
            isProductiveDefault: true,
            icon: "⚡"
        },
        COMMUNICATION: {
            id: "COMMUNICATION",
            name: "Communication & Collaboration",
            color: "#f59e0b", // Amber
            isProductiveDefault: true,
            icon: "💬"
        },
        SOCIAL_MEDIA: {
            id: "SOCIAL_MEDIA",
            name: "Social Media",
            color: "#ec4899", // Pink
            isProductiveDefault: false,
            icon: "📱"
        },
        ENTERTAINMENT: {
            id: "ENTERTAINMENT",
            name: "Entertainment & Streaming",
            color: "#ef4444", // Red
            isProductiveDefault: false,
            icon: "🎬"
        },
        OTHER: {
            id: "OTHER",
            name: "Other / Uncategorized",
            color: "#64748b", // Slate
            isProductiveDefault: false,
            icon: "🌐"
        }
    },

    // Curated Domain Rules (Path-aware and Domain-level)
    DOMAIN_RULES: {
        // Education & Learning
        "springboard.infosys.com": { category: "EDUCATION", productive: true, name: "Infosys Springboard" },
        "coursera.org": { category: "EDUCATION", productive: true, name: "Coursera" },
        "edx.org": { category: "EDUCATION", productive: true, name: "edX" },
        "udemy.com": { category: "EDUCATION", productive: true, name: "Udemy" },
        "khanacademy.org": { category: "EDUCATION", productive: true, name: "Khan Academy" },
        "mit.edu": { category: "EDUCATION", productive: true, name: "MIT OpenCourseWare" },
        "stanford.edu": { category: "EDUCATION", productive: true, name: "Stanford University" },
        "nptel.ac.in": { category: "EDUCATION", productive: true, name: "NPTEL" },
        "swayam.gov.in": { category: "EDUCATION", productive: true, name: "SWAYAM" },
        "geeksforgeeks.org": { category: "EDUCATION", productive: true, name: "GeeksforGeeks" },
        "w3schools.com": { category: "EDUCATION", productive: true, name: "W3Schools" },
        "codecademy.com": { category: "EDUCATION", productive: true, name: "Codecademy" },
        "freecodecamp.org": { category: "EDUCATION", productive: true, name: "freeCodeCamp" },

        // Programming & Development
        "github.com": { category: "PROGRAMMING", productive: true, name: "GitHub" },
        "gitlab.com": { category: "PROGRAMMING", productive: true, name: "GitLab" },
        "stackoverflow.com": { category: "PROGRAMMING", productive: true, name: "Stack Overflow" },
        "stackexchange.com": { category: "PROGRAMMING", productive: true, name: "Stack Exchange" },
        "leetcode.com": { category: "PROGRAMMING", productive: true, name: "LeetCode" },
        "hackerrank.com": { category: "PROGRAMMING", productive: true, name: "HackerRank" },
        "codewars.com": { category: "PROGRAMMING", productive: true, name: "Codewars" },
        "developer.mozilla.org": { category: "PROGRAMMING", productive: true, name: "MDN Web Docs" },
        "docs.python.org": { category: "PROGRAMMING", productive: true, name: "Python Documentation" },
        "nodejs.org": { category: "PROGRAMMING", productive: true, name: "Node.js Docs" },
        "react.dev": { category: "PROGRAMMING", productive: true, name: "React Docs" },
        "typescriptlang.org": { category: "PROGRAMMING", productive: true, name: "TypeScript Docs" },
        "hub.docker.com": { category: "PROGRAMMING", productive: true, name: "Docker Hub" },
        "pypi.org": { category: "PROGRAMMING", productive: true, name: "PyPI" },
        "npmjs.com": { category: "PROGRAMMING", productive: true, name: "npm" },

        // Research & Documentation
        "wikipedia.org": { category: "RESEARCH", productive: true, name: "Wikipedia" },
        "en.wikipedia.org": { category: "RESEARCH", productive: true, name: "Wikipedia (English)" },
        "arxiv.org": { category: "RESEARCH", productive: true, name: "arXiv" },
        "scholar.google.com": { category: "RESEARCH", productive: true, name: "Google Scholar" },
        "researchgate.net": { category: "RESEARCH", productive: true, name: "ResearchGate" },
        "ieee.org": { category: "RESEARCH", productive: true, name: "IEEE Xplore" },
        "sciencedirect.com": { category: "RESEARCH", productive: true, name: "ScienceDirect" },
        "nature.com": { category: "RESEARCH", productive: true, name: "Nature Journal" },
        "medium.com": { category: "RESEARCH", productive: true, name: "Medium" },
        "dev.to": { category: "RESEARCH", productive: true, name: "DEV Community" },

        // Productivity & Tools
        "docs.google.com": { category: "PRODUCTIVITY", productive: true, name: "Google Docs" },
        "drive.google.com": { category: "PRODUCTIVITY", productive: true, name: "Google Drive" },
        "sheets.google.com": { category: "PRODUCTIVITY", productive: true, name: "Google Sheets" },
        "notion.so": { category: "PRODUCTIVITY", productive: true, name: "Notion" },
        "trello.com": { category: "PRODUCTIVITY", productive: true, name: "Trello" },
        "linear.app": { category: "PRODUCTIVITY", productive: true, name: "Linear" },
        "jira.atlassian.com": { category: "PRODUCTIVITY", productive: true, name: "Jira" },
        "figma.com": { category: "PRODUCTIVITY", productive: true, name: "Figma" },
        "canva.com": { category: "PRODUCTIVITY", productive: true, name: "Canva" },
        "chatgpt.com": { category: "PRODUCTIVITY", productive: true, name: "ChatGPT" },
        "claude.ai": { category: "PRODUCTIVITY", productive: true, name: "Claude AI" },
        "gemini.google.com": { category: "PRODUCTIVITY", productive: true, name: "Google Gemini" },

        // Communication
        "mail.google.com": { category: "COMMUNICATION", productive: true, name: "Gmail" },
        "outlook.office.com": { category: "COMMUNICATION", productive: true, name: "Outlook" },
        "slack.com": { category: "COMMUNICATION", productive: true, name: "Slack" },
        "teams.microsoft.com": { category: "COMMUNICATION", productive: true, name: "Microsoft Teams" },
        "discord.com": { category: "COMMUNICATION", productive: false, name: "Discord" },
        "web.whatsapp.com": { category: "COMMUNICATION", productive: false, name: "WhatsApp Web" },
        "telegram.org": { category: "COMMUNICATION", productive: false, name: "Telegram" },

        // Social Media
        "instagram.com": { category: "SOCIAL_MEDIA", productive: false, name: "Instagram" },
        "facebook.com": { category: "SOCIAL_MEDIA", productive: false, name: "Facebook" },
        "twitter.com": { category: "SOCIAL_MEDIA", productive: false, name: "Twitter" },
        "x.com": { category: "SOCIAL_MEDIA", productive: false, name: "X (Twitter)" },
        "linkedin.com": { category: "SOCIAL_MEDIA", productive: true, name: "LinkedIn" },
        "reddit.com": { category: "SOCIAL_MEDIA", productive: false, name: "Reddit" },
        "tiktok.com": { category: "SOCIAL_MEDIA", productive: false, name: "TikTok" },
        "pinterest.com": { category: "SOCIAL_MEDIA", productive: false, name: "Pinterest" },
        "snapchat.com": { category: "SOCIAL_MEDIA", productive: false, name: "Snapchat" },

        // Entertainment
        "youtube.com": { category: "ENTERTAINMENT", productive: false, name: "YouTube" },
        "netflix.com": { category: "ENTERTAINMENT", productive: false, name: "Netflix" },
        "twitch.tv": { category: "ENTERTAINMENT", productive: false, name: "Twitch" },
        "hotstar.com": { category: "ENTERTAINMENT", productive: false, name: "Disney+ Hotstar" },
        "primevideo.com": { category: "ENTERTAINMENT", productive: false, name: "Prime Video" },
        "spotify.com": { category: "ENTERTAINMENT", productive: false, name: "Spotify" },
        "hulu.com": { category: "ENTERTAINMENT", productive: false, name: "Hulu" },
        "disneyplus.com": { category: "ENTERTAINMENT", productive: false, name: "Disney+" },
        "crunchyroll.com": { category: "ENTERTAINMENT", productive: false, name: "Crunchyroll" }
    },

    // Distraction Detection Parameters
    THRESHOLDS: {
        EXCESSIVE_SWITCH_WINDOW_SEC: 120, // 2 minutes window
        EXCESSIVE_SWITCH_COUNT: 7,        // > 7 switches in 2 mins = high velocity
        RAPID_BOUNCE_SEC: 20,             // Tab visit under 20s = interruption bounce
        MAX_CONSECUTIVE_DISTRACTION_SEC: 600, // 10 minutes consecutive on social/entertainment
        CATEGORY_HOP_MAX_IN_3MIN: 5,      // > 5 distinct category shifts in 3 mins
        FOCUS_INTERRUPTION_TOLERANCE_SEC: 15 // Visiting distraction during focus triggers alert after 15s
    },

    // Focus Session Defaults
    FOCUS_DEFAULTS: {
        POMODORO_MINUTES: 25,
        SHORT_BREAK_MINUTES: 5,
        LONG_BREAK_MINUTES: 15,
        DAILY_TARGET_MINUTES: 180 // 3 hours daily target
    }
};

// Export for module/browser environments
if (typeof module !== "undefined" && module.exports) {
    module.exports = AttentionConfig;
}

