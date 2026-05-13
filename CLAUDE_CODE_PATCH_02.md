# Stare.na — Patch 02: Motion + Overview Button

Two fixes:
1. Stabilize the scene — remove ambient rotation/drift sources so the galaxy feels anchored
2. Make the overview button discoverable — pill button with label, top-left, contextual

---

## File 1: `src/components/galaxy/Galaxy.tsx`

### Change 1a — Remove backdrop auto-rotation

Find this block (lines ~58–66):

```tsx
// Backdrop group rotates imperceptibly — nebulas and deep field drift while
// the semantic galaxy stays anchored to the embedding coordinates.
const backdropRef = useRef<THREE.Group>(null);
useFrame(({ clock }) => {
  if (backdropRef.current) {
    backdropRef.current.rotation.y = clock.getElapsedTime() * 0.0015;
  }
});
```

**Delete it entirely.** Also remove the now-unused imports — `useRef` from `react`, `useFrame` from `@react-three/fiber`, and `THREE` if not used elsewhere in the file (it IS used elsewhere, keep `THREE`).

After the change the imports at the top should look like:

```tsx
import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
```

### Change 1b — Remove `<group ref={backdropRef}>` wrapper

Find this block:

```tsx
{/* Slowly drifting backdrop: deep field stars + nebulas */}
<group ref={backdropRef}>
  {/* Ultra-deep field — very dense, barely visible */}
  <Stars radius={280} depth={180} count={14000} factor={0.65} saturation={0} fade speed={0.02} />
  {/* Deep field — Milky Way density */}
  <Stars radius={200} depth={120} count={7500} factor={1.6} saturation={0} fade speed={0.10} />
  {/* Mid field */}
  <Stars radius={85}  depth={55}  count={2800} factor={1.05} saturation={0} fade speed={0.06} />
  <NebulaLayer />
</group>
```

Replace with (no group, all speeds set to 0):

```tsx
{/* Anchored backdrop: deep field stars + nebulas — no rotation, no shimmer */}
<Stars radius={280} depth={180} count={14000} factor={0.65} saturation={0} fade speed={0} />
<Stars radius={200} depth={120} count={7500}  factor={1.6}  saturation={0} fade speed={0} />
<Stars radius={85}  depth={55}  count={2800}  factor={1.05} saturation={0} fade speed={0} />
<NebulaLayer />
```

### Change 1c — Tighten OrbitControls damping & rotation

Find the `<OrbitControls>` block:

```tsx
<OrbitControls
  makeDefault
  enablePan
  panSpeed={0.4}
  enableZoom
  enableRotate
  dampingFactor={0.055}
  rotateSpeed={0.35}
  zoomSpeed={0.7}
  minDistance={3}
  maxDistance={120}
  enableDamping
  minPolarAngle={0.05}
  maxPolarAngle={Math.PI - 0.05}
/>
```

Replace with:

```tsx
<OrbitControls
  makeDefault
  enablePan
  panSpeed={0.4}
  enableZoom
  enableRotate
  dampingFactor={0.18}
  rotateSpeed={0.30}
  zoomSpeed={0.65}
  minDistance={3}
  maxDistance={120}
  enableDamping
  minPolarAngle={0.05}
  maxPolarAngle={Math.PI - 0.05}
/>
```

---

## File 2: `src/components/galaxy/Star.tsx`

### Change 2a — Halve the per-star vertical drift amplitude

Find this block (lines ~58–66):

```tsx
const drift = useMemo(
  () => ({
    phase: channel.x * 11.3 + channel.z * 7.7,
    speed: 0.038 + (channel.id.charCodeAt(0) % 8) * 0.003,
    amp: 0.010 + ((channel.id.charCodeAt(1) ?? 0) % 4) * 0.005,
  }),
  [channel]
);
```

Replace with:

```tsx
const drift = useMemo(
  () => ({
    phase: channel.x * 11.3 + channel.z * 7.7,
    speed: 0.038 + (channel.id.charCodeAt(0) % 8) * 0.003,
    amp: 0.005 + ((channel.id.charCodeAt(1) ?? 0) % 4) * 0.0025,
  }),
  [channel]
);
```

---

## File 3: `src/pages/Index.tsx`

### Change 3 — Replace the overview button

Find this block (the existing button at the bottom):

```tsx
{/* Overview button — bottom center, very faint */}
<button
  onClick={handleOverview}
  style={{
    position: "absolute",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.50)",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    padding: "8px",
    letterSpacing: 0,
    userSelect: "none",
    transition: "color 0.3s",
  }}
  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.90)")}
  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
  title="Return to overview"
  aria-label="Return to overview"
>
  ⊙
</button>
```

Replace with:

```tsx
{/* Overview button — only shown when zoomed into something */}
{(activeChannel || profileOpen) && (
  <button
    onClick={handleOverview}
    style={{
      position: "absolute",
      top: "24px",
      left: "24px",
      zIndex: 25,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 14px 8px 12px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: "40px",
      color: "rgba(255,255,255,0.65)",
      fontSize: "11px",
      fontFamily: "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontWeight: 400,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      cursor: "pointer",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      transition: "color 0.25s ease, border-color 0.25s ease, background 0.25s ease",
      animation: "overviewBtnIn 0.4s ease",
      userSelect: "none",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = "rgba(255,255,255,0.95)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)";
      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "rgba(255,255,255,0.65)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
    }}
    aria-label="Return to galaxy overview"
  >
    <span style={{ fontSize: "13px", lineHeight: 1, letterSpacing: 0 }}>←</span>
    <span>Galaxy</span>
  </button>
)}
```

---

## File 4: `src/index.css`

### Change 4 — Add the appear-animation keyframe

Append this to the bottom of the file (it sits next to the existing `fadeUp` keyframe):

```css
@keyframes overviewBtnIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Verify

```bash
npm run dev
```

**Expected behaviour:**
- When you let go of a drag, the camera stops within ~½ second (was ~2 seconds)
- The background star field stays anchored — no drifting horizon
- Per-star bobbing is half as pronounced — still alive, no longer noisy
- After clicking a star or the black hole, a clearly-labelled `← GALAXY` pill appears in the top-left corner
- Clicking it returns to the overview and the button disappears

That's it. Six small edits across four files. No new packages.
