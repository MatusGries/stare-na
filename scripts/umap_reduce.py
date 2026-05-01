#!/usr/bin/env python3
"""
umap_reduce.py
──────────────
Reads  scripts/channels_with_embeddings.json
Writes public/data/channels.json   ← the only file the frontend reads

Steps:
  1. UMAP 384-dim → 3-dim
  2. Scale coordinates to [-8, 8]
  3. Compute 2–3 nearest neighbors per channel (cosine sim on original embeddings)
  4. Compute size & emissiveIntensity from blockCount / followerCount
  5. Write channels.json matching the TypeScript Channel interface exactly

Usage:
    python scripts/umap_reduce.py

Requirements (install once):
    pip install umap-learn numpy scikit-learn
"""

import json
import math
import sys
from pathlib import Path

import numpy as np

# ── paths ────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent.parent
IN_PATH   = ROOT / "scripts" / "channels_with_embeddings.json"
OUT_PATH  = ROOT / "public" / "data" / "channels.json"

# ── UMAP params (from CLAUDE_1.md spec) ──────────────────────────────────────
UMAP_PARAMS = dict(
    n_components=3,
    n_neighbors=8,
    min_dist=0.3,
    metric="cosine",
    random_state=42,      # reproducible layout
)
COORD_SCALE = 8.0        # output range [-8, 8]
N_NEIGHBORS = 3          # neighbors per channel in output JSON

# ── load ──────────────────────────────────────────────────────────────────────
if not IN_PATH.exists():
    print(f"[error] {IN_PATH} not found.")
    print("  Run first:  python scripts/generate_embeddings.py")
    sys.exit(1)

with open(IN_PATH, encoding="utf-8") as f:
    channels = json.load(f)

print(f"[info] Loaded {len(channels)} channels with embeddings")

embeddings = np.array([ch["embedding"] for ch in channels], dtype=np.float32)
print(f"[info] Embedding matrix: {embeddings.shape}")

# ── UMAP ──────────────────────────────────────────────────────────────────────
print("[info] Running UMAP (may take 30–90 s for large collections)…")
try:
    from umap import UMAP
except ImportError:
    print("[error] umap-learn not installed.")
    print("  Run:  pip install umap-learn")
    sys.exit(1)

reducer = UMAP(**UMAP_PARAMS)
coords3d = reducer.fit_transform(embeddings)   # shape (N, 3)
print(f"[info] UMAP done -> shape {coords3d.shape}")

# ── Scale to [-COORD_SCALE, COORD_SCALE] ──────────────────────────────────────
def scale_axis(arr):
    mn, mx = arr.min(), arr.max()
    if mx == mn:
        return np.zeros_like(arr)
    return (arr - mn) / (mx - mn) * 2 * COORD_SCALE - COORD_SCALE

xs = scale_axis(coords3d[:, 0])
ys = scale_axis(coords3d[:, 1])
zs = scale_axis(coords3d[:, 2])

# ── Nearest neighbors (cosine on unit-normalised embeddings) ──────────────────
# embeddings were already L2-normalised in generate_embeddings.py,
# so dot product == cosine similarity.
print(f"[info] Computing {N_NEIGHBORS} nearest neighbours per channel…")
sim_matrix = embeddings @ embeddings.T   # (N, N) cosine similarities
np.fill_diagonal(sim_matrix, -1)         # exclude self

ids = [str(ch["id"]) for ch in channels]

neighbor_map = {}
for i in range(len(channels)):
    top_idx = np.argsort(sim_matrix[i])[::-1][:N_NEIGHBORS]
    neighbor_map[ids[i]] = [ids[j] for j in top_idx]

# ── Channel size & emissive ───────────────────────────────────────────────────
def compute_size(block_count: int) -> float:
    """0.8 + log10(blockCount+1)*0.6  → roughly 0.8 – 2.6"""
    return round(0.8 + math.log10(block_count + 1) * 0.6, 3)

def compute_emissive(follower_count: int) -> float:
    """1.0 + min(followerCount/20, 2.0)  → 1.0 – 3.0"""
    return round(1.0 + min(follower_count / 20.0, 2.0), 3)

# ── Assemble output ───────────────────────────────────────────────────────────
out = []
for i, ch in enumerate(channels):
    block_count    = int(ch.get("blockCount") or 0)
    follower_count = int(ch.get("followerCount") or 0)

    # blocks subset: keep only what frontend needs (drop embedding to save size)
    blocks_out = [
        {
            "id":       b["id"],
            "title":    b.get("title") or b.get("generated_title") or "",
            "kind":     b.get("kind") or b.get("class") or "Block",
            "imageUrl": b.get("imageUrl") or None,
        }
        for b in (ch.get("blocks") or [])[:6]   # frontend shows 6 max
    ]

    out.append({
        "id":               str(ch["id"]),
        "slug":             ch.get("slug") or str(ch["id"]),
        "title":            (ch.get("title") or "").strip(),
        "description":      (ch.get("description") or "").strip(),
        "x":                round(float(xs[i]), 4),
        "y":                round(float(ys[i]), 4),
        "z":                round(float(zs[i]), 4),
        "size":             compute_size(block_count),
        "color":            "#ffffff",
        "emissiveIntensity":compute_emissive(follower_count),
        "blockCount":       block_count,
        "followerCount":    follower_count,
        "neighbors":        neighbor_map[str(ch["id"])],
        "thumbnailUrl":     ch.get("thumbnailUrl") or None,
        "blocks":           blocks_out,
    })

# ── Write ─────────────────────────────────────────────────────────────────────
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"[done] Wrote {len(out)} channels -> {OUT_PATH}")
print()
print("Summary:")
block_counts = [ch["blockCount"] for ch in out]
print(f"  Channels       : {len(out)}")
print(f"  Total blocks   : {sum(block_counts)}")
print(f"  Largest channel: {max(block_counts)} blocks")
print(f"  Coord range x  : [{min(ch['x'] for ch in out):.2f}, {max(ch['x'] for ch in out):.2f}]")
print(f"  Coord range y  : [{min(ch['y'] for ch in out):.2f}, {max(ch['y'] for ch in out):.2f}]")
print(f"  Coord range z  : [{min(ch['z'] for ch in out):.2f}, {max(ch['z'] for ch in out):.2f}]")
print()
print("Next: npm run dev  and open http://localhost:8080")
