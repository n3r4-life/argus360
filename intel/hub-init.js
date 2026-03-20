// hub-init.js — extracted inline scripts for MV3 CSP compliance
if (typeof AssetLibrary !== "undefined") {
  AssetLibrary.init({ pageId: "hub" });
}
if (typeof XmppChat !== "undefined") {
  XmppChat.init({ container: document.getElementById("xmpp-chat-container"), pageId: "intel-hub" });
}

