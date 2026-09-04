// Are.na entity-encodes symbol-heavy titles; the worker has no DOM to decode
// with, so decodeEntities does it by hand.
import { describe, it, expect } from "vitest";
import { decodeEntities } from "@/lib/decodeEntities";

describe("decodeEntities", () => {
  it("decodes the real-world case: EVA ⋆｡°✩", () => {
    expect(decodeEntities("EVA &#x22C6;&#xFF61;&#xB0;&#x2729;")).toBe("EVA ⋆｡°✩");
  });

  it("decodes decimal, hex, and named entities", () => {
    expect(decodeEntities("&#8902;")).toBe("⋆");
    expect(decodeEntities("&#x2729;")).toBe("✩");
    expect(decodeEntities("tea &amp; toast")).toBe("tea & toast");
    expect(decodeEntities("&lt;3 &quot;yes&quot;")).toBe('<3 "yes"');
  });

  it("handles astral-plane codepoints (emoji)", () => {
    expect(decodeEntities("&#x1F30C;")).toBe("🌌");
  });

  it("leaves plain text and unknown entities untouched", () => {
    expect(decodeEntities("plain title")).toBe("plain title");
    expect(decodeEntities("a & b")).toBe("a & b");
    expect(decodeEntities("&notarealentity;")).toBe("&notarealentity;");
    expect(decodeEntities("")).toBe("");
  });

  it("ignores out-of-range numeric entities rather than throwing", () => {
    expect(decodeEntities("&#x110000;")).toBe("&#x110000;");
    expect(decodeEntities("&#999999999;")).toBe("&#999999999;");
  });
});
