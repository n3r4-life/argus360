// shared/plugin-loader.js
// Dynamic loader with idempotency guard and auto ribbon init

window.ArgusPluginLoader = window.ArgusPluginLoader || {
    pluginFiles: [
        'google-earth-engine.js',
        'textit.js',
        'trawl-enhancement.js',
        'sanctions-screen.js',
        'semantic-index.js',
        'location-intelligence.js',
        'calendar-event-bus.js',
        'govintel-feature.js',
        'airport-intelligence.js',
        '100-eyes-library.js',
        'satellite-overlay.js',
        'sanctions-v2.js',
        'xmpp-router.js',
        'rss-keyword-router.js',
        'finance-screen.js',
        'bookmarks-smart.js',
        'monitors-diff.js',
        'feeds-rss.js',
        'chat-xmpp.js',
        'ssh-terminal.js',
        'workbench-multi.js',
        'draft-pad-ai.js',
        'event-bus.js',
        'copernicus-wms.js',
        'vessel-track.js',
        'sec-edgar.js',
        'gdelt-events.js',
        'wigle-wifi.js',
        'broadcastify.js',
        'opensky-track.js',
        'xmpp-sasl.js',
        'vault-encrypt.js',
        'kg-prune.js'
    ],
    loaded: false,

    loadAll: async function() {
        if (this.loaded) return;
        const promises = this.pluginFiles.map(filename => {
            return new Promise(resolve => {
                const script = document.createElement('script');
                script.src = browser.runtime.getURL('plugins/' + filename);
                script.async = true;
                script.onload = resolve;
                script.onerror = () => { console.warn('Failed to load plugin: ' + filename); resolve(); };
                document.body.appendChild(script);
            });
        });
        await Promise.all(promises);
        this.loaded = true;
        console.log('Argus Plugin Loader injected all plugins dynamically');
        this.initRibbonOnPage();
        return true;
    },

    initRibbonOnPage: function() {
        if (document.querySelector('.argus-ribbon')) return;
        const ribbonInit = document.createElement('script');
        ribbonInit.src = browser.runtime.getURL('shared/ribbon-auto-init.js');
        ribbonInit.async = true;
        document.body.appendChild(ribbonInit);
    }
};
