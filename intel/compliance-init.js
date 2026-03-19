// compliance-init.js — extracted inline scripts for MV3 CSP compliance
IntelDomainShell.init("compliance", ["opensanctions", "courtlistener"]);
if (typeof XmppChat !== "undefined") {
      XmppChat.init({ container: document.getElementById("xmpp-chat-container"), pageId: "intel-compliance" });
    }
