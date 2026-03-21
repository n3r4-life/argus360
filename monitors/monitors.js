// monitors.js — standalone Monitors page for Argus
// ──────────────────────────────────────────────

// ── Default presets (mirrors background.js) ──
const DEFAULT_PRESETS = {
  summary:     { label: "Summary" },
  sentiment:   { label: "Sentiment Analysis" },
  factcheck:   { label: "Fact-Check" },
  keypoints:   { label: "Key Points" },
  eli5:        { label: "ELI5" },
  critique:    { label: "Critical Analysis" },
  actionitems: { label: "Action Items" },
  research:    { label: "Research Report" }
};

// ── Local element cache ──
const el = {};

// ──────────────────────────────────────────────
// Interval stepper utilities
// ──────────────────────────────────────────────
const INTERVAL_STEPS = [
  1, 2, 3, 4, 5, 10, 15, 30, 45,
  60, 75, 90, 180, 360, 720,
  1440, 2160, 2880, 4320,
  10080, 20160, 43200
];

function formatInterval(mins) {
  if (mins >= 43200) return `${Math.round(mins / 43200)}mo`;
  if (mins >= 10080) return `${Math.round(mins / 10080)}w`;
  if (mins >= 1440) return `${(mins / 1440).toFixed(mins % 1440 ? 1 : 0).replace(/\.0$/, "")}d`;
  if (mins >= 60) return `${(mins / 60).toFixed(mins % 60 ? 1 : 0).replace(/\.0$/, "")}h`;
  return `${mins}m`;
}

function nearestStepIndex(mins) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < INTERVAL_STEPS.length; i++) {
    const d = Math.abs(INTERVAL_STEPS[i] - mins);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function initIntervalStepper(containerId, hiddenId, displayId, initialMins) {
  const container = document.getElementById(containerId);
  const hidden = document.getElementById(hiddenId);
  const display = document.getElementById(displayId);
  if (!container || !hidden || !display) return;

  let idx = nearestStepIndex(initialMins || 60);
  hidden.value = INTERVAL_STEPS[idx];
  display.textContent = formatInterval(INTERVAL_STEPS[idx]);

  container.querySelectorAll(".interval-step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = parseInt(btn.dataset.dir);
      idx = Math.max(0, Math.min(INTERVAL_STEPS.length - 1, idx + dir));
      hidden.value = INTERVAL_STEPS[idx];
      display.textContent = formatInterval(INTERVAL_STEPS[idx]);
    });
  });

  return {
    getValue: () => INTERVAL_STEPS[idx],
    setValue: (mins) => {
      idx = nearestStepIndex(mins);
      hidden.value = INTERVAL_STEPS[idx];
      display.textContent = formatInterval(INTERVAL_STEPS[idx]);
    }
  };
}

function createInlineIntervalStepper(currentMins, onChange) {
  const outer = document.createElement("div");
  outer.style.cssText = "display:inline-flex;flex-direction:column;align-items:center;gap:2px;";

  const wrap = document.createElement("div");
  wrap.className = "interval-stepper";
  wrap.title = "Pause & resume for new interval to take effect";

  let idx = nearestStepIndex(currentMins || 60);
  const origIdx = idx;

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "interval-step-btn";
  downBtn.textContent = "\u25BE";

  const display = document.createElement("span");
  display.className = "interval-display";
  display.textContent = formatInterval(INTERVAL_STEPS[idx]);

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "interval-step-btn";
  upBtn.textContent = "\u25B4";

  const hint = document.createElement("span");
  hint.style.cssText = "font-size:10px;color:var(--accent);opacity:0;transition:opacity 0.3s;white-space:nowrap;";
  hint.textContent = "pause & resume to apply";

  function step(dir) {
    idx = Math.max(0, Math.min(INTERVAL_STEPS.length - 1, idx + dir));
    display.textContent = formatInterval(INTERVAL_STEPS[idx]);
    if (onChange) onChange(INTERVAL_STEPS[idx]);
    hint.style.opacity = idx !== origIdx ? "1" : "0";
  }

  downBtn.addEventListener("click", () => step(-1));
  upBtn.addEventListener("click", () => step(1));

  wrap.appendChild(downBtn);
  wrap.appendChild(display);
  wrap.appendChild(upBtn);
  outer.appendChild(wrap);
  outer.appendChild(hint);
  return outer;
}

