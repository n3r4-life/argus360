// ──────────────────────────────────────────────
// Project Dashboard — At-a-Glance Widgets
// ──────────────────────────────────────────────

const TYPE_COLORS = {
  person: "#e94560",
  organization: "#64b5f6",
  location: "#4caf50",
  date: "#ffb74d",
  event: "#ce93d8",
  other: "#a0a0b0",
};

let projectId = null;

function emptyMsg(container, text) {
  container.textContent = "";
  const span = document.createElement("span");
  span.style.cssText = "color:var(--text-secondary);font-size:12px;";
  span.textContent = text;
  container.appendChild(span);
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  projectId = params.get("projectId");

  if (!projectId) {
    const noIdEl = document.getElementById("loadingState");
    noIdEl.textContent = "";
    const noIdP = document.createElement("p");
    noIdP.style.color = "var(--error)";
    noIdP.textContent = "No project ID provided.";
    noIdEl.appendChild(noIdP);
    return;
  }

  // Load dashboard data
  try {
    const resp = await browser.runtime.sendMessage({ action: "getDashboardData", projectId });
    if (!resp || !resp.success) throw new Error(resp?.error || "Failed to load dashboard");

    renderDashboard(resp.dashboard);
  } catch (e) {
    const loadEl = document.getElementById("loadingState");
    loadEl.textContent = "";
    const errP = document.createElement("p");
    errP.style.color = "var(--error)";
    errP.textContent = `Error: ${e.message}`;
    loadEl.appendChild(errP);
  }

  // Load digest schedule
  const schedResp = await browser.runtime.sendMessage({ action: "getDigestSchedule", projectId });
  if (schedResp && schedResp.schedule) {
    document.getElementById("digestSchedule").value = schedResp.schedule;
  }

  // Wire controls
  document.getElementById("digestSchedule").addEventListener("change", async (e) => {
    await browser.runtime.sendMessage({
      action: "setDigestSchedule", projectId, schedule: e.target.value
    });
  });

  document.getElementById("generateDigest").addEventListener("click", generateDigestNow);

  // Report buttons
  for (const btn of document.querySelectorAll(".report-btn")) {
    btn.addEventListener("click", () => generateReport(btn.dataset.section, btn));
  }

  document.getElementById("reportClose").addEventListener("click", () => {
    document.getElementById("reportOutput").classList.add("hidden");
  });
});

function renderDashboard(data) {
  document.getElementById("loadingState").classList.add("hidden");
  document.getElementById("dashContent").classList.remove("hidden");

  // Project name
  document.getElementById("projectName").textContent = data.project.name;
  document.title = `Dashboard — ${data.project.name}`;

  // Stats
  document.getElementById("statItems").textContent = data.stats.totalItems;
  document.getElementById("statEntities").textContent = data.stats.totalEntities;
  document.getElementById("statRelationships").textContent = data.stats.totalRelationships;
  document.getElementById("statRecentChanges").textContent = data.recentChanges.length;

  // Alerts
  renderAlerts(data.trends);

  // Activity chart
  renderActivityChart(data.activityHist);

  // Type breakdown
  renderTypeBreakdown(data.typeBreakdown, data.stats.totalEntities);

  // Co-occurrence
  renderCooccurrence(data.cooccurrence, data.topEntities);

  // Top entities
  renderTopEntities(data.topEntities);

  // Recent changes
  renderRecentChanges(data.recentChanges);

  // Trends
  renderTrends(data.trends);

  // Latest digest
  renderDigest(data.latestDigest);

  // Init chat
  const topNames = (data.topEntities || []).slice(0, 20).map(e => `${e.name} (${e.type}, ${e.count} mentions)`).join(", ");
  const trendInfo = (data.trends?.alerts || []).map(a => `- ${a.message || a.entity}`).join("\n");
  ArgusChat.init({
    container: document.getElementById("argus-chat-container"),
    contextType: "Project Dashboard",
    contextData: `Project: ${data.project.name}\nItems: ${data.stats.totalItems}, Entities: ${data.stats.totalEntities}, Relationships: ${data.stats.totalRelationships}\nTop entities: ${topNames}\n${trendInfo ? "Trends:\n" + trendInfo : ""}`,
    pageTitle: data.project.name
  });
}

function renderAlerts(trends) {
  if (!trends || !trends.alerts || !trends.alerts.length) return;
  const row = document.getElementById("alertsRow");
  const list = document.getElementById("alertsList");
  row.classList.remove("hidden");
  list.innerHTML = "";

  for (const alert of trends.alerts) {
    const item = document.createElement("div");
    item.className = "alert-item";
    const icon = document.createElement("span");
    icon.className = "alert-icon";
    icon.textContent = "\u26A0";
    item.appendChild(icon);
    item.append(" " + alert.message);
    list.appendChild(item);
  }
}

