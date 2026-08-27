// Index.tsx — Tereza's canonical galaxy (the gift).
// The shared shell lives in GalaxyView; this page only supplies her data,
// the intro overlay, the corner credit, and her profile panel.
import { useState, useEffect } from "react";
import GalaxyView from "@/components/galaxy/GalaxyView";
import ProfilePanel from "@/components/galaxy/ProfilePanel";
import type { Channel } from "@/types/channel";

const Index = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
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

  const chrome = (
    <>
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
    </>
  );

  return (
    <GalaxyView
      channels={channels}
      chrome={chrome}
      profilePanel={(open, onClose) => <ProfilePanel open={open} onClose={onClose} />}
    />
  );
};

export default Index;
