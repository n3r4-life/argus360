// ──────────────────────────────────────────────
// IntelligenceViewer — unified rendering for all result types
// Handles: markdown rendering, thinking blocks, metadata,
// export/copy, error display, streaming state, sources/citations.
// Include purify.min.js and marked.min.js before this file.
// ──────────────────────────────────────────────

const IntelligenceViewer = (() => {

  // ── Provider display names (single source of truth) ──
  const PROVIDER_NAMES = {
    xai: "Grok",
    openai: "OpenAI",
    anthropic: "Claude",
    gemini: "Gemini",
    custom: "Custom"
  };

  function providerLabel(key) {
    return PROVIDER_NAMES[key] || key || "";
  }

  // ── Entity JSON → readable Markdown ──
  function entityJsonToMarkdown(json) {
    const lines = [];

    if (json.people && json.people.length) {
      lines.push("## People");
      for (const p of json.people) {
        lines.push(`- **${p.name}**${p.role ? ` — ${p.role}` : ""}`);
        if (p.context) lines.push(`  ${p.context}`);
      }
      lines.push("");
    }

    if (json.organizations && json.organizations.length) {
      lines.push("## Organizations");
      for (const o of json.organizations) {
        lines.push(`- **${o.name}**${o.type ? ` (${o.type})` : ""}`);
        if (o.context) lines.push(`  ${o.context}`);
      }
      lines.push("");
    }

    if (json.locations && json.locations.length) {
      lines.push("## Locations");
      for (const l of json.locations) {
        lines.push(`- **${l.name}**${l.type ? ` (${l.type})` : ""}`);
        if (l.context) lines.push(`  ${l.context}`);
      }
      lines.push("");
    }

    if (json.dates && json.dates.length) {
      lines.push("## Dates & Events");
      for (const d of json.dates) {
        lines.push(`- **${d.date}** — ${d.event || ""}`);
        if (d.context) lines.push(`  ${d.context}`);
      }
      lines.push("");
    }

    if (json.amounts && json.amounts.length) {
      lines.push("## Amounts & Figures");
      for (const a of json.amounts) {
        lines.push(`- **${a.value}**${a.currency ? ` ${a.currency}` : ""}`);
        if (a.context) lines.push(`  ${a.context}`);
      }
      lines.push("");
    }

    if (json.contact && json.contact.length) {
      lines.push("## Contact Information");
      for (const c of json.contact) {
        lines.push(`- ${c.type}: **${c.value}**`);
      }
      lines.push("");
    }

    if (json.claims && json.claims.length) {
      lines.push("## Claims & Assertions");
      for (const c of json.claims) {
        const verified = c.verifiable ? "Verifiable" : "Unverified";
        lines.push(`- "${c.claim}"`);
        if (c.attribution) lines.push(`  — *${c.attribution}* (${verified})`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  // Try to detect and format entity JSON in the content
  function tryFormatEntityJson(md) {
    if (!md) return md;
    const trimmed = md.trim();
    // Must start with { and contain entity keys
    if (!trimmed.startsWith("{")) return md;
    try {
      const parsed = JSON.parse(trimmed);
      // Check if it looks like our entity structure
      if (parsed.people || parsed.organizations || parsed.locations || parsed.claims) {
        return entityJsonToMarkdown(parsed);
      }
    } catch {
      // Not JSON or malformed — check if it's JSON wrapped in code fences
      const fenced = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
      if (fenced.startsWith("{")) {
        try {
          const parsed = JSON.parse(fenced);
          if (parsed.people || parsed.organizations || parsed.locations || parsed.claims) {
            return entityJsonToMarkdown(parsed);
          }
        } catch { /* not JSON */ }
      }
    }
    return md;
  }

  // ── Markdown → sanitized DOM ──
  function renderMarkdown(md, container) {
    const formatted = tryFormatEntityJson(md);
    const clean = DOMPurify.sanitize(marked.parse(formatted || ""), { USE_PROFILES: { html: true } });
    const parsed = new DOMParser().parseFromString(clean, "text/html");
    const wasStreaming = container.classList.contains("streaming");
    container.replaceChildren(...parsed.body.childNodes);
    if (wasStreaming) container.classList.add("streaming");
  }

  // ── Metadata string builder ──
  function formatMeta(data) {
    const parts = [];
    if (data.timestamp) {
      parts.push(new Date(data.timestamp).toLocaleString());
    }
    if (data.provider) parts.push(providerLabel(data.provider));
    if (data.model) parts.push(data.model);
    if (data.presetLabel) parts.push(data.presetLabel);
    if (data.usage) {
      const inp = data.usage.prompt_tokens || "?";
      const out = data.usage.completion_tokens || "?";
      parts.push(`Tokens: ${inp} in / ${out} out`);
    }
    return parts.join(" | ");
  }

  // ── Thinking block ──
  function updateThinking(section, content, thinkingText) {
    if (!section) return;
    if (thinkingText) {
      section.classList.remove("hidden");
      if (content) content.textContent = thinkingText;
    } else {
      section.classList.add("hidden");
    }
  }

  function appendThinking(content, text) {
    if (!content || !text) return;
    content.textContent += "\n---\n" + text;
  }

  function initThinkingToggle(toggleBtn, contentEl) {
    if (!toggleBtn || !contentEl) return;
    toggleBtn.addEventListener("click", () => {
      contentEl.classList.toggle("hidden");
      toggleBtn.textContent = contentEl.classList.contains("hidden") ? "Show Thinking" : "Hide Thinking";
    });
  }

  // ── Export / copy helpers ──
  function initExportButtons(opts) {
    // opts: { copyBtn, mdBtn, htmlBtn, txtBtn, printBtn, getMarkdown, getTitle }
    const { copyBtn, mdBtn, htmlBtn, txtBtn, printBtn, getMarkdown, getTitle } = opts;

    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const md = getMarkdown();
        if (!md) return;
        navigator.clipboard.writeText(md).then(() => {
          const orig = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      });
    }

    if (mdBtn) {
      mdBtn.addEventListener("click", () => {
        const md = getMarkdown();
        if (md) exportAsMarkdown(md, (getTitle() || "analysis") + ".md");
      });
    }

    if (htmlBtn) {
      htmlBtn.addEventListener("click", () => {
        const md = getMarkdown();
        if (md) exportAsHTML(md, getTitle() || "analysis");
      });
    }

    if (txtBtn) {
      txtBtn.addEventListener("click", () => {
        const md = getMarkdown();
        if (md) exportAsText(md, (getTitle() || "analysis") + ".txt");
      });
    }

    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
  }

  // ── Error display ──
  function showError(errorContainer, errorMessage, loadingContainer, message) {
    if (errorMessage) errorMessage.textContent = message;
    if (loadingContainer) loadingContainer.classList.add("hidden");
    if (errorContainer) errorContainer.classList.remove("hidden");
  }

  // ── Streaming state ──
  function setStreaming(container, isStreaming) {
    if (!container) return;
    if (isStreaming) {
      container.classList.add("streaming");
    } else {
      container.classList.remove("streaming");
    }
  }

  // ── Sources panel & citations ──
  function renderSources(sourcesList, sources) {
    if (!sourcesList || !sources || !sources.length) return;
    sourcesList.replaceChildren();
    sources.forEach(src => {
      const item = document.createElement("a");
      item.className = "source-item";
      item.href = src.url;
      item.target = "_blank";
      item.rel = "noopener noreferrer";

      const badge = document.createElement("span");
      badge.className = "source-badge";
      badge.textContent = src.index;
      item.appendChild(badge);

      const title = document.createElement("span");
      title.className = "source-title";
      title.textContent = src.title || src.url;
      item.appendChild(title);

      sourcesList.appendChild(item);
    });
  }

  function makeCitationsClickable(container, sources) {
    if (!container || !sources || !sources.length) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const citationRegex = /\[Source (\d+)(?:,\s*Source \d+)*\]/g;
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      if (!citationRegex.test(node.textContent)) continue;
      citationRegex.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let match;
      while ((match = citationRegex.exec(node.textContent)) !== null) {
        if (match.index > lastIdx) {
          frag.appendChild(document.createTextNode(node.textContent.slice(lastIdx, match.index)));
        }

        const nums = match[0].match(/\d+/g);
        for (let i = 0; i < nums.length; i++) {
          const num = parseInt(nums[i], 10);
          const src = sources.find(s => s.index === num);
          if (src) {
            const link = document.createElement("a");
            link.className = "citation-link";
            link.href = src.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `[${num}]`;
            link.title = src.title || src.url;
            frag.appendChild(link);
          } else {
            frag.appendChild(document.createTextNode(`[${num}]`));
          }
          if (i < nums.length - 1) frag.appendChild(document.createTextNode(", "));
        }
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < node.textContent.length) {
        frag.appendChild(document.createTextNode(node.textContent.slice(lastIdx)));
      }
      node.parentNode.replaceChild(frag, node);
    }
  }

  // ── Follow-up / re-analysis answer block ──
  function createAnswerBlock(container, opts = {}) {
    // opts: { question, provider, model, isReanalysis }
    if (opts.question) {
      const qDiv = document.createElement("div");
      qDiv.className = opts.isReanalysis ? "reanalyze-label" : "followup-question";
      qDiv.textContent = opts.isReanalysis
        ? `Re-analysis: ${opts.question}`
        : `Follow-up: ${opts.question}`;
      container.appendChild(qDiv);
    }

    const hr = document.createElement("hr");
    hr.className = "followup-divider";
    container.appendChild(hr);

    const answerDiv = document.createElement("div");
    answerDiv.className = "followup-answer streaming";
    container.appendChild(answerDiv);
    return answerDiv;
  }

  function finalizeAnswerBlock(answerDiv, data) {
    answerDiv.classList.remove("streaming");

    // Add attribution
    if (data.provider || data.model) {
      const attrDiv = document.createElement("div");
      attrDiv.className = "followup-meta";
      let text = providerLabel(data.provider);
      if (data.model) text += text ? ` (${data.model})` : data.model;
      if (data.usage) {
        text += ` | ${data.usage.prompt_tokens || "?"} in / ${data.usage.completion_tokens || "?"} out`;
      }
      attrDiv.textContent = text;
      answerDiv.appendChild(attrDiv);
    }
  }

  // ── Full viewer setup (convenience) ──
  // Wires up all standard elements for a result page.
  // Returns an object with update methods.
  function create(config) {
    // config: { contentEl, metaEl, thinkingSection, thinkingToggle,
    //           thinkingContent, errorContainer, errorMessage,
    //           loadingContainer, sourcesPanel, sourcesList,
    //           copyBtn, mdBtn, htmlBtn, txtBtn, printBtn }
    let _rawMarkdown = "";
    let _title = "";

    // Wire thinking toggle
    if (config.thinkingToggle && config.thinkingContent) {
      initThinkingToggle(config.thinkingToggle, config.thinkingContent);
    }

    // Wire export buttons
    initExportButtons({
      copyBtn: config.copyBtn,
      mdBtn: config.mdBtn,
      htmlBtn: config.htmlBtn,
      txtBtn: config.txtBtn,
      printBtn: config.printBtn,
      getMarkdown: () => _rawMarkdown,
      getTitle: () => _title,
    });

    return {
      setTitle(title) { _title = title; },

      setContent(md) {
        _rawMarkdown = md;
        renderMarkdown(md, config.contentEl);
      },

      appendContent(md) {
        _rawMarkdown += md;
        renderMarkdown(_rawMarkdown, config.contentEl);
      },

      getRawMarkdown() { return _rawMarkdown; },
      setRawMarkdown(md) { _rawMarkdown = md; },

      setMeta(data) {
        if (config.metaEl) config.metaEl.textContent = formatMeta(data);
      },

      setMetaText(text) {
        if (config.metaEl) config.metaEl.textContent = text;
      },

      setThinking(text) {
        updateThinking(config.thinkingSection, config.thinkingContent, text);
      },

      appendThinking(text) {
        if (text && config.thinkingSection) {
          config.thinkingSection.classList.remove("hidden");
          appendThinking(config.thinkingContent, text);
        }
      },

      setSources(sources) {
        if (config.sourcesPanel && sources && sources.length) {
          config.sourcesPanel.classList.remove("hidden");
          renderSources(config.sourcesList, sources);
        }
      },

      makeCitationsClickable(sources) {
        makeCitationsClickable(config.contentEl, sources);
      },

      setStreaming(on) {
        setStreaming(config.contentEl, on);
      },

      showError(message) {
        showError(config.errorContainer, config.errorMessage, config.loadingContainer, message);
      },

      showLoading(show) {
        if (config.loadingContainer) {
          config.loadingContainer.classList.toggle("hidden", !show);
        }
      },

      showResults(show) {
        if (config.resultsContainer) {
          config.resultsContainer.classList.toggle("hidden", !show);
        }
      },
    };
  }

  // ── Public API ──
  return {
    PROVIDER_NAMES,
    providerLabel,
    renderMarkdown,
    formatMeta,
    updateThinking,
    appendThinking,
    initThinkingToggle,
    initExportButtons,
    showError,
    setStreaming,
    renderSources,
    makeCitationsClickable,
    createAnswerBlock,
    finalizeAnswerBlock,
    tryFormatEntityJson,
    create,
  };
})();
