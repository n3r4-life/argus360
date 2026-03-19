// lib/archive-redirect-mv3.js
// MV3 replacement for webRequest blocking archive redirect
// Uses chrome.declarativeNetRequest.updateDynamicRules() to add/remove domain redirect rules
// Loaded only in MV3 mode (via service-worker.js)
//
// The MV2 version uses browser.webRequest.onBeforeRequest with blocking.
// This MV3 version creates dynamic redirect rules per domain.

var ArgusMV3ArchiveRedirect = {
    RULE_ID_BASE: 10000, // offset to avoid collicting with static rules

    // Sync dynamic rules from storage settings
    sync: async function() {
        try {
            var result = await browser.storage.local.get({
                archiveRedirect: { enabled: false, domains: [], providerUrl: "https://archive.is/" }
            });
            var settings = result.archiveRedirect;

            // Remove all existing dynamic rules first
            var existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            var removeIds = existingRules.map(function(r) { return r.id; });
            if (removeIds.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
            }

            // If disabled or no domains, we're done
            if (!settings.enabled || !settings.domains || settings.domains.length === 0) return;

            // Create a redirect rule per domain
            var providerUrl = settings.providerUrl || "https://archive.is/";
            var addRules = [];
            for (var i = 0; i < settings.domains.length; i++) {
                var domain = settings.domains[i];
                addRules.push({
                    id: this.RULE_ID_BASE + i,
                    priority: 1,
                    action: {
                        type: "redirect",
                        redirect: {
                            // archive.is/[original url] is the redirect pattern
                            regexSubstitution: providerUrl + "\\0"
                        }
                    },
                    condition: {
                        requestDomains: [domain],
                        resourceTypes: ["main_frame"]
                    }
                });
            }

            await chrome.declarativeNetRequest.updateDynamicRules({ addRules: addRules });
            console.log('[ArchiveRedirect-MV3] Synced ' + addRules.length + ' domain rules');
        } catch (e) {
            console.warn('[ArchiveRedirect-MV3] Sync failed:', e.message);
        }
    }
};

// Auto-sync on settings change
browser.storage.onChanged.addListener(function(changes) {
    if (changes.archiveRedirect) {
        ArgusMV3ArchiveRedirect.sync();
    }
});
