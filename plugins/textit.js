// plugins/textit.js
// Second real plugin from the 70 – uses existing XMPP client for live chat panel

window.ArgusPluginRegistry.registerPlugin({
    id: 'textit',
    name: 'Argus TextIt (XMPP/SMS)',
    version: '1.0',
    category: 'communication',
    requires: ['vault'],
    init: async (context) => {
        console.log('📱 TextIt XMPP gateway initialized');
    },
    run: async (input, context) => {
        // Only open panel if Vault is unlocked (per security rule)
        if (!context.vault) {
            alert('Vault must be unlocked to use TextIt');
            return 'Vault locked';
        }

        const panel = await window.ArgusPluginRegistry.createPanel('textit', 'TextIt XMPP/SMS Chat');
        const chatContainer = document.createElement('div');
        chatContainer.style.width = '100%';
        chatContainer.style.height = '100%';
        panel.element.appendChild(chatContainer);

        // Reuse existing chat/ patterns + xmpp-client (stub for now, full connect in Phase 2)
        chatContainer.innerHTML = `
            <div style="height:100%; display:flex; flex-direction:column;">
                <div id="xmpp-messages" style="flex:1; overflow:auto; padding:10px; background:#111;"></div>
                <input id="xmpp-input" style="padding:10px;" placeholder="Type message or SMS...">
            </div>
        `;

        // Simple echo test using existing messaging
        const inputField = chatContainer.querySelector('#xmpp-input');
        inputField.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const msg = inputField.value;
                const messagesDiv = chatContainer.querySelector('#xmpp-messages');
                messagesDiv.innerHTML += `<div style="color:#0f0;">You: ${msg}</div>`;
                inputField.value = '';

                // Simulate XMPP reply (real connection added later)
                setTimeout(() => {
                    messagesDiv.innerHTML += `<div style="color:#0af;">TextIt: Echo - ${msg}</div>`;
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }, 300);
            }
        });

        return 'Real TextIt XMPP/SMS panel opened';
    }
});
