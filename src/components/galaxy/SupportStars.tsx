import { useMemo } from "react";
import * as THREE from "three";
import { COORD_SCALE } from "./constants";

// Slightly extended falloff vs channel stars — atmospheric, not semantic
const supportTex = (() => {
  const sz = 64;
  const canvas = document.createElement("canvas");
  canvas.width = sz; canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  const h = sz / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0.00, "rgba(255,255,255,1.00)");
  g.addColorStop(0.07, "rgba(255,255,255,0.60)");
  g.addColorStop(0.22, "rgba(255,255,255,0.16)");
  g.addColorStop(0.50, "rgba(255,255,255,0.03)");
  g.addColorStop(1.00, "rgba(255,255,255,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  const t = new THREE.CanvasTexture(canvas);
  t.needsUpdate = true;
  return t;
})();

// Deterministic xorshift32
const mkRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
};

interface SupportStarsProps {
  channels: { x: number; y: number; z: number }[];
}

const SupportStars = ({ channels }: SupportStarsProps) => {
  const geometries = useMemo(() => {
    if (channels.length === 0) return null;

    const rng = mkRng(0xdeadbeef);

    const n = channels.length;
    let cx = 0, cz = 0;
    for (const c of channels) { cx += c.x; cz += c.z; }
    cx /= n; cz /= n;

    let maxR = 0;
    for (const c of channels) {
      maxR = Math.max(maxR, Math.sqrt((c.x - cx) ** 2 + (c.z - cz) ** 2));
    }
    const spread = Math.max(maxR, 1.0);

    // Four tiers: micro dust, faint field, visible background, rare anchors
    const micro:   number[] = [];  // 52%
    const faint:   number[] = [];  // 30%
    const visible: number[] = [];  // 15%
    const anchor:  number[] = [];  // 3%

    for (let i = 0; i < 1100; i++) {
      // Power 0.55 concentrates distribution toward center
      const r = Math.pow(rng(), 0.55) * spread * 2.8;
      const theta = rng() * Math.PI * 2;
      const sc = (rng() - 0.5) * spread * 0.45;
      const sa = rng() * Math.PI * 2;

      const wx = (cx + r * Math.cos(theta) + sc * Math.cos(sa)) * COORD_SCALE;
      const wy = (rng() - 0.5) * 0.40 * COORD_SCALE; // slightly thicker disc
      const wz = (cz + r * Math.sin(theta) + sc * Math.sin(sa)) * COORD_SCALE;

      const tier = rng();
      if      (tier < 0.52) micro.push(wx, wy, wz);
      else if (tier < 0.82) faint.push(wx, wy, wz);
      else if (tier < 0.97) visible.push(wx, wy, wz);
      else                  anchor.push(wx, wy, wz);
    }

    const makeGeo = (arr: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      return g;
    };

    return {
      micro:   micro.length   > 0 ? makeGeo(micro)   : null,
      faint:   faint.length   > 0 ? makeGeo(faint)   : null,
      visible: visible.length > 0 ? makeGeo(visible) : null,
      anchor:  anchor.length  > 0 ? makeGeo(anchor)  : null,
    };
  }, [channels]);

  if (!geometries) return null;

  const base = {
    map: supportTex,
    sizeAttenuation: true as const,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  };

  return (
    <>
      {geometries.micro && (
        <points geometry={geometries.micro}>
          <pointsMaterial {...base} size={0.15} color="#ffffff" opacity={0.07} />
        </points>
      )}
      {geometries.faint && (
        <points geometry={geometries.faint}>
          <pointsMaterial {...base} size={0.26} color="#dde8ff" opacity={0.13} />
        </points>
      )}
      {geometries.visible && (
        <points geometry={geometries.visible}>
          <pointsMaterial {...base} size={0.44} color="#c8d8f4" opacity={0.22} />
        </points>
      )}
      {geometries.anchor && (
        <points geometry={geometries.anchor}>
          <pointsMaterial {...base} size={0.72} color="#b8ccec" opacity={0.38} />
        </points>
      )}
    </>
  );
};

export default SupportStars;
