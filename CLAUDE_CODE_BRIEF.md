# Stare.na — Claude Code Implementation Brief

This document tells you exactly what to change in the React/R3F codebase to
match the upgraded prototype design. Read it fully before touching any file.

---

## 0. Context

**Project:** Knowledge Nebula — Are.na channel visualizer, gift for Tereza Slančíková.
**Stack:** React 18 + TypeScript + React Three Fiber v8 + drei v9 + @react-three/postprocessing + Tailwind + Vite.
**No new npm packages** unless listed explicitly below.

The `public/data/channels.json` file will be replaced by real Are.na data once
the Python pipeline runs. All frontend changes must work with both the current
mock JSON and the real one.

---

## 1. Update the Channel type

File: `src/types/channel.ts`

Replace the entire file with:

```ts
export interface Block {
  id: number;
  title: string;
  kind: string;        // "Image" | "Text" | "Link" | "Media" | "Attachment"
  imageUrl?: string | null;
}

export interface Channel {
  id: string;
  slug: string;
  title: string;
  description: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  emissiveIntensity?: number;   // optional — not in old mock data
  blockCount?: number;
  followerCount?: number;
  neighbors: string[];
  thumbnailUrl?: string | null;
  blocks?: Block[];
}
```

---

## 2. Upgrade Star.tsx — bigger, brighter, more clickable

File: `src/components/galaxy/Star.tsx`

### 2a. Larger glow texture with wider halo

Replace the `glowTex` canvas gradient stops with:

```ts
g.addColorStop(0.00, "rgba(255,255,255,1.000)");
g.addColorStop(0.05, "rgba(255,255,255,0.920)");
g.addColorStop(0.16, "rgba(255,255,255,0.420)");
g.addColorStop(0.38, "rgba(255,255,255,0.090)");
g.addColorStop(0.60, "rgba(255,255,255,0.020)");
g.addColorStop(1.00, "rgba(255,255,255,0.000)");
```

### 2b. Larger base scale

Replace the `baseScale` calculation:

```ts
// Before:
const baseScale = 0.038 + Math.pow(t, 1.8) * 0.27;

// After:
const baseScale = 0.072 + Math.pow(t, 1.6) * 0.52;
```

### 2c. More dramatic hover / active scale

In `useFrame`, replace the `targetScale` line:

```ts
// Before:
const targetScale = isActive
  ? baseScale * 2.2
  : hovered
  ? baseScale * 1.7
  : isNeighbor
  ? baseScale * 1.18
  : baseScale;

// After:
const targetScale = isActive
  ? baseScale * 2.6
  : hovered
  ? baseScale * 2.2
  : isNeighbor
  ? baseScale * 1.25
  : baseScale;
```

---

## 3. Upgrade BlackHole.tsx — GLSL accretion disk

File: `src/components/galaxy/BlackHole.tsx`

Replace the entire file with the implementation below.
Key changes: swap torus geometry for a custom ring mesh with a GLSL shader
(Keplerian turbulence, fbm noise, warm-white → amber → rust gradient).

