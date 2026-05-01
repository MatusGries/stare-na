#!/usr/bin/env python3
"""
generate_embeddings.py
─────────────────────
Reads  scripts/arena_raw.json  (output of fetch-arena.js)
Writes scripts/channels_with_embeddings.json

Model: sentence-transformers/all-MiniLM-L6-v2  (free, runs locally, ~90 MB)
Input per channel: title + description + first 50 block titles concatenated.

Usage:
    python scripts/generate_embeddings.py

Requirements (install once):
    pip install sentence-transformers
"""

import json
import sys
from pathlib import Path

# ── paths ────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).parent.parent
RAW_PATH   = ROOT / "scripts" / "arena_raw.json"
OUT_PATH   = ROOT / "scripts" / "channels_with_embeddings.json"

# ── load raw data ─────────────────────────────────────────────────────────────
if not RAW_PATH.exists():
    print(f"[error] {RAW_PATH} not found.")
    print("  Run first:  node scripts/fetch-arena.js --token YOUR_TOKEN")
    sys.exit(1)

with open(RAW_PATH, encoding="utf-8") as f:
    raw = json.load(f)

print(f"[info] Loaded {len(raw)} channels from {RAW_PATH.name}")

# ── build text inputs ─────────────────────────────────────────────────────────
# Three components per channel: title, description, and per-block-title mean.
# We embed each text individually (model truncates at ~256 tokens, so stuffing
# thousands of block titles into one string would lose all but the first ~50).
# Then we weight-combine per-channel components so a 2000-block channel doesn't
# drown out its own name.

W_TITLE  = 2.0   # channel title contribution
W_DESC   = 1.0   # channel description contribution
W_BLOCKS = 1.5   # mean of all block-title embeddings

import numpy as np

def block_titles(ch: dict) -> list[str]:
    out_t = []
    for b in ch.get("blocks") or []:
        t = (b.get("title") or b.get("generated_title") or "").strip()
        if t:
            out_t.append(t)
    return out_t

# Flatten all texts to encode, remembering which channel + role each belongs to.
# role: 0=title, 1=desc, 2=block
flat_texts: list[str] = []
flat_owner: list[int] = []
flat_role:  list[int] = []

for i, ch in enumerate(raw):
    title = (ch.get("title") or "").strip()
    desc  = (ch.get("description") or "").strip()
    if title:
        flat_texts.append(title); flat_owner.append(i); flat_role.append(0)
    if desc:
        flat_texts.append(desc);  flat_owner.append(i); flat_role.append(1)
    for t in block_titles(ch):
        flat_texts.append(t);     flat_owner.append(i); flat_role.append(2)

print(f"[info] Total text items to embed: {len(flat_texts)} "
      f"(across {len(raw)} channels)")

# ── load model & encode ───────────────────────────────────────────────────────
print("[info] Loading sentence-transformers model (downloads ~90 MB on first run)…")
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("[error] sentence-transformers not installed.")
    print("  Run:  pip install sentence-transformers")
    sys.exit(1)

model = SentenceTransformer("all-MiniLM-L6-v2")

print(f"[info] Encoding {len(flat_texts)} text items…")
flat_emb = model.encode(
    flat_texts,
    batch_size=64,
    show_progress_bar=True,
    normalize_embeddings=True,   # unit vectors → cosine sim == dot product
)
flat_emb = np.asarray(flat_emb, dtype=np.float32)  # (M, 384)
print(f"[info] Flat embedding matrix: {flat_emb.shape}")

# ── Aggregate per channel ─────────────────────────────────────────────────────
dim = flat_emb.shape[1]
title_sum  = np.zeros((len(raw), dim), dtype=np.float32); title_n  = np.zeros(len(raw), dtype=np.int64)
desc_sum   = np.zeros((len(raw), dim), dtype=np.float32); desc_n   = np.zeros(len(raw), dtype=np.int64)
block_sum  = np.zeros((len(raw), dim), dtype=np.float32); block_n  = np.zeros(len(raw), dtype=np.int64)

for emb, owner, role in zip(flat_emb, flat_owner, flat_role):
    if role == 0:
        title_sum[owner] += emb; title_n[owner] += 1
    elif role == 1:
        desc_sum[owner]  += emb; desc_n[owner]  += 1
    else:
        block_sum[owner] += emb; block_n[owner] += 1

def safe_mean(s, n):
    out_mean = np.zeros_like(s)
    mask = n > 0
    out_mean[mask] = s[mask] / n[mask, None]
    return out_mean, mask

title_mean, has_title = safe_mean(title_sum, title_n)
desc_mean,  has_desc  = safe_mean(desc_sum,  desc_n)
block_mean, has_block = safe_mean(block_sum, block_n)

# Weighted combine, only counting weights for present components.
channel_emb = (
    W_TITLE  * has_title[:, None]  * title_mean +
    W_DESC   * has_desc[:, None]   * desc_mean +
    W_BLOCKS * has_block[:, None]  * block_mean
)
weight_sum = (
    W_TITLE  * has_title.astype(np.float32) +
    W_DESC   * has_desc.astype(np.float32) +
    W_BLOCKS * has_block.astype(np.float32)
)
weight_sum = np.maximum(weight_sum, 1e-12)[:, None]
channel_emb = channel_emb / weight_sum

# L2-normalize so cosine sim == dot product downstream
norms = np.linalg.norm(channel_emb, axis=1, keepdims=True)
channel_emb = channel_emb / np.maximum(norms, 1e-12)
print(f"[info] Channel embeddings: {channel_emb.shape}")

# ── attach embeddings to channels & write ────────────────────────────────────
out = []
for ch, emb, nb in zip(raw, channel_emb, block_n):
    out.append({
        **ch,
        "embedding":           emb.tolist(),
        "blocksUsedForEmbed":  int(nb),
    })

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)   # no indent — keeps file small

print(f"[done] Wrote {len(out)} channels -> {OUT_PATH.name}")
print(f"       Next: python scripts/umap_reduce.py")
