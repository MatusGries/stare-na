# Data Pipeline — Stare.na

Converts Tereza's Are.na channels into the 3D coordinate JSON the galaxy reads.
Run this once before deploying; the frontend is entirely static after that.

```
Are.na API  →  arena_raw.json  →  channels_with_embeddings.json  →  channels.json
              fetch-arena.js     generate_embeddings.py              umap_reduce.py
```

---

## Prerequisites

**Node.js** (already installed if you can run `npm run dev`)

**Python 3.9+** with these packages:

```bash
pip install sentence-transformers umap-learn numpy scikit-learn
```

> First run downloads the `all-MiniLM-L6-v2` model (~90 MB). Cached after that.

---

## Step 1 — Get an Are.na access token

You have two options:

### Option A — OAuth browser flow (recommended)

The OAuth app is already registered. Just run:

```bash
node scripts/get-token.js
```

This opens your browser to the Are.na authorization page. Approve it.
The page redirects to the Vercel callback and **displays your token**.
Copy it.

### Option B — Personal access token (simpler)

1. Go to [dev.are.na/oauth/applications](https://dev.are.na/oauth/applications)
2. Open your existing app (or create one — name/URL don't matter)
3. Scroll to **Personal access token** → copy it

---

## Step 2 — Fetch channels from Are.na

```bash
node scripts/fetch-arena.js --token YOUR_TOKEN_HERE
```

This fetches all of Tereza's channels plus the first 50 blocks per channel.
Output: `scripts/arena_raw.json`

Expected output:
```
Fetching channels for tereza-slancikova…
  Got 87 channels (total: 87)
  [1/87] Visual Research (visual-research)
  [2/87] Color Theory (color-theory)
  …
Done. Wrote 87 channels to scripts/arena_raw.json
```

> Takes ~2 minutes (350 ms delay between requests to be polite to the API).

---

## Step 3 — Generate embeddings

```bash
python scripts/generate_embeddings.py
```

Encodes each channel as a 384-dimensional vector using `all-MiniLM-L6-v2`.
Input text = title + description + first 50 block titles.
Output: `scripts/channels_with_embeddings.json`

> First run: ~2 min (model download + encoding).
> Subsequent runs: ~20 seconds.

---

## Step 4 — UMAP reduction → final channels.json

```bash
python scripts/umap_reduce.py
```

Reduces 384-dim embeddings to 3D coordinates using UMAP.
Computes nearest neighbors, sizes, and emissive intensities.
Output: `public/data/channels.json` — the only file the frontend reads.

> Takes 30–90 seconds depending on channel count.

---

## Step 5 — Verify in the browser

```bash
npm run dev
```

Open `http://localhost:8080`. You should see Tereza's real channels distributed
in 3D space by semantic similarity — channels about similar topics will cluster
together.

---

## Re-running

If Tereza adds new channels, run all four steps again. The UMAP layout will
shift slightly (UMAP is non-deterministic across runs unless seeded, which it is
here via `random_state=42`) but the semantic clusters will be stable.

To update only the layout without re-fetching:
```bash
python scripts/generate_embeddings.py   # only if arena_raw.json changed
python scripts/umap_reduce.py
```

---

## Output schema (`public/data/channels.json`)

```ts
interface Channel {
  id: string;
  slug: string;
  title: string;
  description: string;
  x: number;             // UMAP coord, range [-8, 8]
  y: number;
  z: number;
  size: number;          // 0.8 + log10(blockCount+1) * 0.6
  color: string;         // "#ffffff"
  emissiveIntensity: number;  // 1.0 + min(followerCount/20, 2.0)
  blockCount: number;
  followerCount: number;
  neighbors: string[];   // 3 nearest channel IDs by cosine similarity
  thumbnailUrl?: string;
  blocks: {
    id: number;
    title: string;
    kind: string;        // "Image" | "Text" | "Link" | "Media" | "Attachment"
    imageUrl?: string;
  }[];
}
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `401` from fetch script | Token expired — get a new one (Step 1) |
| `umap not found` | `pip install umap-learn` |
| `sentence_transformers not found` | `pip install sentence-transformers` |
| Channels look randomly placed | Normal — UMAP has variance. Semantic clusters should still be visible. |
| Only a few channels visible | Check `public/data/channels.json` — coordinates should span ~[-8, 8] |
| Script crashes on a channel | Channel may be private. It's skipped with a warning. |
