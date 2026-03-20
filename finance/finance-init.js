// finance-init.js — extracted inline scripts for MV3 CSP compliance
if (typeof AssetLibrary !== "undefined") {
  AssetLibrary.init({ pageId: "finance", tabs: ["organization", "person", "document", "address", "link", "snippet"] });
}
if (typeof XmppChat !== "undefined") {
  XmppChat.init({ container: document.getElementById("xmpp-chat-container"), pageId: "finance" });
}
