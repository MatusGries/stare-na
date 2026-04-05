

# Knowledge Galaxy — Are.na Profile Visualizer

## Overview
A fullscreen 3D interactive galaxy where each Are.na channel is a glowing star, rendered with react-three-fiber. Users can explore, search, and inspect channels in an immersive space environment.

## Pages & Layout
- **Single fullscreen page** — dark space canvas fills the viewport
- **Overlay UI**: search bar (top center), side panel (right slide-in)

## 3D Scene (react-three-fiber)
- Load channels from `/data/channels.json` and render each as a glowing point mesh at its (x, y, z) coordinates
- Star size and color driven by JSON data; add emissive glow material
- Subtle idle animation: stars gently float with sine-wave motion
- Bloom post-processing effect via `@react-three/postprocessing` for soft glow
- Fog for depth perception
- OrbitControls for zoom/rotate; smooth camera transitions (lerp) when focusing on a star

## Interactions
- **Hover**: HTML tooltip (via drei's `Html`) showing channel title
- **Click**: smooth camera fly-to the star + open side panel
- **Search**: filter stars by title substring match — matching stars stay bright, others fade to near-invisible

## Side Panel
- Slides in from the right with animation
- Shows: title, description, neighbor channels (clickable to navigate), and "Open on Are.na" link
- Close button to dismiss and reset camera

## Search Bar
- Floating input at top center, minimal glass-morphism style
- Filters/highlights stars in real-time as user types

## Visual Design
- Background: radial gradient from black center to dark indigo/purple edges (CSS on the canvas container)
- Stars: varying brightness via emissive intensity, soft bloom
- Minimal white/light-gray typography for overlays
- Clean, modern aesthetic — no heavy UI chrome

## Sample Data
- Ship with a sample `channels.json` containing ~15 demo channels so the app works out of the box

## Tech
- React + react-three-fiber v8 + three.js
- @react-three/drei v9 (Html, OrbitControls, Stars background)
- @react-three/postprocessing (Bloom)
- Tailwind for overlay UI styling
- Modular components: `Galaxy`, `Star`, `SidePanel`, `SearchBar`, `Tooltip`