// ──────────────────────────────────────────────
// Populate dropdowns
// ──────────────────────────────────────────────
async function populateMonitorPresetDropdown() {
  while (el.monitorPreset.options.length > 1) el.monitorPreset.remove(1);
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    el.monitorPreset.appendChild(opt);
  }
  const { customPresets } = await browser.storage.local.get({ customPresets: {} });
  for (const [key, preset] of Object.entries(customPresets)) {
    if (preset.isCustom) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = preset.label || key;
      el.monitorPreset.appendChild(opt);
    }
  }
}

async function populateMonitorAutomationDropdown() {
  while (el.monitorAutomation.options.length > 1) el.monitorAutomation.remove(1);
  try {
    const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
    if (resp?.success && resp.automations) {
      for (const auto of resp.automations) {
        if (auto.enabled === false) continue;
        const opt = document.createElement("option");
        opt.value = auto.id;
        opt.textContent = auto.name;
        el.monitorAutomation.appendChild(opt);
      }
    }
  } catch { /* ignore */ }
}

async function populateMonitorProjectDropdown() {
  if (!el.monitorProjectSelect) return;
  while (el.monitorProjectSelect.options.length > 1) el.monitorProjectSelect.remove(1);
  try {
    const resp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (resp?.success && resp.projects) {
      for (const proj of resp.projects) {
        const opt = document.createElement("option");
        opt.value = proj.id;
        opt.textContent = proj.name;
        el.monitorProjectSelect.appendChild(opt);
      }
    }
  } catch { /* ignore */ }
}

