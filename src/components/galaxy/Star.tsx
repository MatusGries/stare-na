import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Channel } from "@/types/channel";
import { COORD_SCALE } from "./constants";

interface StarProps {
  channel: Channel;
  isActive: boolean;
  isFiltered: boolean;
  searchActive: boolean;
  isNeighbor: boolean;
  /** Condensation reveal (generated galaxies): star flies in from a seeded
   *  scatter position over ~4s. Absent/false on the root route — zero change. */
  reveal?: boolean;
  /** Milestone-B epoch playback: an external driver owns this star's position;
   *  skip all internal position writes (reveal, drift) until it finishes. */
  positionDriven?: boolean;
  /** Registry hook for the epoch driver (called with null on unmount). */
  registerGroup?: (id: string, group: import("three").Group | null) => void;
  onClick: (channel: Channel) => void;
}

const REVEAL_SECONDS = 4;
/** Camera distance at which a star renders at its nominal size (≈ the
 *  focused-star distance); further out, stars scale up to stay legible. */
const REF_DISTANCE = 18;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Deterministic per-channel scatter start: a point on a far shell, plus a
// small per-star delay so the condensation reads organic, not synchronized.
const revealStart = (id: string, baseY: number) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const u = ((h >>> 0) % 10000) / 10000;
  const v = ((Math.imul(h, 48271) >>> 0) % 10000) / 10000;
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * v - 1);
  const r = 26 + u * 10;
  return {
    x: Math.sin(phi) * Math.cos(theta) * r,
    y: baseY + Math.cos(phi) * r * 0.5,
    z: Math.sin(phi) * Math.sin(theta) * r,
    delay: v * 0.8,
  };
};

