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
          <p style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.34em",
            color: "rgba(255,255,255,0.75)", textTransform: "uppercase",
            animation: "fadeUp 2.2s ease forwards" }}>
            Tereza Slančíková
          </p>
          <p style={{ fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.06em",
            animation: "fadeUp 2.2s 0.5s ease forwards", opacity: 0 }}>
            the shape of a mind, mapped in space
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.28em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.50)",
            marginTop: 28,
            animation: "fadeUp 2.2s 1.4s ease forwards", opacity: 0 }}>
            each star is a channel · click to explore · search to navigate
          </p>
        </div>
      )}

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

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

      {/* Overview button — bottom center, very faint */}
      <button
        onClick={handleOverview}
        style={{
          position: "absolute",
          bottom: "28px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.50)",
          fontSize: "22px",
          lineHeight: 1,
          cursor: "pointer",
          padding: "8px",
          letterSpacing: 0,
          userSelect: "none",
          transition: "color 0.3s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.90)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
        title="Return to overview"
        aria-label="Return to overview"
      >
        ⊙
      </button>
    </div>
  );
};

export default Index;
