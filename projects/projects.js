// ──────────────────────────────────────────────
// Argus — Projects Page
// Graduated from options console (Round 2)
// ──────────────────────────────────────────────

// Preset labels for batch analysis dropdown (mirrors DEFAULT_PRESETS keys from options-core.js)
const DEFAULT_PRESETS = {
  summary: { label: "Summary" },
  sentiment: { label: "Sentiment Analysis" },
  factcheck: { label: "Fact-Check" },
  keypoints: { label: "Key Points" },
  eli5: { label: "ELI5" },
  critique: { label: "Critical Analysis" },
  actionitems: { label: "Action Items" },
  research: { label: "Research Report" },
  latenight: { label: "Late Night Recap" },
  entities: { label: "Entity Extraction (OSINT)" },
  credibility: { label: "Source Credibility" },
  profile: { label: "Person/Org Profile" },
  mediabias: { label: "Media Bias Breakdown" },
  competitorintel: { label: "Competitor Intel" },
  financialanalysis: { label: "Financial Analysis" },
  supplychainrisk: { label: "Supply Chain Risk" },
  threatassessment: { label: "Threat Assessment" },
  crisismonitor: { label: "Crisis Monitor" },
  deepfakeflags: { label: "Deepfake / Manipulation Flags" },
  propaganda: { label: "Propaganda Detection" },
  influencermap: { label: "Influencer / Network Map" },
  technicalbreakdown: { label: "Technical Breakdown" },
  timeline: { label: "Timeline Reconstruction" },
  dataextraction: { label: "Data Extraction" },
  legalrisk: { label: "Legal / Regulatory Risk" },
  comparecontrast: { label: "Compare & Contrast" },
  narrativeanalysis: { label: "Narrative Analysis" },
  tldr: { label: "TLDR Briefing" }
};

const projState = {
  initialized: false,
  projects: [],
  activeProjectId: null,
  editingProjectId: null,
  editingItemId: null,
  query: "",
  defaultProjectId: null
};

const projEl = {};

function initProjects() {
  projState.initialized = true;
  projEl.search = document.getElementById("proj-search");
  projEl.sidebar = document.getElementById("proj-list");
  projEl.main = document.getElementById("proj-main");
  projEl.empty = document.getElementById("proj-empty");
  projEl.detail = document.getElementById("proj-detail");
  projEl.detailHeader = document.getElementById("proj-detail-header");
  projEl.itemsList = document.getElementById("proj-items-list");
  projEl.modal = document.getElementById("proj-modal");
  projEl.modalTitle = document.getElementById("proj-modal-title");
  projEl.modalName = document.getElementById("proj-modal-name");
  projEl.modalDesc = document.getElementById("proj-modal-desc");
  projEl.modalColor = document.getElementById("proj-modal-color");
  projEl.modalCloudSync = document.getElementById("proj-modal-cloud-sync");
  projEl.modalCloudProvider = document.getElementById("proj-modal-cloud-provider");
  projEl.itemModal = document.getElementById("proj-item-modal");
  projEl.itemNotes = document.getElementById("proj-item-notes");

  projEl.modalCloudSync.addEventListener("change", () => {
    projEl.modalCloudProvider.style.display = projEl.modalCloudSync.checked ? "block" : "none";
  });

  document.getElementById("proj-new").addEventListener("click", () => projOpenModal());
  document.getElementById("proj-refresh").addEventListener("click", () => projLoadProjects());
  document.getElementById("proj-import").addEventListener("click", projImport);
  document.getElementById("proj-export-all").addEventListener("click", projExportAll);
  document.getElementById("proj-add-note").addEventListener("click", () => projAddItem("note"));
  document.getElementById("proj-add-url").addEventListener("click", () => projAddItem("url"));
  document.getElementById("proj-export").addEventListener("click", () => projExportOne(projState.activeProjectId));
  document.getElementById("proj-modal-save").addEventListener("click", projSaveModal);
  document.getElementById("proj-modal-cancel").addEventListener("click", () => projEl.modal.classList.add("hidden"));
  document.getElementById("proj-item-save").addEventListener("click", projSaveItemNotes);
  document.getElementById("proj-item-cancel").addEventListener("click", () => projEl.itemModal.classList.add("hidden"));

  // Batch analysis — populate preset dropdown
  const batchSelect = document.getElementById("proj-batch-preset");
  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    batchSelect.appendChild(opt);
  }
  document.getElementById("proj-batch-run").addEventListener("click", projBatchAnalyze);

  projEl.search.addEventListener("input", () => {
    projState.query = projEl.search.value.trim().toLowerCase();
    projRenderSidebar();
  });

  // OSINT project tool buttons
  document.getElementById("proj-entity-extract").addEventListener("click", projRunEntityExtraction);
  document.getElementById("proj-connection-graph").addEventListener("click", projOpenConnectionGraph);
  document.getElementById("proj-heatmap").addEventListener("click", projOpenHeatmap);
  document.getElementById("proj-geomap").addEventListener("click", projOpenGeomap);
  document.getElementById("proj-timeline").addEventListener("click", projOpenTimeline);
  document.getElementById("proj-report").addEventListener("click", projGenerateReport);
  document.getElementById("proj-anomaly").addEventListener("click", projAnomalyScan);
  document.getElementById("proj-dashboard").addEventListener("click", projOpenDashboard);
  document.getElementById("proj-skeleton").addEventListener("click", projBuildSkeleton);
  document.getElementById("proj-workbench").addEventListener("click", async () => {
    if (!projCurrentId) return;
    const wbUrl = browser.runtime.getURL("workbench/workbench.html");
    const existing = await browser.tabs.query({ url: wbUrl + "*" });
    if (existing.length > 0) {
      await browser.tabs.update(existing[0].id, { active: true, url: `${wbUrl}?project=${projCurrentId}` });
      await browser.windows.update(existing[0].windowId, { focused: true });
    } else {
      await browser.tabs.create({ url: `${wbUrl}?project=${projCurrentId}` });
    }
  });

  projLoadProjects();
  checkRunningBatch();
}

