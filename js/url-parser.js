/**
 * URL Parser & Extractor Utility
 * Handles URL validation, normalization, domain extraction, and friendly website name resolution.
 */

const URLParser = (function () {
    // Known website name mappings for prominent domains
    const KNOWN_DOMAINS = {
        'google.com': 'Google',
        'www.google.com': 'Google Search',
        'youtube.com': 'YouTube',
        'www.youtube.com': 'YouTube',
        'github.com': 'GitHub',
        'www.github.com': 'GitHub',
        'stackoverflow.com': 'Stack Overflow',
        'wikipedia.org': 'Wikipedia',
        'en.wikipedia.org': 'Wikipedia (English)',
        'springboard.infosys.com': 'Infosys Springboard',
        'infosys.com': 'Infosys',
        'linkedin.com': 'LinkedIn',
        'www.linkedin.com': 'LinkedIn',
        'reddit.com': 'Reddit',
        'www.reddit.com': 'Reddit',
        'x.com': 'X (formerly Twitter)',
        'twitter.com': 'Twitter',
        'facebook.com': 'Facebook',
        'instagram.com': 'Instagram',
        'amazon.com': 'Amazon',
        'amazon.in': 'Amazon India',
        'netflix.com': 'Netflix',
        'microsoft.com': 'Microsoft',
        'developer.mozilla.org': 'MDN Web Docs',
        'leetcode.com': 'LeetCode',
        'chatgpt.com': 'ChatGPT',
        'openai.com': 'OpenAI',
        'w3schools.com': 'W3Schools',
        'medium.com': 'Medium',
        'coursera.org': 'Coursera',
        'geeksforgeeks.org': 'GeeksforGeeks',
        'hackerrank.com': 'HackerRank',
        'docs.python.org': 'Python Documentation',
        'nodejs.org': 'Node.js'
    };

    /**
     * Normalizes a raw string into a valid absolute URL.
     * Automatically prepends https:// if missing.
     * @param {string} input - The raw URL string
     * @returns {string} Normalized URL
     */
    function normalizeURL(input) {
        if (!input || typeof input !== 'string') return '';
        let trimmed = input.trim();
        // If protocol is missing, prepend https://
        if (!/^https?:\/\//i.test(trimmed)) {
            // Also check for localhost or ip without protocol
            trimmed = 'https://' + trimmed;
        }
        return trimmed;
    }

    /**
     * Validates whether a given string is a valid HTTP/HTTPS URL.
     * @param {string} input - The URL string to validate
     * @returns {{isValid: boolean, error: string|null, urlObj: URL|null}}
     */
    function validateURL(input) {
        if (!input || typeof input !== 'string' || input.trim() === '') {
            return { isValid: false, error: 'URL cannot be empty', urlObj: null };
        }

        const normalized = normalizeURL(input);

        try {
            const parsed = new URL(normalized);

            // Ensure protocol is http or https
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return { isValid: false, error: 'Only http:// and https:// URLs are supported', urlObj: null };
            }

            // Ensure hostname has at least one dot or is localhost / valid IP
            const hostname = parsed.hostname;
            if (!hostname) {
                return { isValid: false, error: 'Invalid domain name in URL', urlObj: null };
            }

            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            const hasDot = hostname.includes('.');

            if (!isLocalhost && !hasDot) {
                return { isValid: false, error: 'Domain must contain a valid extension (e.g. .com, .org, .edu)', urlObj: null };
            }

            return { isValid: true, error: null, urlObj: parsed };
        } catch (err) {
            return { isValid: false, error: 'Malformed URL: ' + err.message, urlObj: null };
        }
    }

    /**
     * Extracts clean domain name from URL.
     * E.g. "https://www.google.com/search?q=test" -> "google.com" or "www.google.com"
     * @param {URL|string} urlInput
     * @param {boolean} stripWww - Optional, whether to strip www. prefix
     * @returns {string}
     */
    function extractDomain(urlInput, stripWww = false) {
        try {
            const urlObj = typeof urlInput === 'string' ? new URL(normalizeURL(urlInput)) : urlInput;
            let host = urlObj.hostname.toLowerCase();
            if (stripWww && host.startsWith('www.')) {
                host = host.slice(4);
            }
            return host;
        } catch {
            return 'Unknown Domain';
        }
    }

    /**
     * Intelligently derives a human-friendly Website Name.
     * 1. Checks curated known dictionary
     * 2. Checks for subdomains/brands (e.g. en.wikipedia.org -> Wikipedia)
     * 3. Fallbacks to title-casing the primary domain part
     * @param {URL|string} urlInput
     * @returns {string} Human friendly website name
     */
    function extractWebsiteName(urlInput) {
        try {
            const urlObj = typeof urlInput === 'string' ? new URL(normalizeURL(urlInput)) : urlInput;
            const hostname = urlObj.hostname.toLowerCase();

            // 1. Direct match in dictionary
            if (KNOWN_DOMAINS[hostname]) {
                return KNOWN_DOMAINS[hostname];
            }

            // 2. Match without www.
            const withoutWww = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
            if (KNOWN_DOMAINS[withoutWww]) {
                return KNOWN_DOMAINS[withoutWww];
            }
            if (/^\d+\.\d+\.\d+\.\d+$/.test(withoutWww)) {
                return withoutWww;
            }
            if (withoutWww === "localhost") {
                return "Localhost";
            }

            // 3. Fallback smart heuristic extraction
            // e.g., "cs.stanford.edu" -> parts: ["cs", "stanford", "edu"]
            // "my-cool-portal.com" -> "My Cool Portal"
            const parts = withoutWww.split('.');
            let brandPart = '';

            // Handle two-part TLDs like .co.uk, .gov.in, .edu.in
            const isTwoPartTld = parts.length >= 3 && ['co', 'gov', 'edu', 'ac', 'org', 'net', 'com'].includes(parts[parts.length - 2]);

            if (isTwoPartTld && parts.length >= 3) {
                brandPart = parts[parts.length - 3];
            } else if (parts.length >= 2) {
                brandPart = parts[parts.length - 2];
            } else {
                brandPart = parts[0];
            }

            if (!brandPart || !isNaN(brandPart)) {
                return withoutWww;
            }

            // Clean up hyphens and title case
            return formatBrandName(brandPart);
        } catch {
            return 'Unknown Website';
        }
    }

    /**
     * Helper to capitalize and format a slug into a neat brand name.
     * E.g. "my-cool-portal" -> "My Cool Portal"
     */
    function formatBrandName(str) {
        if (!str) return 'Web Application';
        return str
            .split(/[-_]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Generates a Google S2 Favicon URL for visual flair
     * @param {string} domain
     * @returns {string} Favicon image URL
     */
    function getFaviconUrl(domain) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    }

    return {
        normalizeURL,
        validateURL,
        extractDomain,
        extractWebsiteName,
        getFaviconUrl
    };
})();

// Export for potential module use or attach to global window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = URLParser;
}
