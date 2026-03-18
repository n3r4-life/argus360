// shared/ribbon-toolbar.js
// Reusable ribbon – matches existing toolbar pattern in reporting/ and trawl/

window.ArgusRibbon = window.ArgusRibbon || {
    container: null,
    buttons: new Map(),

    init: function(parentElement) {
        this.container = document.createElement('div');
        this.container.className = 'argus-ribbon';
        this.container.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; padding:10px 0; margin-bottom:8px;';
        parentElement.prepend(this.container);
    },

    addPluginButton: function(pluginId, label, icon, onClick) {
        if (this.buttons.has(pluginId)) return; // prevent duplicate buttons
        const btn = document.createElement('button');
        btn.className = 'pill-chip';
        btn.innerHTML = `${icon} ${label}`;
        btn.onclick = () => {
            // Toggle active state
            btn.classList.toggle('active');
            onClick();
        };
        this.container.appendChild(btn);
        this.buttons.set(pluginId, btn);
    }
};
