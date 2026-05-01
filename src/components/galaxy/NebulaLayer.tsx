import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Single shared cloud shape — colour controlled per-mesh via material.color
const nebulaTex = (() => {
  const sz = 512;
  const canvas = document.createElement("canvas");
  canvas.width = sz; canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  ctx.globalCompositeOperation = "lighter";

  const blob = (cx: number, cy: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.4, `rgba(255,255,255,${(a * 0.35).toFixed(3)})`);
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  blob(sz * 0.50, sz * 0.50, sz * 0.44, 0.18);
  blob(sz * 0.37, sz * 0.43, sz * 0.28, 0.11);
  blob(sz * 0.63, sz * 0.56, sz * 0.23, 0.09);
  blob(sz * 0.48, sz * 0.31, sz * 0.19, 0.07);
  blob(sz * 0.54, sz * 0.70, sz * 0.15, 0.06);

  const t = new THREE.CanvasTexture(canvas);
  t.needsUpdate = true;
  return t;
})();

// Dust band texture — vertical gradient for a narrow dark lane
const dustTex = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0.00, "rgba(0,0,0,0)");
  g.addColorStop(0.45, "rgba(0,0,0,1)");
  g.addColorStop(0.55, "rgba(0,0,0,1)");
  g.addColorStop(1.00, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 32);
  const t = new THREE.CanvasTexture(canvas);
  t.needsUpdate = true;
  return t;
})();

// position, euler rotation, size, hex tint — envelop the scaled galaxy
const NEBULAS: {
  pos: [number, number, number];
  rot: [number, number, number];
  w: number; h: number;
  color: string;
}[] = [
  { pos: [0, -1, 14],   rot: [0.18, 0.08, 0],   w: 64, h: 42, color: "#1a2250" },
  { pos: [-4, 2, 8],    rot: [0.10, 0.28, 0],   w: 44, h: 32, color: "#102038" },
  { pos: [9, -2, -1],   rot: [0.28, -0.18, 0],  w: 52, h: 38, color: "#160c26" },
  { pos: [0, 4, -10],   rot: [0.08, 0.02, 0],   w: 78, h: 56, color: "#0a1020" },
  { pos: [-6, -1, 22],  rot: [0.14, 0.12, 0],   w: 48, h: 34, color: "#18101c" },
];

// Subtle dust lanes — dark, slightly absorbing, add perceived depth
const DUST_BANDS: {
  pos: [number, number, number];
  rot: [number, number, number];
  w: number; h: number;
  opacity: number;
}[] = [
  { pos: [2, -0.8, 11],  rot: [0.04,  0.08,  0], w: 58, h: 4.0, opacity: 0.055 },
  { pos: [-3, 0.5, 6],   rot: [-0.03, 0.14,  0], w: 44, h: 3.0, opacity: 0.040 },
];

const NebulaLayer = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Imperceptible drift — 5° per minute. Creates flow without feeling animated.
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.00145;
    }
  });

  return (
    <group ref={groupRef}>
      {NEBULAS.map((n, i) => (
        <mesh key={i} position={n.pos} rotation={n.rot}>
          <planeGeometry args={[n.w, n.h]} />
          <meshBasicMaterial
            map={nebulaTex}
            color={n.color}
            transparent
            opacity={1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Dust bands: absorb rather than emit. NormalBlending darkens the region. */}
      {DUST_BANDS.map((d, i) => (
        <mesh key={`dust-${i}`} position={d.pos} rotation={d.rot}>
          <planeGeometry args={[d.w, d.h]} />
          <meshBasicMaterial
            map={dustTex}
            color="#000000"
            transparent
            opacity={d.opacity}
            blending={THREE.NormalBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

export default NebulaLayer;