async function populateDefaultProjectDropdown() {
  const sel = el.monitorDefaultProject;
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  try {
    const [projResp, overrides] = await Promise.all([
      browser.runtime.sendMessage({ action: "getProjects" }),
      browser.runtime.sendMessage({ action: "getFeatureProjectOverrides" })
    ]);
    if (projResp?.success && projResp.projects) {
      for (const p of projResp.projects) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      }
    }
    sel.value = overrides?.monitorDefaultProjectId || "";
    sel.addEventListener("change", () => {
      browser.runtime.sendMessage({
        action: "setFeatureProjectOverride",
        key: "monitorDefaultProjectId",
        projectId: sel.value || null
      });
    });
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Render monitors
// ──────────────────────────────────────────────
async function renderMonitors() {
  const response = await browser.runtime.sendMessage({ action: "getMonitors" });
  if (!response || !response.success) return;

  el.monitorList.replaceChildren();

  if (!response.monitors.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "No page monitors configured.";
    el.monitorList.appendChild(empty);
    return;
  }

  // Build URL -> project map for monitor-project association
  const monUrlToProjects = new Map();
  try {
    const projResp = await browser.runtime.sendMessage({ action: "getProjects" });
    if (projResp?.success) {
      for (const proj of projResp.projects) {
        for (const item of (proj.items || [])) {
          if (!item.url) continue;
          if (!monUrlToProjects.has(item.url)) monUrlToProjects.set(item.url, []);
          const existing = monUrlToProjects.get(item.url);
          if (!existing.some(p => p.id === proj.id)) {
            existing.push({ id: proj.id, name: proj.name, color: proj.color || "#a0a0b0" });
          }
        }
      }
    }
  } catch { /* ignore */ }

  response.monitors.forEach(monitor => {
    const row = document.createElement("div");
    row.className = "rule-item";
    row.style.flexWrap = "wrap";

    const info = document.createElement("div");
    info.className = "rule-info";

    const title = document.createElement("strong");
    const titleLink = document.createElement("a");
    titleLink.href = monitor.url;
    titleLink.textContent = monitor.title || monitor.url;
    titleLink.className = "monitor-title-link";
    titleLink.style.cssText = "color:var(--text-primary);text-decoration:none;";
    titleLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(monitor.url, "_blank");
    });
    titleLink.addEventListener("mouseenter", () => { titleLink.style.color = "var(--accent-hover)"; titleLink.style.textDecoration = "underline"; });
    titleLink.addEventListener("mouseleave", () => { titleLink.style.color = "var(--text-primary)"; titleLink.style.textDecoration = "none"; });
    title.appendChild(titleLink);
    info.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "rule-meta";
    const interval = monitor.intervalMinutes >= 60
      ? `${monitor.intervalMinutes / 60}h`
      : `${monitor.intervalMinutes}m`;
    const flags = [];
    if (monitor.autoOpen) flags.push("auto-open");
    if (monitor.autoBookmark) flags.push("bookmarked");
    if (monitor.analysisPreset) flags.push(`preset: ${monitor.analysisPreset}`);
    if (monitor.automationId) flags.push("automation");
    const flagStr = flags.length ? ` | ${flags.join(", ")}` : "";
    let durationStr = "";
    if (monitor.expired) {
      durationStr = " | EXPIRED";
    } else if (monitor.expiresAt) {
      const remaining = new Date(monitor.expiresAt).getTime() - Date.now();
      if (remaining > 0) {
        const hrs = Math.round(remaining / 3600000);
        durationStr = hrs >= 24 ? ` | ${Math.round(hrs / 24)}d left` : ` | ${hrs}h left`;
      } else {
        durationStr = " | EXPIRED";
      }
    }
    meta.textContent = ` — ${interval} interval | ${monitor.changeCount} changes | Last: ${new Date(monitor.lastChecked).toLocaleString()}${flagStr}${durationStr}`;
    info.appendChild(meta);

    if (monitor.lastChangeSummary) {
      const summaryWrap = document.createElement("div");
      summaryWrap.style.marginTop = "4px";

      const isLong = monitor.lastChangeSummary.length > 280;
      const summaryPreview = document.createElement("span");
      summaryPreview.className = "rule-meta";
      summaryPreview.style.display = "block";
      summaryPreview.style.color = "var(--accent)";
      summaryPreview.style.fontStyle = "italic";
      summaryPreview.textContent = isLong
        ? `Latest: ${monitor.lastChangeSummary.slice(0, 280)}...`
        : `Latest: ${monitor.lastChangeSummary}`;
      summaryWrap.appendChild(summaryPreview);

      if (isLong) {
        const summaryFull = document.createElement("span");
        summaryFull.className = "rule-meta hidden";
        summaryFull.style.display = "none";
        summaryFull.style.color = "var(--accent)";
        summaryFull.style.fontStyle = "italic";
        summaryFull.style.whiteSpace = "pre-wrap";
        summaryFull.textContent = `Latest: ${monitor.lastChangeSummary}`;
        summaryWrap.appendChild(summaryFull);

        const expandBtn = document.createElement("button");
        expandBtn.className = "pill-chip";
        expandBtn.style.cssText = "background:none;border:none;color:var(--text-secondary);font-size:11px;padding:2px 0;cursor:pointer;text-decoration:underline;";
        expandBtn.textContent = "Show full analysis";
        expandBtn.addEventListener("click", () => {
          const isExpanded = summaryFull.style.display !== "none";
          summaryPreview.style.display = isExpanded ? "block" : "none";
          summaryFull.style.display = isExpanded ? "none" : "block";
          expandBtn.textContent = isExpanded ? "Show full analysis" : "Collapse";
        });
        summaryWrap.appendChild(expandBtn);
      }

      info.appendChild(summaryWrap);
    }

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "pill-chip";
    toggleBtn.textContent = monitor.enabled ? "Pause" : "Resume";
    toggleBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        enabled: !monitor.enabled
      });
      renderMonitors();
    });

    const autoOpenBtn = document.createElement("button");
    autoOpenBtn.className = `pill-chip${monitor.autoOpen ? " active" : ""}`;
    autoOpenBtn.textContent = monitor.autoOpen ? "Auto-open: ON" : "Auto-open: OFF";
    autoOpenBtn.title = "Automatically open the page in a new tab when a change is detected";
    autoOpenBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        autoOpen: !monitor.autoOpen
      });
      renderMonitors();
    });

    const intervalStepper = createInlineIntervalStepper(monitor.intervalMinutes, async (newMins) => {
      await browser.runtime.sendMessage({
        action: "updateMonitor",
        id: monitor.id,
        intervalMinutes: newMins
      });
    });

    const historyBtn = document.createElement("button");
    historyBtn.className = "pill-chip";
    historyBtn.textContent = "Changes";
    historyBtn.title = "View detected changes and compare snapshots";
    historyBtn.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL(`monitors/monitor-history.html?id=${encodeURIComponent(monitor.id)}&title=${encodeURIComponent(monitor.title || monitor.url)}`)
      });
    });

    const timelineBtn = document.createElement("button");
    timelineBtn.className = "pill-chip";
    timelineBtn.textContent = "Timeline";
    timelineBtn.title = "View full page snapshots over time";
    timelineBtn.addEventListener("click", () => {
      browser.tabs.create({
        url: browser.runtime.getURL(`monitors/monitor-history.html?id=${encodeURIComponent(monitor.id)}&title=${encodeURIComponent(monitor.title || monitor.url)}&view=timeline`)
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "pill-chip";
    deleteBtn.style.color = "var(--error)";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "deleteMonitor", id: monitor.id });
      renderMonitors();
    });

    const snapBtn = document.createElement("button");
    snapBtn.className = "pill-chip";
    snapBtn.textContent = "Snapshot & Analyze";
    snapBtn.title = "Take a snapshot now and run analysis on the current page content";
    snapBtn.addEventListener("click", async () => {
      snapBtn.textContent = "Snapshotting...";
      snapBtn.disabled = true;
      try {
        const snapResp = await browser.runtime.sendMessage({
          action: "snapshotAndAnalyzeMonitor",
          monitorId: monitor.id,
          url: monitor.url,
          title: monitor.title || monitor.url,
        });
        if (snapResp?.success) {
          snapBtn.textContent = "Done!";
          snapBtn.style.color = "var(--success)";
          setTimeout(() => { renderMonitors(); }, 1500);
        } else {
          snapBtn.textContent = snapResp?.error || "Failed";
          snapBtn.style.color = "var(--error)";
          setTimeout(() => { snapBtn.textContent = "Snapshot & Analyze"; snapBtn.style.color = ""; snapBtn.disabled = false; }, 2500);
        }
      } catch (e) {
        snapBtn.textContent = "Error";
        snapBtn.style.color = "var(--error)";
        setTimeout(() => { snapBtn.textContent = "Snapshot & Analyze"; snapBtn.style.color = ""; snapBtn.disabled = false; }, 2500);
      }
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(autoOpenBtn);
    actions.appendChild(snapBtn);
    actions.appendChild(intervalStepper);
    actions.appendChild(historyBtn);
    actions.appendChild(timelineBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);

    // Project association tags
    const monProjects = monUrlToProjects.get(monitor.url);
    if (monProjects && monProjects.length) {
      const tagsDiv = document.createElement("div");
      tagsDiv.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;width:100%;padding-top:6px;border-top:1px solid var(--border);margin-top:6px;";
      for (const proj of monProjects) {
        const tag = document.createElement("span");
        tag.style.cssText = "display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:1px 8px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--text-secondary);white-space:nowrap;cursor:pointer;";
        tag.title = `Open project: ${proj.name}`;
        const dot = document.createElement("span");
        dot.style.cssText = `width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${proj.color};`;
        tag.appendChild(dot);
        tag.appendChild(document.createTextNode(proj.name));
        tag.addEventListener("click", () => {
          window.location.href = browser.runtime.getURL("projects/projects.html");
        });
        tagsDiv.appendChild(tag);
      }
      row.appendChild(tagsDiv);
    }
    el.monitorList.appendChild(row);
  });

  updateMonitorStorageUsage();
}

