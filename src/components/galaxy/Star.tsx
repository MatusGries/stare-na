import { useRef, useState, useMemo } from "react";
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
  onClick: (channel: Channel) => void;
}

// Shared radial glow texture — photographic PSF: very tight bright core, near-invisible halo
const glowTex = (() => {
  const sz = 128;
  const canvas = document.createElement("canvas");
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  const h = sz / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0.00, "rgba(255,255,255,1.000)");
  g.addColorStop(0.05, "rgba(255,255,255,0.920)");
  g.addColorStop(0.16, "rgba(255,255,255,0.420)");
  g.addColorStop(0.38, "rgba(255,255,255,0.090)");
  g.addColorStop(0.60, "rgba(255,255,255,0.020)");
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
  onClick,
}: StarProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const baseY = channel.y * COORD_SCALE;
  // Steep power curve: most stars are barely-there dust; rare anchors have real presence
  const t = Math.max(0, Math.min(1, (channel.size - 1.1) / 0.9));
  const baseScale = 0.072 + Math.pow(t, 1.6) * 0.52;

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

  useFrame(({ clock }) => {
    if (!groupRef.current || !matRef.current) return;
    const t = clock.getElapsedTime();

    // Imperceptible vertical drift — adds life without noise
    groupRef.current.position.y =
      baseY + Math.sin(t * drift.speed + drift.phase) * drift.amp;

    // Smooth scale toward state target
    const targetScale = isActive
      ? baseScale * 2.6
      : hovered
      ? baseScale * 2.2
      : isNeighbor
      ? baseScale * 1.25
      : baseScale;
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
      position={[channel.x * COORD_SCALE, baseY, channel.z * COORD_SCALE]}
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
        <Html center distanceFactor={10} style={{ pointerEvents: "none" }}>
          <div
            style={{
              marginTop: "20px",
              color: "rgba(255,255,255,0.85)",
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
