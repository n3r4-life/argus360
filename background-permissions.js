// ──────────────────────────────────────────────
// Optional permission helpers
// ──────────────────────────────────────────────
// Features that use optional permissions check before registering listeners.
// If the permission isn't granted, the feature is silently skipped.

async function hasPermission(perm) {
  try {
    return await browser.permissions.contains({ permissions: [perm] });
  } catch {
    return false;
  }
}

async function requestPermission(perm) {
  try {
    return await browser.permissions.request({ permissions: [perm] });
  } catch {
    return false;
  }
}

// Safe notification helper — silently skips if permission not granted
async function safeNotify(id, opts) {
  if (await hasPermission("notifications")) {
    if (id) return browser.notifications.create(id, opts);
    return browser.notifications.create(opts);
  }
}

// Register webNavigation listener only if permission is available
async function initWebNavigation(callback) {
  if (await hasPermission("webNavigation")) {
    browser.webNavigation.onCompleted.addListener(callback);
    return true;
  }
  return false;
}

// Register webRequest listener only if permission is available
async function initWebRequestBlocking(callback, filter, extraInfo) {
  if (await hasPermission("webRequest") && await hasPermission("webRequestBlocking")) {
    browser.webRequest.onBeforeRequest.addListener(callback, filter, extraInfo);
    return true;
  }
  return false;
}