// ──────────────────────────────────────────────
// Storage usage bar
// ──────────────────────────────────────────────
async function updateMonitorStorageUsage() {
  try {
    const resp = await browser.runtime.sendMessage({ action: "getMonitorStorageUsage" });
    if (!resp || !resp.success) return;
    const idbBytes = resp.totalBytes - (resp.opfsBytes || 0);
    const idbMb = idbBytes / (1024 * 1024);
    const opfsMb = (resp.opfsBytes || 0) / (1024 * 1024);
    const maxMb = 10;
    const pct = Math.min(100, (idbMb / maxMb) * 100);
    el.monitorStorageBar.style.display = "";
    el.monitorStorageLabel.textContent = opfsMb > 0.01
      ? `${idbMb.toFixed(2)} MB data + ${opfsMb.toFixed(1)} MB snapshots`
      : `${idbMb.toFixed(2)} MB`;
    el.monitorStorageFill.style.width = `${pct}%`;
    el.monitorStorageFill.style.background = pct > 80 ? "var(--error)" : pct > 50 ? "var(--accent)" : "var(--success)";

    const manageLink = document.getElementById("monitor-storage-manage");
    if (manageLink && !manageLink._wired) {
      manageLink._wired = true;
      manageLink.addEventListener("click", (e) => {
        e.preventDefault();
        // Navigate to options settings page for storage management
        window.location.href = browser.runtime.getURL("options/options.html#settings");
      });
    }
  } catch { /* non-critical */ }
}

