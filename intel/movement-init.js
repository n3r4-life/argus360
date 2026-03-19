// movement-init.js — extracted inline scripts for MV3 CSP compliance
IntelDomainShell.init("movement", ["opensky", "adsbexchange", "marinetraffic", "broadcastify"]);
if (typeof XmppChat !== "undefined") {
      XmppChat.init({ container: document.getElementById("xmpp-chat-container"), pageId: "intel-movement" });
    }