```tsx
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BlackHoleProps {
  onClick: () => void;
}

// Ring geometry with UV: u=0 inner edge, u=1 outer edge
function ringGeo(rIn: number, rOut: number, tSeg = 128, rSeg = 24) {
  const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let j = 0; j <= rSeg; j++) {
    const r = rIn + (rOut - rIn) * (j / rSeg);
    for (let i = 0; i <= tSeg; i++) {
      const a = (i / tSeg) * Math.PI * 2;
      verts.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      uvs.push(j / rSeg, i / tSeg);
    }
  }
  for (let j = 0; j < rSeg; j++) {
    for (let i = 0; i < tSeg; i++) {
      const a = j * (tSeg + 1) + i;
      const b = (j + 1) * (tSeg + 1) + i;
      const c = (j + 1) * (tSeg + 1) + i + 1;
      const d = j * (tSeg + 1) + i + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

const DISK_VERT = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

const DISK_FRAG = `
uniform float uTime;
uniform float uSpeed;
varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){return n(p)*.5+n(p*2.+1.7)*.25+n(p*4.+3.3)*.125+n(p*8.+5.7)*.0625;}
void main(){
  float r=vUv.x;
  float ang=vUv.y;
  float swirl=ang*6.2832+uTime*uSpeed*(1.0-r*.75);
  vec2 nc=vec2(cos(swirl),sin(swirl))*(r*2.2+.4)+uTime*.07;
  float t1=fbm(nc);
  float t2=fbm(nc*1.8+vec2(4.1,2.3));
  vec3 c1=vec3(1.00,.94,.76);
  vec3 c2=vec3(.98,.50,.07);
  vec3 c3=vec3(.52,.15,.02);
  vec3 c4=vec3(.11,.03,.00);
  vec3 col;
  if(r<.33)col=mix(c1,c2,r/.33);
  else if(r<.66)col=mix(c2,c3,(r-.33)/.33);
  else col=mix(c3,c4,(r-.66)/.34);
  col*=.32+t1*1.4+t2*.28;
  float alpha=(0.42+t1*.78+t2*.18)
    *smoothstep(0.,.07,r)*smoothstep(1.,.52,r);
  alpha=clamp(alpha*.9,0.,1.);
  gl_FragColor=vec4(col,alpha);
}`;

function useDiskMat(speed: number) {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
    uniforms: { uTime: { value: 0 }, uSpeed: { value: speed } },
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), [speed]);
}

const BlackHole = ({ onClick }: BlackHoleProps) => {
  const photonRef   = useRef<THREE.Mesh>(null);
  const innerRef    = useRef<THREE.Mesh>(null);
  const outerRef    = useRef<THREE.Mesh>(null);
  const innerMat    = useDiskMat(0.48);
  const outerMat    = useDiskMat(0.16);

  const innerGeo = useMemo(() => ringGeo(0.86, 2.0, 128, 28), []);
  const outerGeo = useMemo(() => ringGeo(1.9,  3.2, 128, 16), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (photonRef.current) photonRef.current.rotation.z = -t * 0.22;
    if (innerRef.current)  innerRef.current.rotation.z  =  t * 0.09;
    if (outerRef.current)  outerRef.current.rotation.z  =  t * 0.04;
    innerMat.uniforms.uTime.value = t;
    outerMat.uniforms.uTime.value = t;
  });

  return (
    <group
      position={[0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {/* Void core */}
      <mesh>
        <sphereGeometry args={[0.72, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Gravitational shadow */}
      <mesh>
        <sphereGeometry args={[1.85, 32, 32]} />
        <meshBasicMaterial color="#010208" transparent opacity={0.20} side={THREE.BackSide} />
      </mesh>

      {/* Soft corona */}
      <mesh>
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial color="#c87822" transparent opacity={0.018} side={THREE.BackSide} toneMapped={false} />
      </mesh>

      {/* Photon ring */}
      <mesh ref={photonRef} rotation={[Math.PI / 2.08, 0.16, 0]}>
        <torusGeometry args={[0.94, 0.016, 16, 200]} />
        <meshStandardMaterial
          color="#ffffff" emissive="#d0e8ff" emissiveIntensity={7}
          transparent opacity={0.92} toneMapped={false}
        />
      </mesh>

      {/* Inner accretion disk */}
      <mesh ref={innerRef} geometry={innerGeo} material={innerMat}
        rotation={[Math.PI / 2 - 0.26, 0.06, 0]} />

      {/* Outer dust */}
      <mesh ref={outerRef} geometry={outerGeo} material={outerMat}
        rotation={[Math.PI / 2 - 0.30, -0.05, 0]} />

      {/* Hit sphere */}
      <mesh>
        <sphereGeometry args={[2.2, 12, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
};

export default BlackHole;
```

---

## 4. Upgrade Bloom in Galaxy.tsx

File: `src/components/galaxy/Galaxy.tsx`

Find the `<Bloom>` component and update its props:

```tsx
// Before:
<Bloom luminanceThreshold={0.022} luminanceSmoothing={0.92} intensity={1.25} radius={0.96} />

// After:
<Bloom luminanceThreshold={0.015} luminanceSmoothing={0.92} intensity={1.65} radius={0.68} />
```

---

## 5. Upgrade SidePanel.tsx — add block count + slug link

File: `src/components/galaxy/SidePanel.tsx`

### 5a. Import the updated type

```ts
import type { Channel } from "@/types/channel";
```

(Already imported — no change needed.)

