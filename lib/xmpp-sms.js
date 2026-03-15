/* ──────────────────────────────────────────────
   lib/xmpp-sms.js  —  SMS helper for XMPP gateway messaging
   E.164 phone formatting, message truncation, paste-and-link fallback,
   gateway JID construction (+number@gateway.domain).
   ────────────────────────────────────────────── */

// eslint-disable-next-line no-unused-vars
const XmppSms = (() => {
  "use strict";

  const SMS_CHAR_LIMIT      = 160;   // single segment GSM-7
  const SMS_CONCAT_LIMIT    = 153;   // chars per segment in concatenated SMS
  const MAX_SEGMENTS        = 10;    // 10 segments ≈ 1530 chars
  const MAX_CHARS           = MAX_SEGMENTS * SMS_CONCAT_LIMIT; // 1530

  // Country calling codes for bare number formatting
  const COUNTRY_CODES = {
    US: "+1", CA: "+1", GB: "+44", AU: "+61", DE: "+49", FR: "+33",
    IN: "+91", JP: "+81", BR: "+55", MX: "+52", IT: "+39", ES: "+34",
    NL: "+31", SE: "+46", NO: "+47", DK: "+45", FI: "+358", PL: "+48",
    CH: "+41", AT: "+43", BE: "+32", IE: "+353", NZ: "+64", ZA: "+27",
    KR: "+82", SG: "+65", IL: "+972", AE: "+971", RU: "+7", CN: "+86"
  };

  /**
   * Normalize a phone number to E.164 format.
   * @param {string} number  - Raw phone input ("555-123-4567", "+1 555 123 4567", etc.)
   * @param {string} country - Country code key (e.g. "US") for bare numbers
   * @returns {string} E.164 formatted number (e.g. "+15551234567")
   */
  function formatE164(number, country) {
    // Strip everything except digits and leading +
    let cleaned = number.replace(/[^\d+]/g, "");

    // Already E.164
    if (cleaned.startsWith("+") && cleaned.length >= 8) return cleaned;

    // Strip leading + if partial
    cleaned = cleaned.replace(/^\+/, "");

    // Apply country code if number doesn't already include it
    const prefix = COUNTRY_CODES[country] || "+1";
    const digits = prefix.replace("+", "");

    if (!cleaned.startsWith(digits)) {
      cleaned = digits + cleaned;
    }

    return "+" + cleaned;
  }

  /**
   * Construct an XMPP JID for SMS gateway delivery.
   * @param {string} number        - Phone number (will be E.164-formatted)
   * @param {string} gatewayDomain - Gateway domain (e.g. "cheogram.com")
   * @param {string} country       - Country code key for formatting
   * @returns {string} JID (e.g. "+15551234567@cheogram.com")
   */
  function formatJid(number, gatewayDomain, country) {
    const e164 = formatE164(number, country);
    return `${e164}@${gatewayDomain}`;
  }

  /**
   * Calculate SMS segment count for a message.
   * @param {string} text
   * @returns {{ segments: number, chars: number, perSegment: number }}
   */
  function segmentCount(text) {
    const chars = text.length;
    if (chars <= SMS_CHAR_LIMIT) return { segments: 1, chars, perSegment: SMS_CHAR_LIMIT };
    const segments = Math.ceil(chars / SMS_CONCAT_LIMIT);
    return { segments, chars, perSegment: SMS_CONCAT_LIMIT };
  }

  /**
   * Strip markdown/HTML to plain text for SMS.
   * @param {string} content - Markdown or rich text
   * @returns {string} Plain text
   */
  function toPlainText(content) {
    return content
      // Remove markdown images/links
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Remove markdown formatting
      .replace(/#{1,6}\s*/g, "")
      .replace(/[*_~`]{1,3}/g, "")
      .replace(/^[-*+]\s/gm, "- ")
      .replace(/^\d+\.\s/gm, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Prepare message content for SMS, with optional truncation.
   * @param {string} content   - Raw content (markdown/text)
   * @param {string} [pasteUrl] - If content was auto-pasted, include this link
   * @returns {{ body: string, truncated: boolean, segments: number }}
   */
  function prepareMessage(content, pasteUrl) {
    let body = toPlainText(content);

    if (pasteUrl) {
      // Short message with link to full content
      const linkMsg = body.slice(0, 100).replace(/\n/g, " ") +
        (body.length > 100 ? "..." : "") +
        "\n\nFull content: " + pasteUrl +
        "\n— Argus";
      const info = segmentCount(linkMsg);
      return { body: linkMsg, truncated: true, segments: info.segments };
    }

    // Add attribution
    body += "\n— Argus";

    const info = segmentCount(body);
    if (info.chars <= MAX_CHARS) {
      return { body, truncated: false, segments: info.segments };
    }

    // Truncate to fit within segment limit
    const suffix = "...\n— Argus";
    body = body.slice(0, MAX_CHARS - suffix.length) + suffix;
    const truncInfo = segmentCount(body);
    return { body, truncated: true, segments: truncInfo.segments };
  }

  /**
   * Check if content exceeds the paste-and-link threshold.
   * @param {string} content
   * @returns {boolean}
   */
  function needsPasteLink(content) {
    const plain = toPlainText(content);
    return plain.length > MAX_CHARS;
  }

  return {
    formatE164,
    formatJid,
    segmentCount,
    toPlainText,
    prepareMessage,
    needsPasteLink,
    COUNTRY_CODES,
    SMS_CHAR_LIMIT,
    MAX_CHARS
  };
})();
