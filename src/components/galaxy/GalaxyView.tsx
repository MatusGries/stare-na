// GalaxyView.tsx — the shared galaxy shell (eng-review decision 1A).
//
//   ┌─ GalaxyView (this file) ──────────────────────────────┐
//   │  state: activeChannel · searchQuery · profileOpen ·   │
//   │         resetSignal                                   │
//   │  renders: SearchBar · Galaxy canvas · SidePanel ·     │
//   │           ← Galaxy overview button                    │
//   │  props:  chrome (page-specific overlays) ·            │
//   │          profilePanel (black-hole panel factory)      │
//   └───────────────────────────────────────────────────────┘
//   Index (Tereza, static JSON + intro + credit)  ──┐
//   UserGalaxy (worker pipeline + progress, T5)   ──┴─→ configure it
//
// Every future UI fix lands here once — never fork this shell.
import { useMemo, useState, type ReactNode } from "react";
import Galaxy from "@/components/galaxy/Galaxy";
import SearchBar from "@/components/galaxy/SearchBar";
import SidePanel from "@/components/galaxy/SidePanel";
import ConstellationPanel from "@/components/galaxy/ConstellationPanel";
import { clusterFraming } from "@/lib/clusterFraming";
import type { Constellation } from "@/lib/pipeline/constellations";
import type { Channel } from "@/types/channel";

interface GalaxyViewProps {
  channels: Channel[];
  /** Page-specific overlays rendered above the canvas: intro, credits, progress UI. */
  chrome?: ReactNode;
  /** Panel opened by clicking the black hole. Omit to make the core click a no-op. */
  profilePanel?: (open: boolean, onClose: () => void) => ReactNode;
  /** Condensation reveal for freshly generated galaxies (T6). */
  reveal?: boolean;
  /** Milestone-B live condensation frames + completion callback. */
  epochFrames?: number[][][];
  epochDuration?: number;
  onCondensed?: () => void;
  /** Milestone-B3: named constellations — rendered as a clickable strip that
   *  flies to each cluster's anchor channel. */
  constellations?: import("@/lib/pipeline/constellations").Constellation[];
}

const GalaxyView = ({
  channels,
  chrome,
  profilePanel,
  reveal,
  epochFrames,
  epochDuration,
  onCondensed,
  constellations,
}: GalaxyViewProps) => {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeConstellation, setActiveConstellation] = useState<Constellation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const select = (ch: Channel) => {
    setProfileOpen(false);
    setActiveConstellation(null);
    setActiveChannel(ch);
  };

  /** Clicking a constellation frames the whole cluster and summarizes it. */
  const selectConstellation = (c: Constellation) => {
    setProfileOpen(false);
    setActiveChannel(null);
    setActiveConstellation(c);
  };

  // Camera framing for the active cluster (math + tests in lib/clusterFraming)
  const clusterFocus = useMemo(() => {
    if (!activeConstellation) return null;
    const byId = new Map(channels.map((c) => [c.id, c]));
    const members = activeConstellation.channelIds
      .map((id) => byId.get(id))
      .filter(Boolean) as Channel[];
    return clusterFraming(members);
  }, [activeConstellation, channels]);

  const clusterMembers = useMemo(
    () => (activeConstellation ? new Set(activeConstellation.channelIds) : null),
    [activeConstellation]
  );

  const handleBlackHoleClick = () => {
    if (!profilePanel) return;
    setActiveChannel(null);
    setActiveConstellation(null);
    setProfileOpen(true);
  };

  const handleOverview = () => {
    setActiveChannel(null);
    setActiveConstellation(null);
    setProfileOpen(false);
    setResetSignal((c) => c + 1);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "#000004" }}>
      {chrome}

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        channels={channels}
        onSelect={select}
      />

      <Galaxy
        channels={channels}
        activeChannel={activeChannel}
        searchQuery={searchQuery}
        reveal={reveal}
        epochFrames={epochFrames}
        epochDuration={epochDuration}
        onCondensed={onCondensed}
        constellations={constellations}
        constellationsDimmed={!!activeChannel || profileOpen || !!searchQuery}
        clusterFocus={clusterFocus}
        clusterMembers={clusterMembers}
        onSelectConstellation={selectConstellation}
        onSelectChannel={select}
        onBlackHoleClick={handleBlackHoleClick}
        resetSignal={resetSignal}
        onOverviewRequest={handleOverview}
      />

      <SidePanel
        channel={activeChannel}
        allChannels={channels}
        onClose={() => setActiveChannel(null)}
        onNavigate={select}
      />

      <ConstellationPanel
        constellation={activeConstellation}
        allChannels={channels}
        onClose={handleOverview}
        onSelectChannel={select}
      />

      {profilePanel?.(profileOpen, () => setProfileOpen(false))}

      {/* Constellation strip (B3) — hidden while the user is busy elsewhere */}
      {!!constellations?.length && !activeChannel && !activeConstellation && !profileOpen && !searchQuery && (
        <div
          style={{
            position: "absolute", bottom: 52, left: 0, right: 0, zIndex: 20,
            display: "flex", justifyContent: "center", alignItems: "baseline",
            gap: 18, flexWrap: "wrap", padding: "0 24px",
            animation: "fadeUp 1.6s ease both",
          }}
        >
          <span style={{
            fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 9,
            letterSpacing: "0.26em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)", userSelect: "none",
          }}>
            constellations
          </span>
          {constellations.map((c) => {
            return (
              <button
                key={c.anchorId}
                onClick={() => selectConstellation(c)}
                title={`${c.count} channels`}
                style={{
                  all: "unset", cursor: "pointer",
                  fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 11,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.92)",
                  borderBottom: "1px solid rgba(255,255,255,0.30)",
                  paddingBottom: 2,
                  transition: "color 0.25s ease, border-color 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.95)";
                  e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.45)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                  e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.18)";
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Overview button — only shown when zoomed into something */}
      {(activeChannel || activeConstellation || profileOpen) && (
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
    </div>
  );
};

export default GalaxyView;
