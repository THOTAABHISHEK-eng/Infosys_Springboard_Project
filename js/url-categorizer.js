/**
 * Intelligent Website Categorizer
 * Features path-aware classification, domain heuristics, and user-defined override rules.
 */

const URLCategorizer = (function () {
    const OVERRIDES_STORAGE_KEY = "attention_category_overrides_v2";
    let userOverrides = {};

    // Load persisted overrides
    function loadOverrides() {
        try {
            const saved = localStorage.getItem(OVERRIDES_STORAGE_KEY);
            if (saved) {
                userOverrides = JSON.parse(saved);
            }
        } catch (e) {
            console.warn("Failed to read category overrides from localStorage", e);
        }
    }

    // Save overrides
    function saveOverrides() {
        try {
            localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(userOverrides));
        } catch (e) {
            console.warn("Failed to save category overrides to localStorage", e);
        }
    }

    loadOverrides();

    /**
     * Extracts clean hostname without leading 'www.'
     */
    function extractDomain(urlStr) {
        try {
            const urlObj = new URL(urlStr.startsWith("http") ? urlStr : "https://" + urlStr);
            let host = urlObj.hostname.toLowerCase();
            if (host.startsWith("www.")) {
                host = host.slice(4);
            }
            return host;
        } catch {
            return "unknown";
        }
    }

    /**
     * Derive a human-readable website name
     */
    function extractWebsiteName(urlStr) {
        try {
            const domain = extractDomain(urlStr);
            // Check curated rules
            if (AttentionConfig.DOMAIN_RULES[domain]) {
                return AttentionConfig.DOMAIN_RULES[domain].name;
            }
            if (AttentionConfig.DOMAIN_RULES["www." + domain]) {
                return AttentionConfig.DOMAIN_RULES["www." + domain].name;
            }
            if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return domain;
            if (domain === "localhost") return "Localhost";

            // Fallback: title-case the primary domain slug
            const parts = domain.split(".");
            const brand = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
            if (brand && isNaN(brand)) {
                return brand.charAt(0).toUpperCase() + brand.slice(1);
            }
            return domain;
        } catch {
            return "Web Page";
        }
    }

    /**
     * Path-aware classification rules.
     * Evaluates path, queries, and contextual markers.
     */
    function checkPathContext(urlObj) {
        const host = urlObj.hostname.toLowerCase();
        const path = urlObj.pathname.toLowerCase();
        const search = urlObj.search.toLowerCase();

        // 1. YouTube: Educational / Coding queries vs Entertainment
        if (host.includes("youtube.com")) {
            const eduKeywords = ["lecture", "tutorial", "course", "programming", "python", "javascript", "dsa", "ai", "math", "physics", "machine learning", "infosys", "springboard"];
            const isEduQuery = eduKeywords.some(kw => search.includes(kw) || path.includes(kw));
            if (isEduQuery) {
                return {
                    category: "EDUCATION",
                    isProductive: true,
                    confidence: 0.88,
                    reason: "Educational content query on YouTube"
                };
            }
            // Music / Gaming paths
            if (path.includes("/music") || path.includes("/gaming") || path.includes("/shorts")) {
                return {
                    category: "ENTERTAINMENT",
                    isProductive: false,
                    confidence: 0.95,
                    reason: "YouTube entertainment/shorts path"
                };
            }
        }

        // 2. Reddit: Subreddit-aware classification
        if (host.includes("reddit.com")) {
            if (path.includes("/r/learnprogramming") || path.includes("/r/programming") || path.includes("/r/datascience") || path.includes("/r/webdev") || path.includes("/r/computerscience")) {
                return {
                    category: "PROGRAMMING",
                    isProductive: true,
                    confidence: 0.92,
                    reason: "Technical/Programming Subreddit"
                };
            }
            if (path.includes("/r/science") || path.includes("/r/technology") || path.includes("/r/academicpsychology")) {
                return {
                    category: "RESEARCH",
                    isProductive: true,
                    confidence: 0.88,
                    reason: "Academic/Research Subreddit"
                };
            }
            return {
                category: "SOCIAL_MEDIA",
                isProductive: false,
                confidence: 0.85,
                reason: "General Reddit browsing"
            };
        }

        // 3. Medium & Substack: Technical vs Casual
        if (host.includes("medium.com") || host.includes("substack.com")) {
            const techKeywords = ["tech", "coding", "software", "engineering", "ai", "data", "deep-learning"];
            if (techKeywords.some(kw => path.includes(kw))) {
                return {
                    category: "RESEARCH",
                    isProductive: true,
                    confidence: 0.86,
                    reason: "Technical research article"
                };
            }
        }

        return null;
    }

    /**
     * Primary Classification Method
     * Evaluates: User Overrides -> Path Rules -> Curated Domain Rules -> Generic Heuristics
     */
    function classify(rawUrl) {
        if (!rawUrl || typeof rawUrl !== "string") {
            return {
                category: "OTHER",
                categoryMeta: AttentionConfig.CATEGORIES.OTHER,
                isProductive: false,
                confidence: 0.1,
                reason: "Empty or invalid URL",
                domain: "unknown",
                websiteName: "Unknown"
            };
        }

        const domain = extractDomain(rawUrl);
        const websiteName = extractWebsiteName(rawUrl);

        // 1. User manual override takes highest precedence
        if (userOverrides[domain]) {
            const override = userOverrides[domain];
            const meta = AttentionConfig.CATEGORIES[override.category] || AttentionConfig.CATEGORIES.OTHER;
            return {
                category: override.category,
                categoryMeta: meta,
                isProductive: override.isProductive,
                confidence: 1.0,
                reason: "User manual classification override",
                domain: domain,
                websiteName: websiteName
            };
        }

        let urlObj;
        try {
            urlObj = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl);
        } catch {
            return {
                category: "OTHER",
                categoryMeta: AttentionConfig.CATEGORIES.OTHER,
                isProductive: false,
                confidence: 0.2,
                reason: "Unparseable URL string",
                domain: domain,
                websiteName: websiteName
            };
        }

        // 2. Check path-specific contextual rules
        const pathMatch = checkPathContext(urlObj);
        if (pathMatch) {
            return {
                category: pathMatch.category,
                categoryMeta: AttentionConfig.CATEGORIES[pathMatch.category],
                isProductive: pathMatch.isProductive,
                confidence: pathMatch.confidence,
                reason: pathMatch.reason,
                domain: domain,
                websiteName: websiteName
            };
        }

        // 3. Domain dictionary check
        const directRule = AttentionConfig.DOMAIN_RULES[domain] || AttentionConfig.DOMAIN_RULES["www." + domain];
        if (directRule) {
            return {
                category: directRule.category,
                categoryMeta: AttentionConfig.CATEGORIES[directRule.category],
                isProductive: directRule.productive,
                confidence: 0.95,
                reason: `Matched domain rule for ${domain}`,
                domain: domain,
                websiteName: directRule.name || websiteName
            };
        }

        // 4. Subdomain & TLD heuristics (.edu, .ac.in, .gov, .org)
        if (domain.endsWith(".edu") || domain.endsWith(".ac.in") || domain.endsWith(".edu.in")) {
            return {
                category: "EDUCATION",
                categoryMeta: AttentionConfig.CATEGORIES.EDUCATION,
                isProductive: true,
                confidence: 0.85,
                reason: "Educational domain extension (.edu / .ac)",
                domain: domain,
                websiteName: websiteName
            };
        }

        // Fallback default
        return {
            category: "OTHER",
            categoryMeta: AttentionConfig.CATEGORIES.OTHER,
            isProductive: false,
            confidence: 0.5,
            reason: "Uncategorized domain",
            domain: domain,
            websiteName: websiteName
        };
    }

    /**
     * User customization methods
     */
    function setOverride(domain, category, isProductive) {
        const cleanDomain = extractDomain(domain);
        userOverrides[cleanDomain] = {
            category: category,
            isProductive: !!isProductive,
            updatedAt: new Date().toISOString()
        };
        saveOverrides();
    }

    function removeOverride(domain) {
        const cleanDomain = extractDomain(domain);
        delete userOverrides[cleanDomain];
        saveOverrides();
    }

    function getOverrides() {
        return { ...userOverrides };
    }

    return {
        classify,
        extractDomain,
        extractWebsiteName,
        setOverride,
        removeOverride,
        getOverrides
    };
})();

// Export for module/browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = URLCategorizer;
}

