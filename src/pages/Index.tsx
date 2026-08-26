import { useState, useEffect } from "react";
import Galaxy from "@/components/galaxy/Galaxy";
import SearchBar from "@/components/galaxy/SearchBar";
import SidePanel from "@/components/galaxy/SidePanel";
import ProfilePanel from "@/components/galaxy/ProfilePanel";
import type { Channel } from "@/types/channel";

const Index = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    fetch("/data/channels.json")
      .then((r) => r.json())
      .then(setChannels)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setIntroVisible(false), 4200);
    return () => clearTimeout(t1);
  }, []);

  const handleBlackHoleClick = () => {
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
      {introVisible && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 50,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 14,
            background: "#000004",
            opacity: introVisible ? 1 : 0,
            transition: "opacity 1.8s ease",
            pointerEvents: "none",
          }}
        >
          <p style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 12, letterSpacing: "0.34em",
            color: "rgba(255,255,255,0.75)", textTransform: "uppercase",
            animation: "fadeUp 2.2s ease forwards" }}>
            Tereza Slančíková
          </p>
          <p style={{ fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.06em",
            animation: "fadeUp 2.2s 0.5s ease forwards", opacity: 0 }}>
            the shape of a mind, mapped in space
          </p>
          <p style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: "0.28em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.50)",
            marginTop: 28,
            animation: "fadeUp 2.2s 1.4s ease forwards", opacity: 0 }}>
            each star is a channel · click to explore · search to navigate
          </p>
        </div>
      )}

      {/* Persistent identity — the intro credit fades out, this stays */}
      <p
        style={{
          position: "absolute", bottom: 20, left: 24, zIndex: 20,
          fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 10,
          letterSpacing: "0.28em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.30)",
          userSelect: "none", pointerEvents: "none",
        }}
      >
        stare.na · tereza slančíková
      </p>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        channels={channels}
        onSelect={(ch) => { setProfileOpen(false); setActiveChannel(ch); }}
      />

      <Galaxy
        channels={channels}
        activeChannel={activeChannel}
        searchQuery={searchQuery}
        onSelectChannel={(ch) => { setProfileOpen(false); setActiveChannel(ch); }}
        onBlackHoleClick={handleBlackHoleClick}
        resetSignal={resetSignal}
        onOverviewRequest={handleOverview}
      />

      <SidePanel
        channel={activeChannel}
        allChannels={channels}
        onClose={() => setActiveChannel(null)}
        onNavigate={(ch) => { setProfileOpen(false); setActiveChannel(ch); }}
      />

      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />

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

export default Index;
