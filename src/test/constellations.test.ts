// Unit tests for B3 constellation clustering + naming.
import { describe, it, expect } from "vitest";
import { nameConstellations } from "@/lib/pipeline/constellations";
import type { Channel } from "@/types/channel";

const mkChannel = (id: string, title: string, pos: [number, number, number], blockCount = 10): Channel => ({
  id,
  slug: id,
  title,
  description: "",
  x: pos[0], y: pos[1], z: pos[2],
  size: 1, color: "#ffffff", neighbors: [],
  blockCount,
});

/** Three tight spatial blobs with clearly themed titles. */
const themedGalaxy = (): Channel[] => {
  const out: Channel[] = [];
  const themes: [string, string[], [number, number, number]][] = [
    ["food", ["cooking pasta", "bread recipes", "kitchen rituals", "fermentation notes", "pasta shapes", "recipes to try", "kitchen tools", "bread baking", "cooking methods", "pasta archive", "kitchen design", "recipes forever"], [-6, 0, 0]],
    ["type", ["typography specimens", "fonts collection", "letterforms study", "typography history", "fonts i love", "letterforms drawn", "typography posters", "fonts foundry", "letterforms experimental", "typography grids", "fonts variable", "typography books"], [6, 0, 0]],
    ["plants", ["garden plans", "plants indoor", "botany drawings", "garden paths", "plants rare", "botany archive", "garden design", "plants desert", "botany illustrations", "garden tools", "plants aquatic", "botany field notes"], [0, 6, 0]],
  ];
  let i = 0;
  for (const [prefix, titles, center] of themes) {
    titles.forEach((t, j) => {
      const jitter = (n: number) => n + ((j * 37) % 10) / 10 - 0.5;
      out.push(mkChannel(`${prefix}-${j}`, t, [jitter(center[0]), jitter(center[1]), jitter(center[2])], 5 + j));
      i++;
    });
  }
  return out;
};

describe("nameConstellations", () => {
  it("finds the three themed clusters and names them with distinctive tokens", () => {
    const cs = nameConstellations(themedGalaxy());
    expect(cs.length).toBe(3);
    const names = cs.map((c) => c.name).join(" | ");
    expect(names).toMatch(/pasta|recipes|kitchen|bread|cooking|fermentation/);
    expect(names).toMatch(/typography|fonts|letterforms/);
    expect(names).toMatch(/garden|plants|botany/);
  });

  it("is deterministic", () => {
    const a = nameConstellations(themedGalaxy());
    const b = nameConstellations(themedGalaxy());
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("anchor is the largest channel in its cluster", () => {
    const cs = nameConstellations(themedGalaxy());
    for (const c of cs) {
      // ids end with their index; blockCount = 5 + index → largest index wins
      expect(c.anchorId).toMatch(/-11$/);
      expect(c.channelIds[0]).toBe(c.anchorId);
    }
  });

  it("returns nothing for tiny galaxies", () => {
    const cs = nameConstellations(themedGalaxy().slice(0, 8));
    expect(cs).toEqual([]);
  });
});