async function checkRunningBatch() {
  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (s && s.success && s.running) {
      const runBtn = document.getElementById("proj-batch-run");
      const statusEl = document.getElementById("proj-batch-status");
      const progressEl = document.getElementById("proj-batch-progress");
      const barEl = document.getElementById("proj-batch-bar");
      const pctEl = document.getElementById("proj-batch-pct");
      runBtn.textContent = "Cancel";
      runBtn.onclick = projCancelBatch;
      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      progressEl.classList.remove("hidden", "proj-batch-done");
      barEl.style.width = pct + "%";
      pctEl.textContent = pct + "%";
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}`;
      batchPollTimer = setInterval(() => pollBatchStatus(), 1500);
    }
  } catch { /* ignore */ }
}

async function projLoadProjects() {
  const [resp, defResp] = await Promise.all([
    browser.runtime.sendMessage({ action: "getProjects" }),
    browser.runtime.sendMessage({ action: "getDefaultProject" })
  ]);
  projState.defaultProjectId = defResp?.defaultProjectId || null;
  if (resp && resp.success) {
    projState.projects = resp.projects;
    projRenderSidebar();
    if (projState.activeProjectId) {
      const still = projState.projects.find(p => p.id === projState.activeProjectId);
      if (still) projSelectProject(still.id);
      else projShowEmpty();
    }
  }
}

function projRenderSidebar() {
  let projects = projState.projects;
  if (projState.query) {
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(projState.query) ||
      (p.description || "").toLowerCase().includes(projState.query)
    );
  }
  // Starred first
  projects.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));

  if (projects.length === 0) {
    projEl.sidebar.innerHTML = "";
    const emptyP = document.createElement("p");
    emptyP.className = "info-text";
    emptyP.setAttribute("style", "padding:16px;text-align:center;");
    emptyP.textContent = projState.query ? "No matching projects." : 'No projects yet. Click "+ New Project" to get started.';
    projEl.sidebar.appendChild(emptyP);
    return;
  }

  projEl.sidebar.innerHTML = "";
  for (const proj of projects) {
    const item = document.createElement("div");
    item.className = "proj-list-item" + (proj.id === projState.activeProjectId ? " active" : "");
    const dotSpan = document.createElement("span");
    dotSpan.className = "proj-color-dot";
    dotSpan.setAttribute("style", "background:" + (proj.color || '#e94560'));
    const nameSpan = document.createElement("span");
    nameSpan.className = "proj-list-name";
    nameSpan.textContent = proj.name;
    if (proj.id === projState.defaultProjectId) {
      const defBadge = document.createElement("span");
      defBadge.className = "proj-default-badge";
      defBadge.textContent = "default";
      nameSpan.appendChild(defBadge);
    }
    const countSpan = document.createElement("span");
    countSpan.className = "proj-list-count";
    countSpan.textContent = proj.items.length;
    const starBtn = document.createElement("button");
    starBtn.className = "proj-star-btn" + (proj.starred ? " starred" : "");
    starBtn.dataset.id = proj.id;
    starBtn.title = "Star";
    starBtn.textContent = proj.starred ? '\u2605' : '\u2606';
    item.appendChild(dotSpan);
    item.appendChild(nameSpan);
    item.appendChild(countSpan);
    item.appendChild(starBtn);
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("proj-star-btn")) return;
      projSelectProject(proj.id);
    });
    starBtn.addEventListener("click", () => projToggleStar(proj.id));
    projEl.sidebar.appendChild(item);
  }
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function projShowEmpty() {
  projState.activeProjectId = null;
  projEl.empty.classList.remove("hidden");
  projEl.detail.classList.add("hidden");
}

function projSelectProject(id) {
  projState.activeProjectId = id;
  projEl.empty.classList.add("hidden");
  projEl.detail.classList.remove("hidden");
  projRenderSidebar();
  projRenderDetail();
}

function projRenderDetail() {
  const proj = projState.projects.find(p => p.id === projState.activeProjectId);
  if (!proj) return projShowEmpty();

  projEl.detailHeader.innerHTML = "";
  const titleDiv = document.createElement("div");
  titleDiv.className = "proj-detail-title";
  const detDot = document.createElement("span");
  detDot.className = "proj-color-dot";
  detDot.setAttribute("style", "background:" + (proj.color || '#e94560') + ";width:14px;height:14px;");
  const detH3 = document.createElement("h3");
  detH3.textContent = proj.name;
  const detStarBtn = document.createElement("button");
  detStarBtn.className = "proj-star-btn" + (proj.starred ? " starred" : "");
  detStarBtn.id = "proj-detail-star";
  detStarBtn.title = "Star";
  detStarBtn.textContent = proj.starred ? '\u2605' : '\u2606';
  titleDiv.appendChild(detDot);
  titleDiv.appendChild(detH3);
  titleDiv.appendChild(detStarBtn);
  projEl.detailHeader.appendChild(titleDiv);
  if (proj.description) {
    const descP = document.createElement("p");
    descP.className = "proj-detail-desc";
    descP.textContent = proj.description;
    projEl.detailHeader.appendChild(descP);
  }
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "proj-detail-actions";
  const editBtn2 = document.createElement("button");
  editBtn2.className = "btn btn-secondary btn-sm";
  editBtn2.id = "proj-edit-btn";
  editBtn2.textContent = "Edit";
  const deleteBtn2 = document.createElement("button");
  deleteBtn2.className = "btn btn-secondary btn-sm";
  deleteBtn2.id = "proj-delete-btn";
  deleteBtn2.textContent = "Delete";
  const defaultBtn = document.createElement("button");
  defaultBtn.className = "btn btn-secondary btn-sm";
  defaultBtn.id = "proj-default-btn";
  const isDefault = proj.id === projState.defaultProjectId;
  defaultBtn.textContent = isDefault ? "Default \u2713" : "Set as Default";
  if (isDefault) defaultBtn.setAttribute("style", "color:var(--accent);border-color:var(--accent);");
  const metaSpan = document.createElement("span");
  metaSpan.setAttribute("style", "font-size:11px;color:var(--text-muted);margin-left:auto;");
  metaSpan.textContent = proj.items.length + " items \u00B7 Updated " + new Date(proj.updatedAt).toLocaleDateString();
  actionsDiv.appendChild(editBtn2);
  actionsDiv.appendChild(defaultBtn);
  actionsDiv.appendChild(deleteBtn2);
  actionsDiv.appendChild(metaSpan);
  projEl.detailHeader.appendChild(actionsDiv);

  document.getElementById("proj-detail-star").addEventListener("click", () => projToggleStar(proj.id));
  document.getElementById("proj-edit-btn").addEventListener("click", () => projOpenModal(proj));
  document.getElementById("proj-delete-btn").addEventListener("click", () => projDelete(proj.id));
  document.getElementById("proj-default-btn").addEventListener("click", async () => {
    const newDefault = projState.defaultProjectId === proj.id ? null : proj.id;
    await browser.runtime.sendMessage({ action: "setDefaultProject", projectId: newDefault });
    projState.defaultProjectId = newDefault;
    projRenderSidebar();
    projRenderDetail();
  });

  // Populate automation toolbar for this project
  projPopulateAutomations(proj.id);

  // Auto-show skeleton overview
  projBuildSkeleton(true);

  projRenderItems(proj);
  projRenderDrafts(proj.id);
}

async function projPopulateAutomations(projectId) {
  const toolbar = document.getElementById("proj-automation-toolbar");
  const select = document.getElementById("proj-automation-select");
  const statusEl = document.getElementById("proj-automation-status");

  // Get all automations — show ones linked to this project + manual ones
  const resp = await browser.runtime.sendMessage({ action: "getAutomations" });
  const allAutos = (resp?.success ? resp.automations : []).filter(a => a.enabled);
  const relevant = allAutos.filter(a =>
    a.triggers?.manual || a.triggers?.projectId === projectId
  );

  if (!relevant.length) {
    toolbar.classList.add("hidden");
    return;
  }

  toolbar.classList.remove("hidden");
  select.replaceChildren();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select automation...";
  select.appendChild(defaultOpt);

  for (const auto of relevant) {
    const opt = document.createElement("option");
    opt.value = auto.id;
    opt.textContent = auto.name + (auto.triggers?.projectId === projectId ? " (linked)" : "");
    select.appendChild(opt);
  }

  // Run on All handler
  const runAllBtn = document.getElementById("proj-automation-run");
  const newRunAllBtn = runAllBtn.cloneNode(true);
  runAllBtn.parentNode.replaceChild(newRunAllBtn, runAllBtn);
  newRunAllBtn.addEventListener("click", async () => {
    const autoId = select.value;
    if (!autoId) { alert("Select an automation first."); return; }
    newRunAllBtn.disabled = true;
    newRunAllBtn.textContent = "Running...";
    statusEl.textContent = "Running automation on all project items...";
    try {
      const result = await browser.runtime.sendMessage({
        action: "runAutomationOnProject", automationId: autoId, projectId
      });
      statusEl.textContent = result.success
        ? `Done: ${result.succeeded}/${result.total} items succeeded.`
        : `Error: ${result.error}`;
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
    }
    newRunAllBtn.textContent = "Run on All";
    newRunAllBtn.disabled = false;
    loadAutomationLog();
  });
}

// Convert entity JSON summary to readable text for project cards
function projSummarizeForCard(text) {
  if (!text) return "";
  const trimmed = text.trim();

  // Try to find and parse JSON (may be raw, in code fences, or with surrounding text)
  let json = null;
  // Direct parse
  try { json = JSON.parse(trimmed); } catch {}
  // Strip code fences
  if (!json) {
    const fenced = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
    try { json = JSON.parse(fenced); } catch {}
  }
  // Find first { to last }
  if (!json) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { json = JSON.parse(trimmed.slice(start, end + 1)); } catch {}
    }
  }

  if (json && (json.people || json.organizations || json.locations || json.claims)) {
    const parts = [];
    if (json.people && json.people.length) {
      parts.push(`People: ${json.people.map(p => p.name).join(", ")}`);
    }
    if (json.organizations && json.organizations.length) {
      parts.push(`Orgs: ${json.organizations.map(o => o.name).join(", ")}`);
    }
    if (json.locations && json.locations.length) {
      parts.push(`Locations: ${json.locations.map(l => l.name).join(", ")}`);
    }
    if (json.claims && json.claims.length) {
      parts.push(`${json.claims.length} claim(s)`);
    }
    if (json.dates && json.dates.length) {
      parts.push(`${json.dates.length} date(s)`);
    }
    if (json.contact && json.contact.length) {
      parts.push(`${json.contact.length} contact(s)`);
    }
    if (parts.length) return parts.join(" | ");
  }

  // Fallback: if it looks like entity JSON but couldn't parse (truncated),
  // extract names via regex
  if (trimmed.startsWith("{") && /"name"\s*:/.test(trimmed)) {
    const names = [];
    const nameRe = /"name"\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = nameRe.exec(trimmed)) !== null) {
      names.push(m[1]);
    }
    if (names.length) {
      return `Entities found: ${names.join(", ")}`;
    }
  }

  // Not entity JSON — return as-is
  return trimmed;
}

function projRenderItems(proj) {
  projEl.itemsList.innerHTML = "";

  // Collapsible header for items section
  const analyzed = proj.items.filter(i => i.analysisContent || i.analysisPreset || (i.analyses && i.analyses.length));
  const links = proj.items.filter(i => !i.analysisContent && !i.analysisPreset && !(i.analyses && i.analyses.length));
  const headerDiv = document.createElement("div");
  headerDiv.className = "proj-items-collapse-header";
  headerDiv.innerHTML = `<span class="proj-items-collapse-arrow">&#9660;</span> <strong>Items (${proj.items.length})</strong><span style="margin-left:8px;font-size:11px;color:var(--text-muted);">${analyzed.length} analyzed &middot; ${links.length} links</span>`;
  const itemsContainer = document.createElement("div");
  itemsContainer.className = "proj-items-container";

  // Default: collapsed if skeleton is showing and there are items
  const skeletonPanel = document.getElementById("proj-skeleton-panel");
  if (proj.items.length > 0 && skeletonPanel && !skeletonPanel.classList.contains("hidden")) {
    itemsContainer.style.display = "none";
    headerDiv.querySelector(".proj-items-collapse-arrow").innerHTML = "&#9654;";
  }

  headerDiv.addEventListener("click", () => {
    const isHidden = itemsContainer.style.display === "none";
    itemsContainer.style.display = isHidden ? "" : "none";
    headerDiv.querySelector(".proj-items-collapse-arrow").innerHTML = isHidden ? "&#9660;" : "&#9654;";
  });
  projEl.itemsList.appendChild(headerDiv);
  projEl.itemsList.appendChild(itemsContainer);

  if (proj.items.length === 0) {
    const noItems = document.createElement("p");
    noItems.className = "info-text";
    noItems.style.cssText = "text-align:center;padding:32px;";
    noItems.textContent = "No items in this project yet. Add analyses from results pages, bookmarks, notes, or URLs.";
    itemsContainer.appendChild(noItems);
    return;
  }
  for (const item of proj.items) {
    const card = document.createElement("div");
    const isAnalyzed = !!(item.analysisContent || item.analysisPreset || (item.analyses && item.analyses.length));
    card.className = "proj-item-card" + (isAnalyzed ? "" : " unanalyzed");
    const bodyDiv = document.createElement("div");
    bodyDiv.className = "proj-item-body";
    const titleDiv2 = document.createElement("div");
    titleDiv2.className = "proj-item-title";
    if (item.url) {
      const titleLink = document.createElement("a");
      titleLink.href = item.url;
      titleLink.target = "_blank";
      titleLink.textContent = item.title || item.url;
      titleDiv2.appendChild(titleLink);
    } else {
      titleDiv2.textContent = item.title || "Untitled";
    }
    bodyDiv.appendChild(titleDiv2);
    if (item.url) {
      const urlDiv = document.createElement("div");
      urlDiv.className = "proj-item-url";
      urlDiv.textContent = item.url;
      bodyDiv.appendChild(urlDiv);
    }
    if (item.summary || item.analysisContent) {
      const summDiv = document.createElement("div");
      summDiv.className = "proj-item-summary";
      // Use full analysisContent first — summary may be truncated JSON that can't be parsed
      summDiv.textContent = projSummarizeForCard(item.analysisContent || item.summary).slice(0, 300);
      bodyDiv.appendChild(summDiv);
    }
    if (item.notes) {
      const notesDiv = document.createElement("div");
      notesDiv.className = "proj-item-notes";
      notesDiv.textContent = item.notes;
      bodyDiv.appendChild(notesDiv);
    }
    const metaDiv = document.createElement("div");
    metaDiv.className = "proj-item-meta";
    const analysisCount = item.analyses ? item.analyses.length : (item.analysisContent ? 1 : 0);
    const hasConversations = item.conversations && item.conversations.length > 0;
    if (analysisCount > 1) {
      const multiBadge = document.createElement("span");
      multiBadge.className = "proj-type-badge multi-analysis";
      multiBadge.textContent = `${analysisCount} analyses`;
      metaDiv.appendChild(multiBadge);
    } else if (item.analysisPreset) {
      const presetBadge = document.createElement("span");
      presetBadge.className = "proj-type-badge analysis";
      presetBadge.textContent = item.analysisPreset;
      metaDiv.appendChild(presetBadge);
    } else {
      const typeBadge = document.createElement("span");
      typeBadge.className = "proj-type-badge " + item.type;
      typeBadge.textContent = item.type;
      metaDiv.appendChild(typeBadge);
    }
    if (hasConversations) {
      const threadBadge = document.createElement("span");
      threadBadge.className = "proj-type-badge thread";
      threadBadge.textContent = item.conversations.length === 1 ? "thread" : `${item.conversations.length} threads`;
      metaDiv.appendChild(threadBadge);
    }
    if (item.pasteUrls && item.pasteUrls.length) {
      for (const p of item.pasteUrls) {
        const pasteLink = document.createElement("a");
        pasteLink.href = p.url;
        pasteLink.target = "_blank";
        pasteLink.className = "proj-type-badge paste";
        const svcNames = { gist: "Gist", pastebin: "Pastebin", privatebin: "PrivateBin" };
        pasteLink.textContent = svcNames[p.service] || "Paste";
        pasteLink.addEventListener("click", e => e.stopPropagation());
        metaDiv.appendChild(pasteLink);
      }
    }
    const dateSpan = document.createElement("span");
    dateSpan.textContent = new Date(item.addedAt).toLocaleDateString();
    metaDiv.appendChild(dateSpan);
    bodyDiv.appendChild(metaDiv);
    card.appendChild(bodyDiv);
    const actionsDiv2 = document.createElement("div");
    actionsDiv2.className = "proj-item-actions";
    if (item.analysisContent || item.refId) {
      const viewBtn2 = document.createElement("button");
      viewBtn2.className = "proj-item-view-btn";
      viewBtn2.title = "View analysis";
      viewBtn2.textContent = "View";
      actionsDiv2.appendChild(viewBtn2);
    }
    const noteBtn = document.createElement("button");
    noteBtn.className = "proj-item-note-btn";
    noteBtn.title = "Edit notes";
    noteBtn.textContent = "Notes";
    const removeBtn = document.createElement("button");
    removeBtn.className = "proj-item-remove-btn";
    removeBtn.title = "Remove from project";
    removeBtn.textContent = "Remove";
    if (item.url) {
      const autoBtn = document.createElement("button");
      autoBtn.className = "proj-item-auto-btn";
      autoBtn.title = "Run automation on this item";
      autoBtn.textContent = "Automate";
      autoBtn.addEventListener("click", async () => {
        const autoSelect = document.getElementById("proj-automation-select");
        const autoToolbar = document.getElementById("proj-automation-toolbar");
        const autoId = autoSelect?.value;
        if (!autoId) {
          if (autoToolbar?.classList.contains("hidden")) {
            alert("No automations available.\n\nCreate an automation on the Automate tab first, then enable 'Manual trigger' so it appears here.");
          } else {
            alert("Select an automation from the Automations toolbar above, then click this button.");
          }
          return;
        }
        autoBtn.disabled = true;
        autoBtn.textContent = "Running...";
        const statusEl = document.getElementById("proj-automation-status");
        statusEl.textContent = `Running on: ${item.title || item.url}`;
        try {
          const result = await browser.runtime.sendMessage({
            action: "runAutomationOnItem", automationId: autoId, projectId: proj.id,
            url: item.url, title: item.title
          });
          autoBtn.textContent = result.success ? "Done!" : "Failed";
          statusEl.textContent = result.success ? "Automation complete." : `Error: ${result.error}`;
        } catch (e) {
          autoBtn.textContent = "Error";
        }
        setTimeout(() => { autoBtn.textContent = "Automate"; autoBtn.disabled = false; }, 2000);
      });
      actionsDiv2.appendChild(autoBtn);
    }
    // Email share button
    const emailBtn = document.createElement("button");
    emailBtn.className = "proj-item-email-btn";
    emailBtn.title = "Email this item";
    emailBtn.textContent = "Email";
    emailBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pasteUrl = item.pasteUrls?.length ? item.pasteUrls[item.pasteUrls.length - 1].url : "";
      EmailShare.compose({
        subject: `${item.title || "Shared Item"} — ${proj.name}`,
        body: EmailShare.formatBody({
          summary: item.summary || (item.analysisContent || "").slice(0, 300),
          url: item.url,
          pasteUrl,
          content: item.analysisContent
        })
      });
    });
    actionsDiv2.appendChild(emailBtn);
    // Block button for auto-routed/feed items — prevents re-routing
    if (item.url && (item.type === "feed" || (item.tags && item.tags.includes("auto-routed")))) {
      const blockBtn = document.createElement("button");
      blockBtn.className = "proj-item-block-btn";
      blockBtn.title = "Remove & block from being re-routed to this project";
      blockBtn.textContent = "Block";
      blockBtn.style.color = "var(--error)";
      actionsDiv2.appendChild(blockBtn);
    }
    actionsDiv2.appendChild(noteBtn);
    actionsDiv2.appendChild(removeBtn);
    card.appendChild(actionsDiv2);

    async function openItemAnalysis() {
      let content = item.analysisContent;
      let preset = item.analysisPreset || "Analysis";

      // Backfill from history if content missing but we have a refId
      if (!content && item.refId) {
        try {
          const resp = await browser.runtime.sendMessage({ action: "getHistoryItem", id: item.refId });
          if (resp?.success && resp.entry?.content) {
            content = resp.entry.content;
            preset = resp.entry.presetLabel || resp.entry.preset || preset;
            item.analysisContent = content;
            item.analysisPreset = preset;
            await browser.runtime.sendMessage({
              action: "updateProjectItem",
              projectId: proj.id,
              itemId: item.id,
              analysisContent: content,
              analysisPreset: preset
            });
          }
        } catch (e) {
          console.warn("[Argus] Failed to fetch history for project item:", e);
        }
      }

      if (!content) {
        alert("Analysis content not found. The history entry may have been deleted.");
        return;
      }

      // Build stacked content: all analyses + saved conversations
      const analyses = item.analyses || [];
      let stackedContent = "";
      if (analyses.length > 1) {
        // Show all analyses with headers
        for (const a of analyses) {
          stackedContent += `## ${a.presetLabel || a.preset} — ${new Date(a.timestamp).toLocaleString()}\n\n${a.content}\n\n---\n\n`;
        }
      } else {
        stackedContent = content;
      }

      // Append saved conversations
      if (item.conversations && item.conversations.length) {
        for (const conv of item.conversations) {
          stackedContent += `\n\n---\n\n## Follow-up Thread — ${new Date(conv.timestamp).toLocaleString()}\n\n`;
          for (const msg of conv.messages) {
            if (msg.role === "user") stackedContent += `**You:** ${msg.content}\n\n`;
            else stackedContent += `${msg.content}\n\n`;
          }
        }
      }

      const resultId = `proj-view-${Date.now()}`;
      await browser.storage.local.set({
        [resultId]: {
          status: "done",
          content: stackedContent,
          pageTitle: item.title || item.url,
          pageUrl: item.url,
          presetLabel: analyses.length > 1 ? `${analyses.length} analyses` : preset,
          // Project context for "Save to Project" on follow-ups
          projectId: proj.id,
          projectItemId: item.id
        }
      });
      browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(resultId)}`) });
    }

    const viewBtn = card.querySelector(".proj-item-view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", openItemAnalysis);
    }

    // Make the card body clickable to view analysis
    if (item.analysisContent || item.refId) {
      bodyDiv.style.cursor = "pointer";
      bodyDiv.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        openItemAnalysis();
      });
    }

    card.querySelector(".proj-item-note-btn").addEventListener("click", () => {
      projState.editingItemId = item.id;
      projEl.itemNotes.value = item.notes || "";
      projEl.itemModal.classList.remove("hidden");
      projEl.itemNotes.focus();
    });

    card.querySelector(".proj-item-remove-btn").addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "removeProjectItem", projectId: proj.id, itemId: item.id });
      await projLoadProjects();
      projSelectProject(proj.id);
    });

    const blockBtn = card.querySelector(".proj-item-block-btn");
    if (blockBtn) {
      blockBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "removeProjectItem", projectId: proj.id, itemId: item.id, reject: true });
        await projLoadProjects();
        projSelectProject(proj.id);
      });
    }

    itemsContainer.appendChild(card);
  }

  // Render rejected URLs section if any exist
  if (proj.rejectedUrls && proj.rejectedUrls.length) {
    const rejDiv = document.createElement("div");
    rejDiv.style.cssText = "margin-top:16px;padding:10px 14px;background:var(--bg-primary);border:1px dashed var(--border);border-radius:var(--radius);";
    const rejHeader = document.createElement("div");
    rejHeader.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;cursor:pointer;";
    const rejTitle = document.createElement("span");
    rejTitle.style.cssText = "font-size:12px;font-weight:600;color:var(--text-muted);";
    rejTitle.textContent = `Blocked from routing (${proj.rejectedUrls.length})`;
    const rejToggle = document.createElement("span");
    rejToggle.style.cssText = "font-size:11px;color:var(--text-muted);";
    rejToggle.textContent = "Show";
    rejHeader.appendChild(rejTitle);
    rejHeader.appendChild(rejToggle);
    rejDiv.appendChild(rejHeader);

    const rejList = document.createElement("div");
    rejList.style.display = "none";
    for (const url of proj.rejectedUrls) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px;";
      const urlSpan = document.createElement("span");
      urlSpan.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);";
      urlSpan.textContent = url;
      urlSpan.title = url;
      const unblockBtn = document.createElement("button");
      unblockBtn.style.cssText = "background:none;border:1px solid var(--border);border-radius:3px;color:var(--text-secondary);cursor:pointer;font-size:10px;padding:2px 6px;flex-shrink:0;";
      unblockBtn.textContent = "Unblock";
      unblockBtn.addEventListener("click", async () => {
        await browser.runtime.sendMessage({ action: "unRejectProjectUrl", projectId: proj.id, url });
        await projLoadProjects();
        projSelectProject(proj.id);
      });
      row.appendChild(urlSpan);
      row.appendChild(unblockBtn);
      rejList.appendChild(row);
    }
    rejDiv.appendChild(rejList);

    rejHeader.addEventListener("click", () => {
      const showing = rejList.style.display !== "none";
      rejList.style.display = showing ? "none" : "";
      rejToggle.textContent = showing ? "Show" : "Hide";
    });

    itemsContainer.appendChild(rejDiv);
  }
}

async function projRenderDrafts(projectId) {
  const container = document.getElementById("proj-drafts-list");
  if (!container) return;
  container.innerHTML = "";

  const resp = await browser.runtime.sendMessage({ action: "draftGetAll" });
  if (!resp?.success) return;
  const drafts = (resp.drafts || []).filter(d => d.projectId === projectId);
  if (!drafts.length) return;

  // Sort by most recently updated
  drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const headerDiv = document.createElement("div");
  headerDiv.className = "proj-items-collapse-header";
  headerDiv.innerHTML = `<span class="proj-items-collapse-arrow">&#9660;</span> <strong>Drafts (${drafts.length})</strong>`;
  const draftsContainer = document.createElement("div");
  draftsContainer.className = "proj-items-container";

  headerDiv.addEventListener("click", () => {
    const isHidden = draftsContainer.style.display === "none";
    draftsContainer.style.display = isHidden ? "" : "none";
    headerDiv.querySelector(".proj-items-collapse-arrow").innerHTML = isHidden ? "&#9660;" : "&#9654;";
  });

  container.appendChild(headerDiv);
  container.appendChild(draftsContainer);

  for (const draft of drafts) {
    const card = document.createElement("div");
    card.className = "proj-item-card";
    const bodyDiv = document.createElement("div");
    bodyDiv.className = "proj-item-body";
    bodyDiv.style.cursor = "pointer";

    const titleDiv = document.createElement("div");
    titleDiv.className = "proj-item-title";
    titleDiv.textContent = draft.title || "Untitled Draft";
    bodyDiv.appendChild(titleDiv);

    if (draft.content) {
      const preview = document.createElement("div");
      preview.className = "proj-item-summary";
      preview.textContent = draft.content.replace(/[#*_~`>\-]/g, "").slice(0, 200);
      bodyDiv.appendChild(preview);
    }

    const metaDiv = document.createElement("div");
    metaDiv.className = "proj-item-meta";
    const badge = document.createElement("span");
    badge.className = "proj-type-badge";
    badge.textContent = "draft";
    badge.style.background = "var(--accent-dim)";
    badge.style.color = "var(--accent)";
    metaDiv.appendChild(badge);
    const wordCount = draft.content ? draft.content.trim().split(/\s+/).length : 0;
    const wcSpan = document.createElement("span");
    wcSpan.style.cssText = "font-size:11px;color:var(--text-muted);";
    wcSpan.textContent = wordCount + " words";
    metaDiv.appendChild(wcSpan);
    if (draft.updatedAt) {
      const dateSpan = document.createElement("span");
      dateSpan.textContent = new Date(draft.updatedAt).toLocaleDateString();
      metaDiv.appendChild(dateSpan);
    }
    bodyDiv.appendChild(metaDiv);
    card.appendChild(bodyDiv);

    // Click to open in Draft Pad
    bodyDiv.addEventListener("click", async () => {
      await browser.storage.local.set({ draftOpenId: draft.id });
      const draftUrl = browser.runtime.getURL("reporting/reporting.html");
      const existing = await browser.tabs.query({ url: draftUrl + "*" });
      if (existing.length > 0) {
        await browser.tabs.update(existing[0].id, { active: true });
        await browser.windows.update(existing[0].windowId, { focused: true });
      } else {
        await browser.tabs.create({ url: draftUrl });
      }
    });

    // Actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "proj-item-actions";
    const openBtn = document.createElement("button");
    openBtn.className = "proj-item-view-btn";
    openBtn.title = "Open in Draft Pad";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => bodyDiv.click());
    actionsDiv.appendChild(openBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "proj-item-remove-btn";
    removeBtn.title = "Detach draft from project";
    removeBtn.textContent = "Detach";
    removeBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ action: "draftSave", draft: { ...draft, projectId: "" } });
      projRenderDrafts(projectId);
    });
    actionsDiv.appendChild(removeBtn);

    card.appendChild(actionsDiv);
    draftsContainer.appendChild(card);
  }
}

