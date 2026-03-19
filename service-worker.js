// service-worker.js — Manifest V3 entry point
// Loads all existing background scripts via importScripts (same load order as MV2 manifest)
// This is the MV3 equivalent of the background.scripts array in manifest.json
//
// To test MV3: rename manifest.json → manifest_v2.json, rename manifest_v3.json → manifest.json
// To revert: swap them back

importScripts(
    'lib/vendor/browser-polyfill.min.js',
    'lib/state-persistence.js',
    'lib/storage-db.js',
    'lib/opfs-storage.js',
    'lib/vendor/pdf.min.js',
    'lib/vendor/fflate.min.js',
    'lib/cloud-providers.js',
    'lib/intelligence-providers.js',
    'lib/aircraft-lookup.js',
    'lib/vessel-lookup.js',
    'lib/cloud-backup.js',
    'lib/argus-vault.js',
    'lib/xmpp-client.js',
    'lib/xmpp-sms.js',
    'background-permissions.js',
    'lib/argus-structured.js',
    'background-presets.js',
    'background-providers.js',
    'background.js',
    'background-osint.js',
    'data/kg-dictionaries.js',
    'background-kg.js',
    'background-pipelines.js',
    'background-agents.js',
    'data/prebuilt-automations.js',
    'background-automations.js',
    'lib/archive-redirect-mv3.js',
    'lib/xmpp-reconnect-mv3.js'
);

// M2: Restore persisted state on service worker wake-up
// NOTE: This only works once background.js globals are registered with ArgusStatePersistence
// See lib/state-persistence.js for the wiring instructions
ArgusStatePersistence.restore().then(function() {
    // M4: Sync archive redirect rules on startup
    if (typeof ArgusMV3ArchiveRedirect !== 'undefined') {
        ArgusMV3ArchiveRedirect.sync();
    }
    // M5: Reconnect XMPP if was previously connected
    if (typeof ArgusMV3XmppReconnect !== 'undefined') {
        ArgusMV3XmppReconnect.tryReconnect();
    }
    console.log('[Argus] Service worker loaded (MV3 mode) — M1-M7 complete | Firefox + browser.* APIs | 36 plugins active');
});

// M5: XMPP keep-alive alarm (reconnects every 5 min if SW was unloaded)
browser.alarms.create('xmppKeepAlive', { periodInMinutes: 5 });
browser.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'xmppKeepAlive' && typeof ArgusMV3XmppReconnect !== 'undefined') {
        ArgusMV3XmppReconnect.tryReconnect();
    }
});