// Shared radial glow texture — photographic PSF: very tight bright core, near-invisible halo
const glowTex = (() => {
  const sz = 128;
  const canvas = document.createElement("canvas");
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  const h = sz / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  // Slightly fuller halo than a pure photographic PSF: the tight core alone
  // read as dust at overview distance.
  g.addColorStop(0.00, "rgba(255,255,255,1.000)");
  g.addColorStop(0.06, "rgba(255,255,255,0.960)");
  g.addColorStop(0.18, "rgba(255,255,255,0.560)");
  g.addColorStop(0.40, "rgba(255,255,255,0.160)");
  g.addColorStop(0.62, "rgba(255,255,255,0.040)");
  g.addColorStop(1.00, "rgba(255,255,255,0.000)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  const t = new THREE.CanvasTexture(canvas);
  t.needsUpdate = true;
  return t;
})();

// Mostly pure white; 1-in-5 has a barely perceptible cool shift — organic, not decorative
const TINTS = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#edf2ff"];
const getTint = (id: string) =>
  new THREE.Color(TINTS[(id.charCodeAt(0) * 31 + (id.charCodeAt(1) ?? 0) * 7) % TINTS.length]);

const Star = ({
  channel,
  isActive,
  isFiltered,
  searchActive,
  isNeighbor,
  reveal,
  positionDriven,
  registerGroup,
  onClick,
}: StarProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!registerGroup) return;
    registerGroup(channel.id, groupRef.current);
    return () => registerGroup(channel.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, registerGroup]);

  const baseY = channel.y * COORD_SCALE;
  // Reveal clock: negative = per-star delay still elapsing; >=1 = settled.
  const revealT = useRef(reveal ? Number.NEGATIVE_INFINITY : 1);
  const revealFrom = useMemo(
    () => (reveal ? revealStart(channel.id, baseY) : null),
    [reveal, channel.id, baseY]
  );
  // Size curve: every channel reads as a real star (raised floor), anchors
  // still dominate. The old floor (0.072) rendered small channels as
  // sub-pixel dust that disappeared entirely at overview distance.
  const t = Math.max(0, Math.min(1, (channel.size - 1.1) / 0.9));
  const baseScale = 0.15 + Math.pow(t, 1.25) * 0.55;

  const drift = useMemo(
    () => ({
      phase: channel.x * 11.3 + channel.z * 7.7,
      speed: 0.038 + (channel.id.charCodeAt(0) % 8) * 0.003,
      amp: 0.005 + ((channel.id.charCodeAt(1) ?? 0) % 4) * 0.0025,
    }),
    [channel]
  );

  // Pre-allocate color targets — never new THREE.Color() in useFrame
  const colors = useMemo(
    () => ({
      base: getTint(channel.id),
      active: new THREE.Color("#fffdf8"), // barely warm: distinguishable without feeling like gold
      hover: new THREE.Color("#ffffff"),
      // neighbors use base color — the filament lines carry the semantic meaning
    }),
    [channel.id]
  );

  useFrame(({ clock, camera }, delta) => {
    if (!groupRef.current || !matRef.current) return;
    const t = clock.getElapsedTime();

    // Distance compensation: a fixed-size sprite shrinks toward sub-pixel as
    // the camera pulls back, which is why the galaxy looked faint zoomed out.
    // sqrt keeps SOME depth falloff (full compensation would flatten the scene).
    const dist = camera.position.distanceTo(groupRef.current.position);
    const distScale = Math.min(2.1, Math.max(0.9, Math.sqrt(dist / REF_DISTANCE)));
    const scaleFor = (s: number) => s * distScale;

    if (positionDriven) {
      // Epoch driver owns position; keep scale/opacity/color behavior only.
      const s0 = groupRef.current.scale.x;
      const target = scaleFor(baseScale);
      groupRef.current.scale.setScalar(s0 + (target - s0) * 0.1);
      matRef.current.opacity += (1.0 - matRef.current.opacity) * 0.12;
      return;
    }

    // Condensation reveal: fly in from the seeded scatter, then hand over to
    // the normal drift. Delta-based (frame-rate independent — see
    // CameraController for why that matters).
    if (revealT.current < 1 && revealFrom) {
      if (revealT.current === Number.NEGATIVE_INFINITY) revealT.current = -revealFrom.delay / REVEAL_SECONDS;
      revealT.current += delta / REVEAL_SECONDS;
      const e = easeOutCubic(Math.min(1, Math.max(0, revealT.current)));
      const tx = channel.x * COORD_SCALE;
      const tz = channel.z * COORD_SCALE;
      groupRef.current.position.x = revealFrom.x + (tx - revealFrom.x) * e;
      groupRef.current.position.z = revealFrom.z + (tz - revealFrom.z) * e;
      groupRef.current.position.y = revealFrom.y + (baseY - revealFrom.y) * e;
      matRef.current.opacity = Math.min(1, 0.15 + e);
      return; // drift/scale/color take over once settled
    }

    // Imperceptible vertical drift — adds life without noise
    groupRef.current.position.y =
      baseY + Math.sin(t * drift.speed + drift.phase) * drift.amp;

    // Smooth scale toward state target (distance-compensated)
    const targetScale = scaleFor(
      isActive
        ? baseScale * 2.6
        : hovered
        ? baseScale * 2.2
        : isNeighbor
        ? baseScale * 1.25
        : baseScale
    );
    const s = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(s + (targetScale - s) * 0.10);

    // Smooth opacity
    const targetOp = searchActive && !isFiltered ? 0.035 : 1.0;
    matRef.current.opacity += (targetOp - matRef.current.opacity) * 0.12;

    // Smooth color shift — neighbors use base color (filaments carry semantic meaning)
    const tc = isActive ? colors.active : hovered ? colors.hover : colors.base;
    matRef.current.color.lerp(tc, 0.10);
  });

  const showLabel = (hovered || isActive) && (!searchActive || isFiltered);

  return (
    <group
      ref={groupRef}
      position={
        revealFrom
          ? [revealFrom.x, revealFrom.y, revealFrom.z]
          : [channel.x * COORD_SCALE, baseY, channel.z * COORD_SCALE]
      }
      scale={baseScale}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(channel);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Invisible hit sphere — the visible sprite core is far too small to hover/click reliably */}
      <mesh>
        <sphereGeometry args={[1.5, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <sprite>
        <spriteMaterial
          ref={matRef}
          map={glowTex}
          color={colors.base}
          transparent
          opacity={searchActive && !isFiltered ? 0.035 : 1.0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {showLabel && (
        <Html center distanceFactor={10} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              marginTop: "20px",
              color: "rgba(255,255,255,0.85)",
              // Keeps the label readable against the accretion disk / bloom near the core
              textShadow: "0 0 6px rgba(0,0,4,0.95), 0 1px 2px rgba(0,0,4,0.9)",
              fontSize: "11px",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              userSelect: "none",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 300,
            }}
          >
            {channel.title}
          </div>
        </Html>
      )}
    </group>
  );
};

export default Star;