function projOpenModal(existing) {
  projState.editingProjectId = existing ? existing.id : null;
  projEl.modalTitle.textContent = existing ? "Edit Project" : "New Project";
  projEl.modalName.value = existing ? existing.name : "";
  projEl.modalDesc.value = existing ? (existing.description || "") : "";
  projEl.modalColor.value = existing ? (existing.color || "#e94560") : "#e94560";
  const hasCloud = !!(existing?.cloudProvider);
  projEl.modalCloudSync.checked = hasCloud;
  projEl.modalCloudProvider.value = existing?.cloudProvider || "";
  projEl.modalCloudProvider.style.display = hasCloud ? "block" : "none";
  projEl.modal.classList.remove("hidden");
  projEl.modalName.focus();
}

async function projSaveModal() {
  const name = projEl.modalName.value.trim();
  if (!name) return;

  const cloudProvider = projEl.modalCloudSync.checked
    ? (projEl.modalCloudProvider.value || null)
    : null;

  if (projState.editingProjectId) {
    await browser.runtime.sendMessage({
      action: "updateProject",
      projectId: projState.editingProjectId,
      name,
      description: projEl.modalDesc.value.trim(),
      color: projEl.modalColor.value,
      cloudProvider,
    });
  } else {
    const resp = await browser.runtime.sendMessage({
      action: "createProject",
      name,
      description: projEl.modalDesc.value.trim(),
      color: projEl.modalColor.value,
      cloudProvider,
    });
    if (resp && resp.success) {
      projState.activeProjectId = resp.project.id;
    }
  }

  projEl.modal.classList.add("hidden");
  await projLoadProjects();
  if (projState.activeProjectId) projSelectProject(projState.activeProjectId);
}

