// shared/ribbon-auto-init.js
// Auto-attaches ribbon with double-init guard and options-specific target

if (!document.querySelector('.argus-ribbon')) {
    var target = document.querySelector('.settings-grid') || document.body;
    window.ArgusRibbon.init(target);
}

var plugins = window.ArgusPluginRegistry.listAllPlugins();
plugins.forEach(function(p) {
    window.ArgusRibbon.addPluginButton(p.id, p.name, '\u{1F9E9}', async function() {
        if (await window.ArgusPluginRegistry.isPluginEnabled(p.id)) {
            await window.ArgusPluginRegistry.runPlugin(p.id);
        } else {
            alert('Enable this plugin first in Options');
        }
    });
});
