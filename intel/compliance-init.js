// compliance-init.js — extracted inline scripts for MV3 CSP compliance
IntelDomainShell.init("compliance", ["opensanctions", "csl", "courtlistener"]);
if (typeof AssetLibrary !== "undefined") {
  AssetLibrary.init({ pageId: "compliance", tabs: ["source", "entity"] });
}
if (typeof XmppChat !== "undefined") {
      XmppChat.init({ container: document.getElementById("xmpp-chat-container"), pageId: "intel-compliance" });
    }
