# Knowledge Galaxy — Are.na Visualizer

**Gift for Tereza Slančíková** (`are.na/tereza-slancikova`). Pure frontend, no backend, no runtime API calls. All data is precomputed static JSON.

## Stack
React 18 + TypeScript + React Three Fiber v8 + drei v9 + @react-three/postprocessing + Three.js 0.160 + Tailwind. Vite on port 8080. **No new packages without approval.**

## Data Flow (HPC → Frontend)
```
scripts/fetch-arena.js         → scripts/arena_raw.json
scripts/generate_embeddings.py → scripts/channels_with_embeddings.json
scripts/umap_reduce.py         → public/data/channels.json  ← only runtime file
```
- Are.na API: `https://api.are.na/v2/users/tereza-slancikova/channels?per=100`
- Embeddings: `all-MiniLM-L6-v2`, input = title + description + first 50 block titles
- UMAP: `n_components=3, n_neighbors=8, min_dist=0.3, metric='cosine'`, scale output to `[-8, 8]`
- Neighbors: 2–3 nearest by cosine similarity per channel

## `public/data/channels.json` Schema
```ts
interface Channel {
  id: string; slug: string; title: string; description: string;
  x: number; y: number; z: number;        // UMAP coords, [-8, 8]
  size: number;                            // 0.8 + log10(blockCount+1)*0.6
  color: string;                           // hex
  emissiveIntensity: number;               // 1.0 + min(followerCount/20, 2.0)
  blockCount: number; followerCount: number;
  neighbors: string[];                     // 2–3 channel IDs
  thumbnailUrl?: string;
  blocks: { id: number; title: string; kind: string; imageUrl?: string }[];
}
```

## File Structure
```
src/components/galaxy/
  Galaxy.tsx            # Canvas root — scene composition only, no logic
  Star.tsx              # Channel mesh
  BlackHole.tsx         # User profile, center
  ConstellationLines.tsx # NEW: neighbor edges
  CameraController.tsx  # Lerp camera + OrbitControls.target to active star
  SearchBar.tsx         # Top-center floating input
  SidePanel.tsx         # Right panel — channel detail + block previews
  ProfilePanel.tsx      # Right panel — user profile
src/types/channel.ts
src/pages/Index.tsx     # All state lives here, passed as props
public/data/channels.json
scripts/                # fetch-arena.js, generate_embeddings.py, umap_reduce.py
```

## Scene (`Galaxy.tsx`)
```tsx
<Canvas camera={{ position: [0,0,22], fov: 55 }}>
  <fog args={['#0a0a1a', 20, 50]} />
  <ambientLight intensity={0.1} />
  <Stars radius={80} depth={60} count={4000} factor={3} fade speed={0.3} />
  <BlackHole /> <ConstellationLines /> {channels.map(ch => <Star />)}
  <CameraController target={activeChannel} />
  <OrbitControls enableDamping dampingFactor={0.05} minDistance={3} maxDistance={50} />
  <EffectComposer>
    <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.85} intensity={2.0} radius={0.9} />
  </EffectComposer>
</Canvas>
```

## State (`Index.tsx`)
```ts
const [channels, setChannels] = useState<Channel[]>([]);
const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
const [searchQuery, setSearchQuery] = useState("");
const [profileOpen, setProfileOpen] = useState(false);
```

## Behaviors

**Search:** non-matching stars lerp to `opacity: 0.05`; matching stars pulse scale ±20%. Escape clears. No auto-camera.

**Star click:** camera lerps to `[x, y, z+6]`, `controls.target` lerps to `[x, y, z]`. Active star: `emissiveIntensity*2`, scale `1.8x`. Side panel opens.

**ConstellationLines:** `<Line>` from drei between neighbor pairs.
- Idle: `opacity 0.08`, color `#a855f7`
- Search active: matching pairs → `opacity 0.4`, `#e9d5ff`
- Channel selected: its neighbor lines → `opacity 0.6`
- Always: `depthWrite={false}` to prevent z-fighting

**BlackHole:** two counter-rotating accretion tori. Click → ProfilePanel.

**Idle:** each star: `y = baseY + sin(t*0.4 + uniqueOffset)*0.15`

## Visual
| Thing | Value |
|---|---|
| Background | `radial-gradient(ellipse, #0d0d2b 0%, #050510 70%, #000 100%)` |
| Panels | `bg-black/70 backdrop-blur-2xl border-white/10` |
| Emissive mats | `toneMapped={false}` for correct bloom |
| Line mats | `depthWrite={false}` |

## SidePanel Block Previews
6 blocks max. Images: 60×60 thumbnail. Text: first 80 chars. Links: domain name. All link to `https://www.are.na/block/{id}`.

## Are.na URLs
- Channel: `https://www.are.na/tereza-slancikova/{slug}`
- Block: `https://www.are.na/block/{id}`
- Profile: `https://www.are.na/tereza-slancikova`

## Already Built (Lovable)
Galaxy, Star, BlackHole, CameraController, SearchBar, SidePanel, ProfilePanel, channel type, 15-item demo channels.json.

## To Build (Claude Code)
1. `ConstellationLines.tsx`
2. Upgrade `CameraController` — add `controls.target` lerp
3. Upgrade `SidePanel` — block preview grid
4. Search pulse animation on matching stars
5. Loading fade-in when `channels.length === 0`
6. Keyboard: `Escape` deselects + clears search, `Tab` cycles channels
7. `scripts/fetch-arena.js` — Node.js Are.na fetcher
8. `scripts/generate_embeddings.py` + `scripts/umap_reduce.py` with `scripts/README.md`
9. Replace demo `channels.json` with realistic ~40-channel mock in UMAP cluster layout