function renderActivityChart(hist) {
  const container = document.getElementById("activityChart");
  container.innerHTML = "";
  if (!hist || !hist.length) {
    emptyMsg(container, "No activity data");
    return;
  }

  const max = Math.max(...hist.map(h => h.count), 1);
  for (const entry of hist) {
    const bar = document.createElement("div");
    bar.className = "activity-bar";
    const height = Math.max((entry.count / max) * 100, 2);
    bar.style.height = `${height}%`;
    bar.title = `${entry.date}: ${entry.count} items`;
    if (entry.count === 0) bar.style.opacity = "0.2";
    container.appendChild(bar);
  }
}

function renderTypeBreakdown(breakdown, total) {
  const container = document.getElementById("typeBars");
  container.innerHTML = "";
  if (!breakdown || !Object.keys(breakdown).length) {
    emptyMsg(container, "No entities yet");
    return;
  }

  const maxCount = Math.max(...Object.values(breakdown));
  for (const [type, count] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
    const row = document.createElement("div");
    row.className = "type-bar-row";
    const pct = (count / maxCount) * 100;
    const lbl = document.createElement("span");
    lbl.className = "type-bar-label";
    lbl.textContent = type;
    const track = document.createElement("div");
    track.className = "type-bar-track";
    const fill = document.createElement("div");
    fill.className = "type-bar-fill";
    fill.style.width = `${pct}%`;
    fill.style.background = TYPE_COLORS[type] || TYPE_COLORS.other;
    track.appendChild(fill);
    const cnt = document.createElement("span");
    cnt.className = "type-bar-count";
    cnt.textContent = count;
    row.appendChild(lbl);
    row.appendChild(track);
    row.appendChild(cnt);
    container.appendChild(row);
  }
}

