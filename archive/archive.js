// archive.js — standalone Archive Redirect page
const el = {
  archiveEnabled: document.getElementById("archive-enabled"),
  archiveProvider: document.getElementById("archive-provider"),
  archiveCustomUrl: document.getElementById("archive-custom-url"),
  archiveCustomGroup: document.getElementById("archive-custom-group"),
  archiveDomains: document.getElementById("archive-domains"),
  archiveSave: document.getElementById("archive-save"),
  archiveReset: document.getElementById("archive-reset"),
  archiveStatus: document.getElementById("archive-status"),
};

async function loadArchiveSettings() {
  const resp = await browser.runtime.sendMessage({ action: "getArchiveSettings" });
  if (!resp || !resp.success) return;
  el.archiveEnabled.checked = resp.enabled;
  el.archiveDomains.value = (resp.domains || []).join("\n");
  const providerUrl = resp.providerUrl || "https://archive.is/";
  const knownOptions = [...el.archiveProvider.options].map(o => o.value);
  if (knownOptions.includes(providerUrl)) {
    el.archiveProvider.value = providerUrl;
  } else {
    el.archiveProvider.value = "custom";
    el.archiveCustomUrl.value = providerUrl;
    el.archiveCustomGroup.style.display = "";
  }
  const { archiveCheckMode, waybackCheckMode } = await browser.storage.local.get({ archiveCheckMode: "off", waybackCheckMode: "off" });
  document.getElementById("archive-check-mode").value = archiveCheckMode;
  document.getElementById("wayback-check-mode").value = waybackCheckMode ?? "off";
  el.archiveProvider.addEventListener("change", () => {
    el.archiveCustomGroup.style.display = el.archiveProvider.value === "custom" ? "" : "none";
  });
}

async function saveArchiveSettings() {
  const enabled = el.archiveEnabled.checked;
  if (enabled) {
    const granted = await browser.permissions.request({
      permissions: ["webRequest", "webRequestBlocking"]
    });
    if (!granted) {
      el.archiveStatus.textContent = "Permission denied — redirect requires webRequest permission.";
      el.archiveStatus.style.color = "var(--error)";
      el.archiveEnabled.checked = false;
      setTimeout(() => { el.archiveStatus.textContent = ""; }, 4000);
      return;
    }
  }
  const domains = el.archiveDomains.value
    .split("\n")
    .map(d => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
  const providerUrl = el.archiveProvider.value === "custom"
    ? el.archiveCustomUrl.value.trim()
    : el.archiveProvider.value;
  await browser.runtime.sendMessage({ action: "saveArchiveSettings", enabled, domains, providerUrl });
  await browser.storage.local.set({
    archiveCheckMode: document.getElementById("archive-check-mode").value,
    waybackCheckMode: document.getElementById("wayback-check-mode").value
  });
  el.archiveStatus.textContent = "Saved!";
  el.archiveStatus.style.color = "var(--success)";
  setTimeout(() => { el.archiveStatus.textContent = ""; }, 2000);
}

async function resetArchiveSettings() {
  el.archiveDomains.value = [
    "cnn.com", "nytimes.com", "washingtonpost.com", "wsj.com",
    "bloomberg.com", "reuters.com", "bbc.com", "theguardian.com",
    "forbes.com", "businessinsider.com", "wired.com", "townhall.com",
    "theatlantic.com", "newyorker.com", "theepochtimes.com",
    "latimes.com", "usatoday.com", "politico.com", "thedailybeast.com",
    "vanityfair.com", "ft.com", "economist.com", "newsweek.com", "time.com"
  ].join("\n");
  el.archiveEnabled.checked = false;
  el.archiveProvider.value = "https://archive.is/";
  el.archiveCustomGroup.style.display = "none";
  el.archiveStatus.textContent = "Reset to defaults (not saved yet)";
  el.archiveStatus.style.color = "var(--text-muted)";
  setTimeout(() => { el.archiveStatus.textContent = ""; }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  loadArchiveSettings();
  el.archiveSave.addEventListener("click", saveArchiveSettings);
  el.archiveReset.addEventListener("click", resetArchiveSettings);
});
