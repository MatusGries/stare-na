// The math behind the constellation view: centroid + a camera stop distance
// that frames the whole cluster. Extracted so it's testable without WebGL.
import { describe, it, expect } from "vitest";
import { clusterFraming } from "@/lib/clusterFraming";
import { COORD_SCALE } from "@/components/galaxy/constants";
import type { Channel } from "@/types/channel";

const ch = (id: string, x: number, y: number, z: number): Channel => ({
  id, slug: id, title: id, description: "",
  x, y, z, size: 1, color: "#ffffff", neighbors: [],
});

describe("clusterFraming", () => {
  it("centers on the members' centroid (in world space)", () => {
    const members = [ch("a", 0, 0, 0), ch("b", 2, 0, 0), ch("c", 4, 0, 0)];
    const f = clusterFraming(members)!;
    expect(f.center[0]).toBeCloseTo(2 * COORD_SCALE, 4);
    expect(f.center[1]).toBeCloseTo(0, 4);
  });

  it("frames wider clusters from further away", () => {
    const tight = clusterFraming([ch("a", 0, 0, 0), ch("b", 0.5, 0, 0)])!;
    const wide = clusterFraming([ch("a", -6, 0, 0), ch("b", 6, 0, 0)])!;
    expect(wide.distance).toBeGreaterThan(tight.distance);
  });

  it("clamps distance to a sane range (never inside the cluster, never lost)", () => {
    const pinpoint = clusterFraming([ch("a", 1, 1, 1)])!;
    expect(pinpoint.distance).toBeGreaterThanOrEqual(14);
    const enormous = clusterFraming([ch("a", -8, -8, -8), ch("b", 8, 8, 8)])!;
    expect(enormous.distance).toBeLessThanOrEqual(80);
  });

  it("returns null for an empty cluster", () => {
    expect(clusterFraming([])).toBeNull();
  });
});
