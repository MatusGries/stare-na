// UserGalaxy.tsx — /:username: any Are.na user's galaxy, computed in a
// Web Worker (fetch → embed → UMAP), rendered by the shared GalaxyView shell.
//
//   mount ──> mobile gate? ──proceed──> new Worker(galaxyWorker)
//     │                                    │ GalaxyProgress messages
//     │                                    ▼
//     │                        status line (DM Mono) … → done(Channel[])
//     │                                    │
//     unmount ──> worker.terminate()       ▼
//                                     <GalaxyView channels …/>
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GalaxyView from "@/components/galaxy/GalaxyView";
import ProfilePanel from "@/components/galaxy/ProfilePanel";
import { nameConstellations } from "@/lib/pipeline/constellations";
import { getCachedLayout, putCachedLayout, dropCachedLayout } from "@/lib/layoutCache";
import type { Channel } from "@/types/channel";
import type { GalaxyProgress } from "@/lib/pipeline/types";

const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const RESERVED = new Set(["you", "data", "assets", "api", "models"]);

const isMobileish = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(max-width: 767px)").matches ||
    (window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches));

const statusText = (p: GalaxyProgress | null, username: string): string => {
  switch (p?.phase) {
    case "resolving": return `finding ${username}…`;
    case "fetching": return `gathering channels — page ${p.page} of ${p.totalPages}…`;
    case "enriching": return `reading between the lines — ${p.done}/${p.total}…`;
    case "loading-model": return "warming up the telescope…";
    case "embedding": return `measuring ${p.done} of ${p.total} thoughts…`;
    case "layout": return "finding the shape of your mind…";
    default: return "…";
  }
};

// Narration beats over the live condensation (milestone B). Cycles through
// the lines while the galaxy forms; unmounted the moment it settles.
const NARRATION_BEAT_MS = 2700;
const Narration = ({ count, lines: linesProp }: { count: number; lines?: string[] }) => {
  const lines = linesProp ?? [
    `${count} channels, gathered`,
    "pulling similar thoughts together…",
    "finding the shape of a mind…",
  ];
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBeat((b) => Math.min(b + 1, lines.length - 1)), NARRATION_BEAT_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <p
      key={beat} // re-trigger the fade on each beat
      style={{
        position: "absolute", bottom: 56, left: 0, right: 0, zIndex: 20,
        textAlign: "center", fontFamily: mono, fontSize: 11,
        letterSpacing: "0.3em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.55)", pointerEvents: "none",
        animation: "fadeUp 1.4s ease both",
      }}
    >
      {lines[beat]}
    </p>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div
    className="relative h-screen w-screen overflow-hidden flex flex-col items-center justify-center gap-6"
    style={{ background: "#000004" }}
  >
    {children}
  </div>
);

const MonoLine = ({ children, dim = 0.55 }: { children: React.ReactNode; dim?: number }) => (
  <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.28em",
    textTransform: "uppercase", color: `rgba(255,255,255,${dim})`, textAlign: "center" }}>
    {children}
  </p>
);