async function projSaveItemNotes() {
  if (!projState.activeProjectId || !projState.editingItemId) return;
  await browser.runtime.sendMessage({
    action: "updateProjectItem",
    projectId: projState.activeProjectId,
    itemId: projState.editingItemId,
    notes: projEl.itemNotes.value
  });
  projEl.itemModal.classList.add("hidden");
  await projLoadProjects();
  projSelectProject(projState.activeProjectId);
}

async function projToggleStar(id) {
  const proj = projState.projects.find(p => p.id === id);
  if (!proj) return;
  await browser.runtime.sendMessage({ action: "updateProject", projectId: id, starred: !proj.starred });
  await projLoadProjects();
  if (projState.activeProjectId) projSelectProject(projState.activeProjectId);
}

async function projDelete(id) {
  if (!confirm("Delete this project and all its items?")) return;
  await browser.runtime.sendMessage({ action: "deleteProject", projectId: id });
  projState.activeProjectId = null;
  await projLoadProjects();
  projShowEmpty();
}

async function projAddItem(type) {
  if (!projState.activeProjectId) return;
  const title = type === "note" ? "New Note" : "";
  const item = { type, title, notes: "", url: "" };

  if (type === "url") {
    let url = (prompt("Enter a URL:") || "").trim();
    if (!url) return;
    // Auto-prepend https:// if no protocol
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    item.url = url;
    item.title = url;
  }

  await browser.runtime.sendMessage({
    action: "addProjectItem",
    projectId: projState.activeProjectId,
    item
  });
  await projLoadProjects();
  projSelectProject(projState.activeProjectId);

  // Auto-open notes editor for new notes
  if (type === "note") {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    if (proj && proj.items.length > 0) {
      const newItem = proj.items[0];
      projState.editingItemId = newItem.id;
      projEl.itemNotes.value = "";
      projEl.itemModal.classList.remove("hidden");
      projEl.itemNotes.focus();
    }
  }
}