### 5b. Add block count below the title

After the title `<div>` and before the description `<p>`, insert:

```tsx
{/* Meta row */}
{(channel.blockCount !== undefined || channel.followerCount !== undefined) && (
  <div className="flex gap-5 mb-6 font-mono text-[9px] tracking-[0.12em] text-white/20">
    {channel.blockCount !== undefined && (
      <span><span className="text-white/40">{channel.blockCount}</span> blocks</span>
    )}
    {channel.followerCount !== undefined && (
      <span><span className="text-white/40">{channel.followerCount}</span> followers</span>
    )}
  </div>
)}
```

### 5c. Fix the Are.na link to use slug

Replace:
```tsx
href={`https://www.are.na/channel/${channel.id}`}
```
With:
```tsx
href={`https://www.are.na/tereza-slancikova/${channel.slug || channel.id}`}
```

### 5d. Add block preview grid (after the Nearby section)

```tsx
{/* Block previews */}
{channel.blocks && channel.blocks.length > 0 && (
  <div className="mb-9">
    <p className="text-[9px] uppercase tracking-[0.22em] text-white/18 mb-4">
      Contents
    </p>
    <div className="grid grid-cols-3 gap-1.5">
      {channel.blocks.slice(0, 6).map((b) => (
        <a
          key={b.id}
          href={`https://www.are.na/block/${b.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="aspect-square rounded overflow-hidden bg-white/[0.04] border border-white/[0.05] flex items-center justify-center group"
          title={b.title}
        >
          {b.imageUrl ? (
            <img
              src={b.imageUrl}
              alt={b.title}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity"
            />
          ) : (
            <span className="text-[8px] text-white/20 px-1.5 leading-tight text-center line-clamp-3">
              {b.title || b.kind}
            </span>
          )}
        </a>
      ))}
    </div>
  </div>
)}
```

---

## 6. Add intro sequence to Index.tsx

File: `src/pages/Index.tsx`

### 6a. Add intro state

```tsx
const [introVisible, setIntroVisible] = useState(true);

useEffect(() => {
  const t1 = setTimeout(() => {
    setIntroVisible(false);
  }, 4200);
  return () => clearTimeout(t1);
}, []);
```

### 6b. Add intro overlay JSX (inside the return, before `<SearchBar>`)

```tsx
{/* Intro overlay */}
{introVisible && (
  <div
    style={{
      position: "absolute", inset: 0, zIndex: 50,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14,
      background: "#000004",
      opacity: introVisible ? 1 : 0,
      transition: "opacity 1.8s ease",
      pointerEvents: "none",
    }}
  >
    <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.34em",
      color: "rgba(255,255,255,0.26)", textTransform: "uppercase",
      animation: "fadeUp 2.2s ease forwards" }}>
      Tereza Slančíková
    </p>
    <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.11)",
      letterSpacing: "0.06em",
      animation: "fadeUp 2.2s 0.5s ease forwards", opacity: 0 }}>
      the shape of a mind, mapped in space
    </p>
    <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.28em",
      textTransform: "uppercase", color: "rgba(255,255,255,0.18)",
      marginTop: 28,
      animation: "fadeUp 2.2s 1.4s ease forwards", opacity: 0 }}>
      each star is a channel · click to explore · search to navigate
    </p>
  </div>
)}
```

### 6c. Add keyframe CSS to `src/index.css`

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 7. Nothing else to change

- `Galaxy.tsx` scene composition: no changes beyond Bloom (step 4)
- `CameraController.tsx`: already correct, keep as-is
- `ProfilePanel.tsx`: keep as-is
- `SearchBar.tsx`: keep as-is
- `constants.ts`: keep as-is

---

## 8. Verify

```bash
npm run dev
```

Expected behaviour:
- Intro overlays for ~4 seconds with name, tagline, and hint text
- Stars are noticeably larger and brighter than before
- Hovering a star grows it dramatically (2.2×) — cursor turns pointer
- Clicking a star opens the side panel with block count and block grid
- The black hole has an animated amber accretion disk (GLSL shader)
- Bloom is stronger overall

If `channels.json` still has the old mock schema (no `slug`, `blockCount`, etc.),
the block grid and meta row simply won't render — that's fine. Everything
degrades gracefully via optional chaining.
