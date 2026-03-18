// shared/plugin-loader.js
// Dynamic loader – scales to all 70 plugins without manual script tags

window.ArgusPluginLoader = window.ArgusPluginLoader || {
    pluginFiles: [
        'google-earth-engine.js',
        'textit.js',
        'trawl-enhancement.js'
        // add more here as we implement the 70
    ],

    loadAll: function() {
        const promises = this.pluginFiles.map(filename => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = browser.runtime.getURL(`plugins/${filename}`);
                script.onload = resolve;
                script.onerror = () => { console.warn(`Failed to load plugin: ${filename}`); resolve(); };
                document.body.appendChild(script);
            });
        });
        console.log('✅ Argus Plugin Loader injecting all plugins dynamically');
        return Promise.all(promises);
    }
};