function downloadBundle(bundle, filename) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function projExportOne(id) {
  const resp = await browser.runtime.sendMessage({ action: "exportProject", projectId: id });
  if (!resp || !resp.success) return;
  const name = (resp.bundle.projects[0].name || "project").replace(/[^a-z0-9]/gi, "_");
  downloadBundle(resp.bundle, `${name}.argusproj`);
}

async function projExportAll() {
  const resp = await browser.runtime.sendMessage({ action: "exportAllProjects" });
  if (!resp || !resp.success) return;
  downloadBundle(resp.bundle, "argus-projects.argusproj");
}

function projImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".argusproj,.json";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let bundle = JSON.parse(text);

      // Support importing old-format single project JSON
      if (!bundle.manifest && bundle.id && bundle.items) {
        bundle = {
          manifest: { format: "argusproj", version: 1, exportedAt: new Date().toISOString(), projectCount: 1, historyCount: 0 },
          projects: [bundle],
          history: [],
        };
      }
      // Support importing old-format array of projects
      if (Array.isArray(bundle)) {
        bundle = {
          manifest: { format: "argusproj", version: 1, exportedAt: new Date().toISOString(), projectCount: bundle.length, historyCount: 0 },
          projects: bundle,
          history: [],
        };
      }

      const resp = await browser.runtime.sendMessage({ action: "importProject", bundle });
      if (resp && resp.success) {
        alert(`Imported ${resp.projectsImported} project(s) and ${resp.historyImported} history item(s).`);
        projLoadList();
      } else {
        alert("Import failed: " + (resp ? resp.error : "Unknown error"));
      }
    } catch (e) {
      alert("Failed to read file: " + e.message);
    }
  });
  input.click();
}

