// shared/agent-context-provider.js
// Global namespace version

window.ArgusPluginContext = window.ArgusPluginContext || {
    getPluginContext: async function() {
        return {
            kg: window.ArgusKG || null,
            vault: window.ArgusVault || null,
            db: window.ArgusDB,
            currentTab: await browser.tabs.getCurrent?.() || null,
            sendMessage: browser.runtime.sendMessage,
            vendors: {
                leaflet: window.L,
                marked: window.marked,
                xterm: window.Terminal,
                purify: window.DOMPurify
            },
            createFloatingPanel: function(title, options = {}) {
                const panel = document.createElement('div');
                panel.className = 'argus-floating-panel';
                panel.style.cssText = `
                    position:fixed; top:100px; left:100px; width:600px; height:400px;
                    background:var(--bg); border:2px solid var(--accent); border-radius:8px;
                    box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:9999; display:flex; flex-direction:column;
                `;
                panel.innerHTML = `
                    <div style="padding:8px; background:var(--accent); color:white; cursor:move; display:flex; justify-content:space-between;">
                        <span>${title}</span>
                        <button onclick="this.closest('.argus-floating-panel').remove()">×</button>
                    </div>
                    <div class="panel-content" style="flex:1; padding:16px; overflow:auto;"></div>
                `;
                document.body.appendChild(panel);

                // Make draggable (reuse exact pattern from reporting/trawl)
                let isDragging = false;
                let offsetX, offsetY;
                const header = panel.querySelector('div');
                header.onmousedown = (e) => { isDragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; };
                document.onmousemove = (e) => {
                    if (isDragging) {
                        panel.style.left = (e.clientX - offsetX) + 'px';
                        panel.style.top = (e.clientY - offsetY) + 'px';
                    }
                };
                document.onmouseup = () => isDragging = false;

                return {
                    element: panel.querySelector('.panel-content'),
                    close: () => panel.remove()
                };
            }
        };
    }
};
