(function () {
  "use strict";

  // Category metadata — icons, labels, sensitivity, value styling
  const CATEGORIES = {
    emails:         { icon: "\u2709", label: "Email Addresses", sensitivity: "medium", cls: "" },
    ipv4:           { icon: "\ud83c\udf10", label: "IPv4 Addresses", sensitivity: "low", cls: "" },
    phones:         { icon: "\ud83d\udcde", label: "Phone Numbers", sensitivity: "medium", cls: "" },
    urls:           { icon: "\ud83d\udd17", label: "URLs", sensitivity: "low", cls: "url" },
    domains:        { icon: "\ud83c\udf0d", label: "Domains", sensitivity: "low", cls: "" },
    hashes_md5:     { icon: "#", label: "MD5 Hashes", sensitivity: "low", cls: "" },
    hashes_sha1:    { icon: "#", label: "SHA-1 Hashes", sensitivity: "low", cls: "" },
    hashes_sha256:  { icon: "#", label: "SHA-256 Hashes", sensitivity: "low", cls: "" },
    btc_addr:       { icon: "\u20bf", label: "Bitcoin Addresses", sensitivity: "medium", cls: "" },
    ssn:            { icon: "\u26a0", label: "SSN-like Patterns", sensitivity: "high", cls: "sensitive" },
    credit_card:    { icon: "\ud83d\udcb3", label: "Credit Card Numbers", sensitivity: "high", cls: "sensitive" },
    jwt:            { icon: "\ud83d\udd11", label: "JWT Tokens", sensitivity: "high", cls: "sensitive" },
    api_keys:       { icon: "\ud83d\udd10", label: "API Keys / Secrets", sensitivity: "high", cls: "sensitive" },
    aws_keys:       { icon: "\u2601", label: "AWS Access Keys", sensitivity: "high", cls: "sensitive" },
    base64_blobs:   { icon: "\ud83d\udce6", label: "Base64 Blobs", sensitivity: "low", cls: "" },
    social_handles: { icon: "@", label: "Social Handles", sensitivity: "low", cls: "" },
  };

  let scanData = null;    // { found, totalMatches, htmlLength, textLength, pageUrl, pageTitle }
  let pageHtml = null;    // stored for custom regex re-scan (loaded on demand)
  let pageText = null;
  let filterText = "";

  // ── Init ──────────────────────────────────────────
  const params = new URLSearchParams(location.search);
  const storeKey = params.get("id");

  if (!storeKey) {
    document.getElementById("empty-state").textContent = "No scan ID provided.";
    return;
  }

  browser.storage.local.get(storeKey).then(async result => {
    const data = result[storeKey];
    if (!data || !data.found) {
      document.getElementById("empty-state").textContent = "No scan results found. The data may have expired.";
      return;
    }
    scanData = data;

    // Load stored page source for custom searches
    if (data.sourceKey) {
      try {
        const srcResult = await browser.storage.local.get(data.sourceKey);
        const src = srcResult[data.sourceKey];
        if (src) {
          pageHtml = src.html;
          pageText = src.text;
        }
        browser.storage.local.remove(data.sourceKey);
      } catch (e) { /* non-critical */ }
    }

    init();
    browser.storage.local.remove(storeKey);
  });

  function init() {
    // Header
    const urlEl = document.getElementById("page-url");
    if (scanData.pageUrl) {
      urlEl.href = scanData.pageUrl;
      urlEl.textContent = scanData.pageUrl;
      urlEl.title = scanData.pageTitle || scanData.pageUrl;
    }
    document.title = `Regex Scanner — ${scanData.pageTitle || scanData.pageUrl || ""}`;

    // Stats
    const cats = Object.keys(scanData.found).length;
    document.getElementById("stat-total").textContent = scanData.totalMatches;
    document.getElementById("stat-categories").textContent = cats;
    document.getElementById("stat-html-size").textContent = formatSize(scanData.htmlLength);
    document.getElementById("stat-text-size").textContent = formatSize(scanData.textLength);

    renderResults(scanData.found);
    bindToolbar();
    bindCustomRegex();
    bindAiAnalysis();
  }

  // ── Render ────────────────────────────────────────
  function renderResults(found, customKey) {
    const container = document.getElementById("results");
    // Remove previous cards (keep empty state hidden)
    const emptyState = document.getElementById("empty-state");
    emptyState.style.display = "none";

    // Remove existing cards of this type
    if (customKey) {
      const existing = container.querySelector(".custom-results-card");
      if (existing) existing.remove();
    } else {
      container.querySelectorAll(".category-card:not(.custom-results-card)").forEach(el => el.remove());
    }

    // Sort categories: high sensitivity first, then by match count
    const sensOrder = { high: 0, medium: 1, low: 2 };
    const entries = Object.entries(found).sort((a, b) => {
      const sa = CATEGORIES[a[0]]?.sensitivity || "low";
      const sb = CATEGORIES[b[0]]?.sensitivity || "low";
      if (sensOrder[sa] !== sensOrder[sb]) return sensOrder[sa] - sensOrder[sb];
      return b[1].length - a[1].length;
    });

    if (entries.length === 0 && !customKey) {
      emptyState.style.display = "";
      emptyState.textContent = "No patterns found on this page.";
      return;
    }

    for (const [key, matches] of entries) {
      const meta = CATEGORIES[key] || { icon: "?", label: key, sensitivity: "low", cls: "" };
      const card = buildCategoryCard(key, meta, matches, !!customKey);
      if (customKey) {
        container.prepend(card);
      } else {
        container.appendChild(card);
      }
    }
  }

  function buildCategoryCard(key, meta, matches, isCustom) {
    const card = document.createElement("div");
    card.className = "category-card" + (isCustom ? " custom-results-card" : "");
    card.dataset.category = key;

    // Header
    const header = document.createElement("div");
    header.className = "category-header";
    header.innerHTML = `
      <div class="category-header-left">
        <span class="category-icon">${meta.icon}</span>
        <span class="category-name">${meta.label}</span>
        <span class="category-count">${matches.length}</span>
        <span class="sensitivity-badge ${meta.sensitivity}">${meta.sensitivity}</span>
      </div>
      <div class="category-actions">
        <button class="btn btn-secondary btn-small copy-cat" title="Copy all matches">Copy All</button>
        <span class="category-chevron">&#9654;</span>
      </div>
    `;

    header.addEventListener("click", (e) => {
      if (e.target.closest(".copy-cat")) return;
      card.classList.toggle("open");
    });

    header.querySelector(".copy-cat").addEventListener("click", () => {
      copyToClipboard(matches.join("\n"));
      showToast(`Copied ${matches.length} ${meta.label}`);
    });

    // Match list
    const list = document.createElement("div");
    list.className = "match-list";

    for (const val of matches) {
      const item = document.createElement("div");
      item.className = "match-item";
      item.dataset.value = val.toLowerCase();

      const valueSpan = document.createElement("span");
      valueSpan.className = "match-value" + (meta.cls ? " " + meta.cls : "");
      valueSpan.textContent = val;

      const copyBtn = document.createElement("button");
      copyBtn.className = "match-copy";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        copyToClipboard(val);
        copyBtn.textContent = "Copied";
        copyBtn.classList.add("copied");
        setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 1200);
      });

      item.appendChild(valueSpan);
      item.appendChild(copyBtn);
      list.appendChild(item);
    }

    card.appendChild(header);
    card.appendChild(list);
    return card;
  }

  // ── Toolbar ───────────────────────────────────────
  function bindToolbar() {
    document.getElementById("expand-all").addEventListener("click", () => {
      document.querySelectorAll(".category-card").forEach(c => c.classList.add("open"));
    });
    document.getElementById("collapse-all").addEventListener("click", () => {
      document.querySelectorAll(".category-card").forEach(c => c.classList.remove("open"));
    });
    document.getElementById("export-all").addEventListener("click", exportAll);

    document.getElementById("match-search").addEventListener("input", (e) => {
      filterText = e.target.value.toLowerCase().trim();
      applyFilter();
    });
  }

  function applyFilter() {
    document.querySelectorAll(".category-card").forEach(card => {
      const items = card.querySelectorAll(".match-item");
      let visible = 0;
      items.forEach(item => {
        const show = !filterText || item.dataset.value.includes(filterText);
        item.style.display = show ? "" : "none";
        if (show) visible++;
      });
      // Update count badge
      const countEl = card.querySelector(".category-count");
      const total = items.length;
      if (filterText) {
        countEl.textContent = `${visible}/${total}`;
      } else {
        countEl.textContent = total;
      }
      // Hide entire card if no matches
      card.style.display = visible === 0 && filterText ? "none" : "";
    });
  }

  function exportAll() {
    if (!scanData) return;
    const lines = [];
    lines.push(`Argus Regex Scanner — ${scanData.pageUrl || "unknown page"}`);
    lines.push(`Scanned: ${new Date().toISOString()}`);
    lines.push(`Total matches: ${scanData.totalMatches}`);
    lines.push(`HTML size: ${scanData.htmlLength} chars | Text size: ${scanData.textLength} chars`);
    lines.push("=".repeat(60));
    lines.push("");

    for (const [key, matches] of Object.entries(scanData.found)) {
      const meta = CATEGORIES[key] || { label: key };
      lines.push(`## ${meta.label} (${matches.length})`);
      matches.forEach(m => lines.push("  " + m));
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const host = scanData.pageUrl ? new URL(scanData.pageUrl).hostname : "scan";
    a.download = `regex-scan-${host}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported scan results");
  }

  // ── Page Search (Custom Regex + Text + Presets) ───
  let searchMode = "regex"; // "regex" or "text"

  function bindCustomRegex() {
    const input = document.getElementById("custom-regex");
    const sourceSelect = document.getElementById("custom-source");
    const runBtn = document.getElementById("custom-run");
    const status = document.getElementById("custom-status");

    // Mode toggle (regex vs text)
    document.querySelectorAll(".mode-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".mode-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        searchMode = chip.dataset.mode;
        input.placeholder = searchMode === "regex"
          ? "Enter regex pattern (e.g. password\\s*[:=]\\s*\\S+)"
          : "Enter text to find (case-insensitive)...";
      });
    });

    // Preset chips — fill the input and auto-run
    document.querySelectorAll(".preset-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        input.value = chip.dataset.pattern;
        if (chip.dataset.src) sourceSelect.value = chip.dataset.src;
        // Presets are always regex
        searchMode = "regex";
        document.querySelectorAll(".mode-chip").forEach(c => c.classList.remove("active"));
        document.getElementById("mode-regex").classList.add("active");
        input.placeholder = "Enter regex pattern (e.g. password\\s*[:=]\\s*\\S+)";
        runSearch();
      });
    });

    runBtn.addEventListener("click", () => runSearch());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

    async function runSearch() {
      const pattern = input.value.trim();
      if (!pattern) { status.textContent = "Enter a search term"; status.className = "custom-status error"; return; }

      // Build regex
      let re;
      try {
        if (searchMode === "text") {
          // Escape regex special chars for literal search
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          re = new RegExp(escaped, "gi");
        } else {
          re = new RegExp(pattern, "gi");
        }
      } catch (e) {
        status.textContent = "Invalid pattern: " + e.message;
        status.className = "custom-status error";
        return;
      }

      status.textContent = "Searching...";
      status.className = "custom-status";

      // If we have stored source, search locally
      if (pageHtml || pageText) {
        const src = sourceSelect.value === "text" ? (pageText || "") : (pageHtml || "");
        const matches = [...new Set((src.match(re) || []))].slice(0, 500);
        showCustomResults(pattern, matches);
        status.textContent = `${matches.length} match${matches.length !== 1 ? "es" : ""}`;
        status.className = matches.length > 0 ? "custom-status success" : "custom-status";
        return;
      }

      // Fallback: re-scan via background (if source tab is still open)
      try {
        const resp = await browser.runtime.sendMessage({
          action: "regexScanCustom",
          pattern: searchMode === "text" ? pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : pattern,
          source: sourceSelect.value,
          url: scanData.pageUrl
        });
        if (resp && resp.success) {
          showCustomResults(pattern, resp.matches);
          status.textContent = `${resp.matches.length} match${resp.matches.length !== 1 ? "es" : ""}`;
          status.className = resp.matches.length > 0 ? "custom-status success" : "custom-status";
        } else {
          status.textContent = resp?.error || "Search failed";
          status.className = "custom-status error";
        }
      } catch (e) {
        status.textContent = "Page source unavailable. Source tab may be closed.";
        status.className = "custom-status error";
      }
    }
  }

  function showCustomResults(pattern, matches) {
    if (matches.length === 0) {
      const existing = document.querySelector(".custom-results-card");
      if (existing) existing.remove();
      return;
    }
    const meta = { icon: "\ud83d\udd0d", label: `Custom: ${truncate(pattern, 40)}`, sensitivity: "low", cls: "" };
    renderResults({ custom: matches }, "custom");
    // Override the rendered card meta
    const card = document.querySelector(".custom-results-card");
    if (card) {
      card.querySelector(".category-icon").textContent = meta.icon;
      card.querySelector(".category-name").textContent = meta.label;
      card.querySelector(".sensitivity-badge").textContent = "custom";
      card.querySelector(".sensitivity-badge").className = "sensitivity-badge low";
      card.classList.add("open");
    }
  }

  // ── AI Analysis ────────────────────────────────────
  function bindAiAnalysis() {
    const statusEl = document.getElementById("ai-status");
    const resultsPanel = document.getElementById("ai-results");
    const resultsBody = document.getElementById("ai-results-body");
    const resultsTitle = document.getElementById("ai-results-title");
    const resultsMeta = document.getElementById("ai-results-meta");
    let lastAiContent = "";

    const MODE_LABELS = {
      threat: "Threat Assessment",
      entities: "Entity Analysis",
      summary: "Intelligence Summary"
    };

    document.querySelectorAll(".btn-ai").forEach(btn => {
      btn.addEventListener("click", () => runAiAnalysis(btn.dataset.mode));
    });

    document.getElementById("ai-copy").addEventListener("click", () => {
      if (lastAiContent) {
        copyToClipboard(lastAiContent);
        showToast("AI analysis copied");
      }
    });

    document.getElementById("ai-email").addEventListener("click", () => {
      if (!lastAiContent) return;
      EmailShare.compose({
        subject: `Regex Scan: ${scanData?.pageTitle || scanData?.pageUrl || "Analysis"}`,
        body: EmailShare.formatBody({
          summary: `Regex scan analysis of ${scanData?.pageUrl || "a web page"}`,
          url: scanData?.pageUrl,
          content: lastAiContent
        })
      });
    });

    document.getElementById("ai-close").addEventListener("click", () => {
      resultsPanel.classList.add("hidden");
    });

    async function runAiAnalysis(mode) {
      if (!scanData || !scanData.found || Object.keys(scanData.found).length === 0) {
        statusEl.textContent = "No findings to analyze";
        statusEl.className = "ai-status error";
        return;
      }

      const provider = document.getElementById("ai-provider").value || undefined;
      const btns = document.querySelectorAll(".btn-ai");
      btns.forEach(b => b.classList.add("loading"));
      statusEl.textContent = "Analyzing...";
      statusEl.className = "ai-status";

      try {
        const resp = await browser.runtime.sendMessage({
          action: "regexAnalyze",
          found: scanData.found,
          pageUrl: scanData.pageUrl,
          analysisMode: mode,
          provider
        });

        btns.forEach(b => b.classList.remove("loading"));

        if (resp && resp.success) {
          lastAiContent = resp.content;
          resultsTitle.textContent = MODE_LABELS[mode] || "AI Analysis";
          resultsBody.innerHTML = renderMarkdown(resp.content);
          resultsMeta.textContent = `${resp.provider}/${resp.model}` +
            (resp.usage ? ` · ${resp.usage.total_tokens || "?"} tokens` : "");
          resultsPanel.classList.remove("hidden");
          resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
          statusEl.textContent = "";
        } else {
          statusEl.textContent = resp?.error || "Analysis failed";
          statusEl.className = "ai-status error";
        }
      } catch (e) {
        btns.forEach(b => b.classList.remove("loading"));
        statusEl.textContent = e.message || "Analysis failed";
        statusEl.className = "ai-status error";
      }
    }
  }

  // ── Simple Markdown renderer ──────────────────────
  function renderMarkdown(text) {
    if (!text) return "";
    let html = text
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre><code>${escHtml(code.trim())}</code></pre>`)
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Headers
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      // Horizontal rule
      .replace(/^---$/gm, "<hr>")
      // Blockquote
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
      // Unordered list items
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      // Ordered list items
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
      // Paragraphs — wrap lines not already wrapped
      .replace(/^(?!<[hupblo])((?!<).+)$/gm, "<p>$1</p>");
    return html;
  }

  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── Helpers ───────────────────────────────────────
  function formatSize(chars) {
    if (!chars) return "0";
    if (chars < 1024) return chars + "";
    if (chars < 1024 * 1024) return (chars / 1024).toFixed(1) + "K";
    return (chars / (1024 * 1024)).toFixed(1) + "M";
  }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + "\u2026" : str;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    });
  }

  let toastTimer;
  function showToast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
  }
})();