let batchPollTimer = null;

async function projBatchAnalyze() {
  const presetKey = document.getElementById("proj-batch-preset").value;
  if (!presetKey || !projState.activeProjectId) return;

  const proj = projState.projects.find(p => p.id === projState.activeProjectId);
  if (!proj) return;

  const statusEl = document.getElementById("proj-batch-status");
  const runBtn = document.getElementById("proj-batch-run");

  // Check if unanalyzed items exist — use analysisContent (AI output), not summary
  // (summary may be pre-populated from feed descriptions or page excerpts)
  const unsummarized = proj.items.filter(i => i.url && !i.analysisContent);
  const allWithUrl = proj.items.filter(i => i.url);
  let reanalyze = false;

  if (unsummarized.length === 0) {
    if (allWithUrl.length === 0) {
      statusEl.textContent = "No items with URLs to analyze.";
      return;
    }
    if (!confirm(`All ${allWithUrl.length} items have been analyzed. Re-analyze them all?`)) return;
    reanalyze = true;
  }

  // Kick off in background
  const resp = await browser.runtime.sendMessage({
    action: "batchAnalyzeProject",
    projectId: proj.id,
    presetKey,
    reanalyze
  });

  if (!resp.success) {
    statusEl.textContent = resp.error;
    return;
  }

  runBtn.textContent = "Cancel";
  runBtn.onclick = projCancelBatch;

  // Show progress bar
  const progressEl = document.getElementById("proj-batch-progress");
  const barEl = document.getElementById("proj-batch-bar");
  const pctEl = document.getElementById("proj-batch-pct");
  progressEl.classList.remove("hidden", "proj-batch-done");
  barEl.style.width = "0%";
  pctEl.textContent = "0%";

  // Poll for progress
  batchPollTimer = setInterval(() => pollBatchStatus(), 1500);
  statusEl.textContent = `Starting batch analysis (${resp.total} items)...`;
}