// ──────────────────────────────────────────────
// Add monitor
// ──────────────────────────────────────────────
async function addMonitor() {
  const url = el.monitorUrl.value.trim();
  if (!url) return;

  el.addMonitor.disabled = true;
  el.monitorStatus.textContent = "Adding monitor...";

  const response = await browser.runtime.sendMessage({
    action: "addMonitor",
    url,
    title: el.monitorTitle.value.trim() || "",
    intervalMinutes: parseInt(el.monitorInterval.value, 10) || 60,
    duration: parseInt(el.monitorDuration.value, 10) || 0,
    aiAnalysis: el.monitorAi.checked,
    autoOpen: el.monitorAutoOpen.checked,
    autoBookmark: el.monitorAutoBookmark.checked,
    analysisPreset: el.monitorPreset.value || "",
    automationId: el.monitorAutomation.value || "",
    projectId: el.monitorProjectSelect?.value || ""
  });

  el.addMonitor.disabled = false;

  if (response && response.success) {
    el.monitorUrl.value = "";
    el.monitorTitle.value = "";
    el.monitorStatus.textContent = "Monitor added!";
    el.monitorStatus.style.color = "var(--success)";
    renderMonitors();
  } else {
    el.monitorStatus.textContent = response?.error || "Failed to add monitor.";
    el.monitorStatus.style.color = "var(--error)";
  }

  setTimeout(() => { el.monitorStatus.textContent = ""; }, 3000);
}

// ──────────────────────────────────────────────
// Init on DOMContentLoaded
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Populate element cache
  el.monitorUrl            = document.getElementById("monitor-url");
  el.monitorInterval       = document.getElementById("monitor-interval");
  el.monitorTitle          = document.getElementById("monitor-title");
  el.monitorAi             = document.getElementById("monitor-ai");
  el.monitorAutoOpen       = document.getElementById("monitor-auto-open");
  el.monitorAutoBookmark   = document.getElementById("monitor-auto-bookmark");
  el.monitorDuration       = document.getElementById("monitor-duration");
  el.monitorPreset         = document.getElementById("monitor-preset");
  el.monitorAutomation     = document.getElementById("monitor-automation");
  el.monitorProjectSelect  = document.getElementById("monitor-project-select");
  el.monitorDefaultProject = document.getElementById("monitor-default-project");
  el.addMonitor            = document.getElementById("add-monitor");
  el.monitorStatus         = document.getElementById("monitor-status");
  el.monitorList           = document.getElementById("monitor-list");
  el.monitorStorageBar     = document.getElementById("monitor-storage-bar");
  el.monitorStorageLabel   = document.getElementById("monitor-storage-label");
  el.monitorStorageFill    = document.getElementById("monitor-storage-fill");

  // Init interval stepper
  initIntervalStepper("monitor-interval-stepper", "monitor-interval", "monitor-interval-display", 60);

  // Populate dropdowns
  populateMonitorPresetDropdown();
  populateMonitorAutomationDropdown();
  populateMonitorProjectDropdown();
  populateDefaultProjectDropdown();

  // Render existing monitors
  renderMonitors();

  // Wire up buttons
  el.addMonitor.addEventListener("click", addMonitor);
  document.getElementById("mon-refresh").addEventListener("click", renderMonitors);
});
