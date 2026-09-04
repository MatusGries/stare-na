// decodeEntities.ts — Are.na returns some titles HTML-entity-encoded
// ("EVA ⋆｡°✩" → "EVA &#x22C6;&#xFF61;&#xB0;&#x2729;"). This runs inside the
// Web Worker, so no DOM (textarea/DOMParser) is available — decode by hand.
// Handles numeric decimal, numeric hex, and the five predefined named
// entities. Unknown named entities are left untouched (never worse than raw).
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

export const decodeEntities = (input: string): string => {
  if (!input || input.indexOf("&") === -1) return input;
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const cp = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff) {
        try { return String.fromCodePoint(cp); } catch { return whole; }
      }
      return whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
};
