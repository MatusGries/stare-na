import { useState, useEffect } from "react";
import Galaxy from "@/components/galaxy/Galaxy";
import SearchBar from "@/components/galaxy/SearchBar";
import SidePanel from "@/components/galaxy/SidePanel";
import type { Channel } from "@/types/channel";

const Index = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/data/channels.json")
      .then((r) => r.json())
      .then(setChannels)
      .catch(console.error);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "radial-gradient(ellipse at center, #0d0d2b 0%, #050510 70%, #000000 100%)" }}>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <Galaxy
        channels={channels}
        activeChannel={activeChannel}
        searchQuery={searchQuery}
        onSelectChannel={setActiveChannel}
      />

      <SidePanel
        channel={activeChannel}
        allChannels={channels}
        onClose={() => setActiveChannel(null)}
        onNavigate={setActiveChannel}
      />
    </div>
  );
};

export default Index;
