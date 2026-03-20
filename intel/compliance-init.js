// compliance-init.js — extracted inline scripts for MV3 CSP compliance
IntelDomainShell.init("compliance", ["opensanctions", "csl", "eusanctions", "pepscreen", "samgov", "courtlistener", "uspto", "patentsview", "lensorg", "pqai"]);
if (typeof AssetLibrary !== "undefined") {
  AssetLibrary.init({ pageId: "compliance", tabs: ["result", "source", "entity"] });
}
if (typeof XmppChat !== "undefined") {
      XmppChat.init({ container: document.getElementById("xmpp-chat-container"), pageId: "intel-compliance" });
    }
