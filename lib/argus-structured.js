// ──────────────────────────────────────────────
// Argus Structured Data Parser
// Extracts the <!--ARGUS_DATA:{json}:ARGUS_DATA--> block from AI responses.
// Used by background scripts (KG extraction, history) and results page (display).
// ──────────────────────────────────────────────

const ArgusStructured = (() => {
  'use strict';

  const START = "<!--ARGUS_DATA:";
  const END = ":ARGUS_DATA-->";

  /**
   * Parse structured data from an AI response.
   * @param {string} content — full AI response text
   * @returns {{ prose: string, data: object|null, raw: string|null }}
   *   - prose: the response with the structured block stripped (for display)
   *   - data: parsed JSON object, or null if not found/invalid
   *   - raw: the raw JSON string, or null
   */
  function parse(content) {
    if (!content || typeof content !== "string") {
      return { prose: content || "", data: null, raw: null };
    }

    const startIdx = content.lastIndexOf(START);
    if (startIdx === -1) {
      return { prose: content, data: null, raw: null };
    }

    const jsonStart = startIdx + START.length;
    const endIdx = content.indexOf(END, jsonStart);
    if (endIdx === -1) {
      // Delimiter started but never closed — treat as no structured data
      return { prose: content, data: null, raw: null };
    }

    const rawJson = content.substring(jsonStart, endIdx).trim();
    const prose = content.substring(0, startIdx).trimEnd();

    let data = null;
    try {
      data = JSON.parse(rawJson);
    } catch (e) {
      // Try cleaning common AI quirks: markdown fences inside delimiters
      try {
        const cleaned = rawJson
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "")
          .trim();
        data = JSON.parse(cleaned);
      } catch {
        console.warn("[ArgusStructured] Failed to parse JSON:", e.message);
      }
    }

    return { prose, data, raw: rawJson };
  }

  /**
   * Strip the structured data block from content, returning only prose.
   * @param {string} content
   * @returns {string}
   */
  function stripBlock(content) {
    return parse(content).prose;
  }

  /**
   * Extract just the structured data from content.
   * @param {string} content
   * @returns {object|null}
   */
  function extractData(content) {
    return parse(content).data;
  }

  /**
   * Check if content contains a structured data block.
   * @param {string} content
   * @returns {boolean}
   */
  function hasBlock(content) {
    return content && content.includes(START) && content.includes(END);
  }

  /**
   * Validate structured data against base schema expectations.
   * Returns the data with defaults filled in for missing fields.
   * @param {object} data
   * @returns {object}
   */
  function normalize(data) {
    if (!data || typeof data !== "object") return null;
    return {
      entities: Array.isArray(data.entities) ? data.entities.filter(e => e && e.name) : [],
      confidence: typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence)) : null,
      topics: Array.isArray(data.topics) ? data.topics.filter(t => typeof t === "string") : [],
      // Pass through any preset-specific fields
      ...Object.fromEntries(
        Object.entries(data).filter(([k]) => !["entities", "confidence", "topics"].includes(k))
      )
    };
  }

  return { parse, stripBlock, extractData, hasBlock, normalize, START, END };
})();

// Make available in both background (global) and page (window) contexts
if (typeof globalThis !== "undefined") globalThis.ArgusStructured = ArgusStructured;