function renderCooccurrence(cooccurrence, topEntities) {
  const container = document.getElementById("cooccurrenceGrid");
  container.innerHTML = "";
  if (!cooccurrence || !cooccurrence.length || !topEntities || topEntities.length < 2) {
    emptyMsg(container, "Not enough data for co-occurrence");
    return;
  }

  // Build unique entity names
  const names = [...new Set(cooccurrence.flatMap(c => [c.entityA, c.entityB]))].slice(0, 8);
  if (names.length < 2) {
    emptyMsg(container, "Not enough connections");
    return;
  }

  // Build weight lookup
  const weightMap = {};
  let maxWeight = 1;
  for (const c of cooccurrence) {
    const key = `${c.entityA}|${c.entityB}`;
    const keyR = `${c.entityB}|${c.entityA}`;
    weightMap[key] = c.weight;
    weightMap[keyR] = c.weight;
    if (c.weight > maxWeight) maxWeight = c.weight;
  }

  const table = document.createElement("table");
  // Header row
  const thead = document.createElement("tr");
  thead.appendChild(document.createElement("th"));
  for (const name of names) {
    const th = document.createElement("th");
    th.textContent = name.length > 10 ? name.slice(0, 9) + "\u2026" : name;
    th.title = name;
    thead.appendChild(th);
  }
  table.appendChild(thead);

  // Data rows
  for (let i = 0; i < names.length; i++) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = names[i].length > 10 ? names[i].slice(0, 9) + "\u2026" : names[i];
    th.title = names[i];
    tr.appendChild(th);

    for (let j = 0; j < names.length; j++) {
      const td = document.createElement("td");
      if (i === j) {
        td.textContent = "-";
        td.style.background = "var(--bg-primary)";
      } else {
        const w = weightMap[`${names[i]}|${names[j]}`] || 0;
        td.className = "cell-heat";
        td.textContent = w || "";
        if (w) {
          const intensity = Math.min(w / maxWeight, 1);
          td.style.background = `rgba(233, 69, 96, ${0.1 + intensity * 0.5})`;
        }
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  container.appendChild(table);
}

function renderTopEntities(entities) {
  const container = document.getElementById("topEntities");
  container.innerHTML = "";
  if (!entities || !entities.length) {
    emptyMsg(container, "No entities");
    return;
  }

  for (const entity of entities) {
    const item = document.createElement("div");
    item.className = "entity-item";
    const infoDiv = document.createElement("div");
    const nameSpan = document.createElement("span");
    nameSpan.className = "entity-name";
    nameSpan.textContent = entity.name;
    const typeSpan = document.createElement("span");
    typeSpan.className = `entity-type entity-type-${entity.type}`;
    typeSpan.textContent = entity.type;
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(typeSpan);
    const mentionsSpan = document.createElement("span");
    mentionsSpan.className = "entity-mentions";
    mentionsSpan.textContent = `${entity.mentions} mentions`;
    item.appendChild(infoDiv);
    item.appendChild(mentionsSpan);
    container.appendChild(item);
  }
}

function renderRecentChanges(changes) {
  const container = document.getElementById("recentChanges");
  container.innerHTML = "";
  if (!changes || !changes.length) {
    emptyMsg(container, "No changes in the last 7 days");
    return;
  }

  for (const change of changes) {
    const item = document.createElement("div");
    item.className = "change-item";
    const date = change.addedAt ? new Date(change.addedAt).toLocaleDateString() : "";
    const strong = document.createElement("strong");
    strong.textContent = change.name;
    item.appendChild(strong);
    item.append(` (${change.type})`);
    const dateSpan = document.createElement("span");
    dateSpan.className = "change-date";
    dateSpan.textContent = date;
    item.appendChild(dateSpan);
    container.appendChild(item);
  }
}

function renderTrends(trends) {
  const container = document.getElementById("trendsList");
  container.innerHTML = "";
  if (!trends) {
    emptyMsg(container, "No trend data yet");
    return;
  }

  let hasItems = false;

  if (trends.new && trends.new.length) {
    hasItems = true;
    for (const t of trends.new.slice(0, 5)) {
      const item = document.createElement("div");
      item.className = "trend-item trend-new";
      const arrow1 = document.createElement("span");
      arrow1.className = "trend-arrow";
      arrow1.textContent = "+";
      item.appendChild(arrow1);
      item.append(" New entity: ");
      const bold1 = document.createElement("strong");
      bold1.textContent = t.name;
      item.appendChild(bold1);
      item.append(` (${t.type})`);
      container.appendChild(item);
    }
  }

  if (trends.rising && trends.rising.length) {
    hasItems = true;
    for (const t of trends.rising.slice(0, 5)) {
      const item = document.createElement("div");
      item.className = "trend-item trend-rising";
      const arrow2 = document.createElement("span");
      arrow2.className = "trend-arrow";
      arrow2.textContent = "\u2191";
      item.appendChild(arrow2);
      item.append(" ");
      const bold2 = document.createElement("strong");
      bold2.textContent = t.name;
      item.appendChild(bold2);
      item.append(` +${t.delta} mentions`);
      container.appendChild(item);
    }
  }

  if (!hasItems) {
    emptyMsg(container, "No notable trends");
  }
}

function renderDigest(digest) {
  const container = document.getElementById("digestContent");
  if (!digest) return;

  container.textContent = "";
  const mdDiv = document.createElement("div");
  mdDiv.className = "markdown-body";
  mdDiv.appendChild(DOMPurify.sanitize(marked.parse(digest.content), { RETURN_DOM_FRAGMENT: true }));
  const metaDiv = document.createElement("div");
  metaDiv.className = "digest-meta";
  metaDiv.textContent = `Generated ${new Date(digest.generatedAt).toLocaleString()} | ${digest.provider} / ${digest.model}`;
  container.appendChild(mdDiv);
  container.appendChild(metaDiv);
}

// ── Report Generation ──

// Cache of loaded reports so switching between types doesn't re-call the API
const reportCache = {};

async function generateReport(sectionType, btn) {
  const sectionLabels = {
    executiveSummary: "Executive Summary",
    knowledgeGaps: "Knowledge Gaps",
    contradictions: "Contradictions & Discrepancies",
    timelineHighlights: "Timeline Highlights",
  };

  // Check in-memory cache first, then storage cache
  if (reportCache[sectionType]) {
    showReport(sectionType, reportCache[sectionType], sectionLabels);
    return;
  }

  // Check persistent cache
  try {
    const cached = await browser.runtime.sendMessage({
      action: "getCachedReport", projectId, sectionType
    });
    if (cached?.success && cached.section) {
      reportCache[sectionType] = cached.section;
      showReport(sectionType, cached.section, sectionLabels);
      return;
    }
  } catch { /* no cache, generate fresh */ }

  // Generate fresh report
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const resp = await browser.runtime.sendMessage({
      action: "generateReportSection", projectId, sectionType
    });

    if (!resp || !resp.success) throw new Error(resp?.error || "Generation failed");

    reportCache[sectionType] = resp.section;
    showReport(sectionType, resp.section, sectionLabels);
  } catch (e) {
    alert("Report generation failed: " + e.message);
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function showReport(sectionType, section, labels) {
  const output = document.getElementById("reportOutput");
  output.classList.remove("hidden");
  document.getElementById("reportTitle").textContent = labels[sectionType] || sectionType;

  const reportEl = document.getElementById("reportContent");
  reportEl.textContent = "";
  reportEl.appendChild(DOMPurify.sanitize(marked.parse(section.content), { RETURN_DOM_FRAGMENT: true }));
  document.getElementById("reportMeta").textContent =
    `Generated ${new Date(section.generatedAt).toLocaleString()} | ${section.provider} / ${section.model}`;

  output.scrollIntoView({ behavior: "smooth" });
}

// ── Digest Generation ──

async function generateDigestNow() {
  const btn = document.getElementById("generateDigest");
  btn.disabled = true;
  btn.textContent = "Generating...";

  try {
    const resp = await browser.runtime.sendMessage({ action: "generateDigest", projectId });
    if (!resp || !resp.success) throw new Error(resp?.error || "Digest generation failed");

    renderDigest(resp.digest);
    btn.textContent = "Digest Generated!";
    setTimeout(() => { btn.textContent = "Generate Digest Now"; btn.disabled = false; }, 2000);
  } catch (e) {
    alert("Digest generation failed: " + e.message);
    btn.textContent = "Generate Digest Now";
    btn.disabled = false;
  }
}

// ── Utility ──

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