async function pollBatchStatus() {
  const statusEl = document.getElementById("proj-batch-status");
  const runBtn = document.getElementById("proj-batch-run");
  const progressEl = document.getElementById("proj-batch-progress");
  const barEl = document.getElementById("proj-batch-bar");
  const pctEl = document.getElementById("proj-batch-pct");

  try {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (!s.success) return;

    // Update progress bar
    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
    barEl.style.width = pct + "%";
    pctEl.textContent = pct + "%";

    if (s.running) {
      statusEl.textContent = `Analyzing ${s.done + 1} of ${s.total}: ${s.current}`;
    } else {
      // Finished
      clearInterval(batchPollTimer);
      batchPollTimer = null;

      // Fill bar to 100%
      barEl.style.width = "100%";
      pctEl.textContent = "100%";
      progressEl.classList.add("proj-batch-done");

      const errCount = s.errors.length;
      if (s.cancelled) {
        statusEl.textContent = `Cancelled after ${s.done} of ${s.total} items.`;
      } else if (errCount > 0) {
        statusEl.textContent = `Complete — analyzed ${s.done} item(s), ${errCount} error(s).`;
      } else {
        statusEl.textContent = `Complete — all ${s.done} item(s) analyzed successfully.`;
      }

      runBtn.textContent = "Run Batch";
      runBtn.onclick = projBatchAnalyze;

      // Refresh project display
      await projLoadProjects();
      projSelectProject(projState.activeProjectId);

      // Hide progress bar after a while, keep status text longer
      setTimeout(() => {
        progressEl.classList.add("hidden");
        progressEl.classList.remove("proj-batch-done");
      }, 8000);
      setTimeout(() => { statusEl.textContent = ""; }, 15000);
    }
  } catch { /* ignore */ }
}

async function projCancelBatch() {
  await browser.runtime.sendMessage({ action: "cancelBatch" });
  document.getElementById("proj-batch-status").textContent = "Cancelling...";
}

// ──────────────────────────────────────────────
// OSINT Project Tools
// ──────────────────────────────────────────────
async function projRunEntityExtraction() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Running entity extraction on all project items...";

  // Use batch analyze with entities preset
  const resp = await browser.runtime.sendMessage({
    action: "batchAnalyzeProject",
    projectId: projState.activeProjectId,
    presetKey: "entities",
    reanalyze: true
  });

  if (!resp.success) {
    statusEl.textContent = resp.error;
    return;
  }

  // Poll for completion
  const pollId = setInterval(async () => {
    const s = await browser.runtime.sendMessage({ action: "getBatchStatus" });
    if (s.running) {
      statusEl.textContent = `Extracting entities: ${s.done}/${s.total} - ${s.current}...`;
    } else {
      clearInterval(pollId);
      statusEl.textContent = `Entity extraction complete (${s.done} items).`;
      await projLoadProjects();
      projSelectProject(projState.activeProjectId);
      setTimeout(() => { statusEl.textContent = ""; }, 5000);
    }
  }, 1500);
}

