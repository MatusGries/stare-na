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
import { useState, type ReactNode } from "react";
import Galaxy from "@/components/galaxy/Galaxy";
import SearchBar from "@/components/galaxy/SearchBar";
import SidePanel from "@/components/galaxy/SidePanel";
import type { Channel } from "@/types/channel";

interface GalaxyViewProps {
  channels: Channel[];
  /** Page-specific overlays rendered above the canvas: intro, credits, progress UI. */
  chrome?: ReactNode;
  /** Panel opened by clicking the black hole. Omit to make the core click a no-op. */
  profilePanel?: (open: boolean, onClose: () => void) => ReactNode;
  /** Condensation reveal for freshly generated galaxies (T6). */
  reveal?: boolean;
}

const GalaxyView = ({ channels, chrome, profilePanel, reveal }: GalaxyViewProps) => {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const select = (ch: Channel) => {
    setProfileOpen(false);
    setActiveChannel(ch);
  };

  const handleBlackHoleClick = () => {
    if (!profilePanel) return;
    setActiveChannel(null);
    setProfileOpen(true);
  };

  const handleOverview = () => {
    setActiveChannel(null);
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

      {profilePanel?.(profileOpen, () => setProfileOpen(false))}

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
    </div>
  );
};

export default GalaxyView;
