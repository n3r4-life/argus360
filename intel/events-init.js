// events-init.js — extracted inline scripts for MV3 CSP compliance
IntelDomainShell.init("events", ["gdelt"]);
if (typeof XmppChat !== "undefined") {
      XmppChat.init({ container: document.getElementById("xmpp-chat-container"), pageId: "intel-events" });
    }