async function projOpenConnectionGraph() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Building connection graph...";

  const resp = await browser.runtime.sendMessage({
    action: "buildConnectionGraph",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    const storeKey = `graph-${Date.now()}`;
    await browser.storage.local.set({ [storeKey]: { projectName: proj?.name || "Project", nodes: resp.nodes, edges: resp.edges } });
    browser.tabs.create({ url: browser.runtime.getURL(`osint/graph.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "No entity data found. Run entity extraction first.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

async function projOpenTimeline() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Building timeline...";

  const resp = await browser.runtime.sendMessage({
    action: "buildTimeline",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const proj = projState.projects.find(p => p.id === projState.activeProjectId);
    const storeKey = `timeline-${Date.now()}`;
    await browser.storage.local.set({ [storeKey]: { projectName: proj?.name || "Project", events: resp.events } });
    browser.tabs.create({ url: browser.runtime.getURL(`osint/timeline.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "No date data found. Run entity extraction first.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

function projOpenHeatmap() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/heatmap.html?project=${encodeURIComponent(projState.activeProjectId)}`) });
}

function projOpenGeomap() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/geomap.html?project=${encodeURIComponent(projState.activeProjectId)}`) });
}

function projOpenDashboard() {
  if (!projState.activeProjectId) return;
  browser.tabs.create({ url: browser.runtime.getURL(`osint/dashboard.html?projectId=${encodeURIComponent(projState.activeProjectId)}`) });
}

async function projBuildSkeleton(forceOpen) {
  const panel = document.getElementById("proj-skeleton-panel");
  if (!forceOpen && !panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  if (!projState.activeProjectId) return;
  panel.innerHTML = "<p style='color:var(--text-muted);font-size:12px;'>Loading skeleton...</p>";
  panel.classList.remove("hidden");
  const resp = await browser.runtime.sendMessage({ action: "buildProjectSkeleton", projectId: projState.activeProjectId });
  if (!resp || !resp.success) { panel.innerHTML = "<p style='color:var(--error);'>Failed to build skeleton</p>"; return; }
  const s = resp.skeleton;
  const esc = t => (t||"").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const maxShow = 5;
  function renderList(arr, labelFn) {
    if (!arr.length) return "<span style='color:var(--text-muted);'>None</span>";
    const shown = arr.slice(0, maxShow);
    let html = shown.map(x => `<div class="skel-item">${labelFn(x)}</div>`).join("");
    if (arr.length > maxShow) html += `<div class="skel-item" style="color:var(--text-muted);">+${arr.length - maxShow} more...</div>`;
    return html;
  }
  panel.innerHTML = `
    <div class="skel-grid">
      <div class="skel-section">
        <div class="skel-heading">Items (${s.items.total})</div>
        ${renderList(s.items.list, i => `<span class="skel-badge">${esc(i.type)}</span> ${i.url ? `<a href="${esc(i.url)}" target="_blank">${esc(i.title || i.url)}</a>` : esc(i.title || "Note")}`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Feeds (${s.feeds.total})</div>
        ${renderList(s.feeds.list, f => esc(f.title || f.url))}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Bookmarks (${s.bookmarks.total})</div>
        ${renderList(s.bookmarks.list, b => `<a href="${esc(b.url)}" target="_blank">${esc(b.title || b.url)}</a>`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Monitors (${s.monitors.total})</div>
        ${renderList(s.monitors.list, m => esc(m.label || m.url))}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Entities (${s.entities.total})</div>
        ${renderList(s.entities.list, e => `<span class="skel-badge">${esc(e.type)}</span> ${esc(e.label)} <span style="color:var(--text-muted);">(${e.mentions})</span>`)}
      </div>
      <div class="skel-section">
        <div class="skel-heading">Keywords (${s.keywords.total})</div>
        ${renderList(s.keywords.list, k => `<span style="color:var(--accent);">"${esc(k)}"</span>`)}
      </div>
      ${s.drafts && s.drafts.total > 0 ? `<div class="skel-section">
        <div class="skel-heading">Drafts (${s.drafts.total})</div>
        ${renderList(s.drafts.list, d => `${esc(d.title)} <span style="color:var(--text-muted);">(${d.words} words)</span>`)}
      </div>` : ""}
    </div>
    <div class="skel-footer">Data: ${s.items.total} items &middot; ${s.entities.total} entities &middot; ${s.feeds.total} feeds &middot; ${s.monitors.total} monitors &middot; ${s.bookmarks.total} bookmarks${s.drafts && s.drafts.total > 0 ? ` &middot; ${s.drafts.total} drafts` : ""}</div>
  `;
}

async function projGenerateReport() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Generating investigation report (this may take a minute)...";

  const resp = await browser.runtime.sendMessage({
    action: "generateReport",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    // Open in results page
    const storeKey = `report-${Date.now()}`;
    await browser.storage.local.set({
      [storeKey]: {
        status: "done",
        content: resp.content,
        pageTitle: resp.title || "Investigation Report",
        pageUrl: "",
        presetLabel: "Investigation Report",
        provider: resp.provider,
        model: resp.model
      }
    });
    browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "Failed to generate report.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}

async function projAnomalyScan() {
  if (!projState.activeProjectId) return;
  const statusEl = document.getElementById("proj-osint-status");
  statusEl.textContent = "Running anomaly scan (this may take a minute)...";

  const resp = await browser.runtime.sendMessage({
    action: "anomalyScan",
    projectId: projState.activeProjectId
  });

  if (resp && resp.success) {
    const storeKey = `anomaly-${Date.now()}`;
    await browser.storage.local.set({
      [storeKey]: {
        status: "done",
        content: resp.content,
        pageTitle: "Anomaly Scan",
        pageUrl: "",
        presetLabel: "Anomaly Scan",
        provider: resp.provider,
        model: resp.model
      }
    });
    browser.tabs.create({ url: browser.runtime.getURL(`results/results.html?id=${encodeURIComponent(storeKey)}`) });
    statusEl.textContent = "";
  } else {
    statusEl.textContent = resp?.error || "Failed to run anomaly scan.";
    setTimeout(() => { statusEl.textContent = ""; }, 5000);
  }
}



// ──────────────────────────────────────────────
// Init on page load
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initProjects();

  // Live data refresh — listen for background data changes
  browser.runtime.onMessage.addListener((message) => {
    if (message.type !== "argusDataChanged") return;
    const store = message.store;
    if (store === "projects" && typeof projLoadProjects === "function") projLoadProjects();
    if (store === "drafts" && projState.activeProjectId && typeof projRenderDrafts === "function") projRenderDrafts(projState.activeProjectId);
  });
});
