// fetch-model.mjs — puts the MiniLM weights into public/models/ so the
// deployed site serves them itself (design doc D12.2: no Hugging Face CDN
// dependency on the product's cold path). Runs before dev and build; no-op
// when the files already exist. Copies from the local transformers.js cache
// when available, downloads from HF only as a fallback (build-time only).
import { mkdirSync, existsSync, copyFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_quantized.onnx",
];
const DEST = join("public", "models", MODEL);
const CACHE = join("node_modules", "@huggingface", "transformers", ".cache", MODEL);
const HF = `https://huggingface.co/${MODEL}/resolve/main`;

let ok = true;
for (const f of FILES) {
  const dest = join(DEST, f);
  if (existsSync(dest) && statSync(dest).size > 0) continue;
  mkdirSync(dirname(dest), { recursive: true });
  const cached = join(CACHE, f);
  if (existsSync(cached) && statSync(cached).size > 0) {
    copyFileSync(cached, dest);
    console.log(`[model] copied from cache: ${f}`);
    continue;
  }
  console.log(`[model] downloading: ${f}`);
  const resp = await fetch(`${HF}/${f}`);
  if (!resp.ok) {
    console.error(`[model] FAILED ${f}: HTTP ${resp.status}`);
    ok = false;
    continue;
  }
  writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
}
if (!ok) process.exit(1);
console.log("[model] weights ready in public/models/");
