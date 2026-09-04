// ConstellationLabels.tsx — the named clusters, visible IN the galaxy.
// A label floats at each cluster's centroid and fades with camera distance,
// so the regions read as named places rather than a caption strip.
//
//   cluster members ──mean──> centroid ──Html(3D)──> "cookbook · dreaming"
//                                  │
//                     camera distance ──> opacity (near = clear, far = ghost)
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Channel } from "@/types/channel";
import type { Constellation } from "@/lib/pipeline/constellations";
import { COORD_SCALE } from "./constants";

const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const Label = ({
  constellation,
  position,
  onSelect,
  dimmed,
}: {
  constellation: Constellation;
  position: THREE.Vector3;
  onSelect: () => void;
  dimmed: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const d = camera.position.distanceTo(position);
    // clear between ~20 and ~70 units out; ghosted when very close or far
    const near = THREE.MathUtils.smoothstep(d, 8, 22);
    const far = 1 - THREE.MathUtils.smoothstep(d, 80, 130);
    const target = near * far * (dimmed ? 0.22 : 0.95);
    const cur = parseFloat(ref.current.style.opacity || "0");
    ref.current.style.opacity = String(cur + (target - cur) * 0.08);
  });

  return (
    <Html position={position} center zIndexRange={[8, 0]} style={{ pointerEvents: "none" }}>
      <div
        ref={ref}
        onClick={onSelect}
        title={`${constellation.count} channels`}
        style={{
          opacity: 0,
          pointerEvents: dimmed ? "none" : "auto",
          cursor: "pointer",
          fontFamily: mono,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          color: "rgba(255,255,255,1)",
          // Dark halo + faint glow: legible over both empty space and bloom
          textShadow:
            "0 0 14px rgba(0,0,4,0.98), 0 0 4px rgba(0,0,4,0.95), 0 1px 3px rgba(0,0,4,0.9), 0 0 22px rgba(190,215,255,0.28)",
          userSelect: "none",
          transform: "translateY(-14px)",
        }}
      >
        {constellation.name}
      </div>
    </Html>
  );
};

const ConstellationLabels = ({
  constellations,
  channels,
  dimmed,
  onSelect,
}: {
  constellations: Constellation[];
  channels: Channel[];
  /** Fade back while the user is reading a panel or searching. */
  dimmed: boolean;
  /** Clicking a name frames the cluster and opens its summary. */
  onSelect: (constellation: Constellation) => void;
}) => {
  const byId = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const placed = useMemo(
    () =>
      constellations.map((c) => {
        const members = c.channelIds.map((id) => byId.get(id)).filter(Boolean) as Channel[];
        const mean = members.reduce(
          (acc, m) => [acc[0] + m.x, acc[1] + m.y, acc[2] + m.z] as [number, number, number],
          [0, 0, 0] as [number, number, number]
        );
        const n = Math.max(members.length, 1);
        return {
          constellation: c,
          position: new THREE.Vector3(
            (mean[0] / n) * COORD_SCALE,
            (mean[1] / n) * COORD_SCALE,
            (mean[2] / n) * COORD_SCALE
          ),
        };
      }),
    [constellations, byId]
  );

  return (
    <>
      {placed.map(({ constellation, position }) => (
        <Label
          key={constellation.anchorId}
          constellation={constellation}
          position={position}
          dimmed={dimmed}
          onSelect={() => onSelect(constellation)}
        />
      ))}
    </>
  );
};

export default ConstellationLabels;