const UserGalaxy = () => {
  const { username = "" } = useParams();
  const slug = username.toLowerCase();
  const [gated, setGated] = useState(() => isMobileish());
  const [progress, setProgress] = useState<GalaxyProgress | null>(null);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [partial, setPartial] = useState<{ fetched: number; expected: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [epochFrames, setEpochFrames] = useState<number[][][] | null>(null);
  /** B2 animation stage: condensation (preview), enrichment settle, or idle. */
  const [animPhase, setAnimPhase] = useState<"condense" | "settle" | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const condensing = animPhase !== null;

  const reserved = RESERVED.has(slug);

  // B3: named constellations — computed once per layout, shown after the
  // condensation settles (and immediately for cached galaxies).
  const constellations = useMemo(
    () => (channels && !condensing ? nameConstellations(channels) : []),
    [channels, condensing]
  );

  useEffect(() => {
    if (gated || reserved || !slug) return;
    let cancelled = false;
    let worker: Worker | null = null;

    (async () => {
      // Layout cache (T6/7A): a returning visitor renders instantly.
      // attempt > 0 means an explicit retry/regenerate — always recompute.
      if (attempt === 0) {
        const cached = await getCachedLayout(slug);
        if (cancelled) return;
        if (cached) {
          setFromCache(true);
          setChannels(cached);
          return;
        }
      }

      // Worker chunk carries transformers.js + umap-js — loaded here only,
      // never on the root route (eng-review decision 3A).
      worker = new Worker(new URL("../workers/galaxyWorker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<GalaxyProgress>) => {
        const p = e.data;
        if (p.phase === "preview") {
          // B2 pass 1: explorable immediately; enrichment continues behind it.
          setFromCache(false);
          setEpochFrames(p.epochFrames ?? null);
          setAnimPhase(p.epochFrames?.length ? "condense" : null);
          setChannels(p.channels);
          setProgress(null); // pass-2 status resumes with the first enriching message
        } else if (p.phase === "done") {
          setFromCache(false);
          const settling = !!p.epochFrames?.length;
          setEpochFrames(p.epochFrames ?? null);
          setAnimPhase(settling ? "settle" : null);
          setChannels(p.channels);
          setPartial(p.partial ?? null);
          setProgress(null);
          // Cache only complete galaxies — a partial one should retry, not stick.
          if (!p.partial) void putCachedLayout(slug, p.channels);
        } else {
          setProgress(p);
        }
      };
      worker.postMessage({ type: "start", username: slug });
    })();

    return () => {
      cancelled = true;
      worker?.postMessage({ type: "cancel" });
      worker?.terminate();
      workerRef.current = null;
    };
  }, [slug, gated, reserved, attempt]);

  if (reserved || !slug) {
    return (
      <Shell>
        <MonoLine>page not found</MonoLine>
        <Link to="/you" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
          make your own galaxy →
        </Link>
      </Shell>
    );
  }

  if (gated) {
    return (
      <Shell>
        <MonoLine>galaxies are best forged on a desktop</MonoLine>
        <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.55)",
          maxWidth: 300, textAlign: "center", lineHeight: 1.6 }}>
          building yours means downloading a small AI model and computing in your browser —
          on a phone that can take a while.
        </p>
        <button
          onClick={() => setGated(false)}
          style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.85)",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 40, padding: "10px 20px", cursor: "pointer" }}
        >
          proceed anyway
        </button>
      </Shell>
    );
  }

  if (channels) {
    const chrome = (
      <>
        {partial && (
          <div style={{ position: "absolute", top: 20, right: 24, zIndex: 20,
            fontFamily: mono, fontSize: 10, letterSpacing: "0.18em",
            textTransform: "uppercase", color: "rgba(255,200,150,0.7)" }}>
            rendered {partial.fetched} of ~{partial.expected} —{" "}
            <button onClick={() => { setChannels(null); setProgress(null); setEpochFrames(null); setAnimPhase(null); setAttempt((a) => a + 1); }}
              style={{ all: "unset", cursor: "pointer", textDecoration: "underline" }}>
              retry
            </button>
          </div>
        )}
        {fromCache && !partial && (
          <div style={{ position: "absolute", top: 20, right: 24, zIndex: 20,
            fontFamily: mono, fontSize: 10, letterSpacing: "0.18em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            from memory —{" "}
            <button
              onClick={() => {
                void dropCachedLayout(slug);
                setChannels(null); setProgress(null); setFromCache(false);
                setAttempt((a) => a + 1);
              }}
              style={{ all: "unset", cursor: "pointer", textDecoration: "underline" }}>
              regenerate
            </button>
          </div>
        )}
        <p style={{ position: "absolute", bottom: 20, left: 24, zIndex: 20,
          fontFamily: mono, fontSize: 10, letterSpacing: "0.28em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.30)",
          userSelect: "none", pointerEvents: "none" }}>
          stare.na · {slug}
        </p>
        {animPhase === "condense" && <Narration count={channels.length} />}
        {animPhase === "settle" && (
          <Narration count={channels.length} lines={["the galaxy settles…"]} />
        )}
        {/* B2: enrichment keeps working behind the explorable preview */}
        {animPhase === null && progress && progress.phase !== "done" && (
          <p style={{ position: "absolute", bottom: 20, right: 24, zIndex: 20,
            fontFamily: mono, fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.30)",
            pointerEvents: "none" }}>
            {progress.phase === "enriching"
              ? `reading between the lines — ${progress.done}/${progress.total}…`
              : "weighing new thoughts…"}
          </p>
        )}
      </>
    );
    // A freshly computed galaxy condenses into place; a cached one is instant.
    return (
      <GalaxyView
        channels={channels}
        chrome={chrome}
        reveal={!fromCache}
        epochFrames={epochFrames ?? undefined}
        epochDuration={animPhase === "settle" ? 2.5 : undefined}
        onCondensed={() => setAnimPhase(null)}
        constellations={constellations}
        profilePanel={(open, onClose) => (
          <ProfilePanel
            open={open}
            onClose={onClose}
            name={`@${slug}`}
            slug={slug}
            about={`This galaxy maps ${slug}'s Are.na — ${channels.length} channels distributed in space by semantic proximity. Each star is a thread of thought.`}
          />
        )}
      />
    );
  }

  if (progress?.phase === "error") {
    const messages: Record<string, string> = {
      "unknown-user": "no one here by that name",
      "no-channels": "this galaxy is still dark — no public channels yet",
      "fetch-failed": "are.na isn't answering",
      "model-failed": "the model failed to load",
      cancelled: "",
    };
    return (
      <Shell>
        <MonoLine>{messages[progress.kind] || "something went wrong"}</MonoLine>
        {progress.kind !== "unknown-user" && progress.kind !== "no-channels" && (
          <button
            onClick={() => { setProgress(null); setAttempt((a) => a + 1); }}
            style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.85)",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 40, padding: "10px 20px", cursor: "pointer" }}
          >
            try again
          </button>
        )}
        <Link to="/you" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
          ← different username
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <MonoLine dim={0.7}>{statusText(progress, slug)}</MonoLine>
      <MonoLine dim={0.3}>{slug}</MonoLine>
    </Shell>
  );
};

export default UserGalaxy;
