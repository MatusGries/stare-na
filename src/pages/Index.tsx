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

  useEffect(() => {
    fetch("/data/channels.json")
      .then((r) => r.json())
      .then(setChannels)
      .catch(console.error);
  }, []);

  const handleBlackHoleClick = () => {
    setActiveChannel(null);
    setProfileOpen(true);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "#000000" }}>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <Galaxy
        channels={channels}
        activeChannel={activeChannel}
        searchQuery={searchQuery}
        onSelectChannel={(ch) => { setProfileOpen(false); setActiveChannel(ch); }}
        onBlackHoleClick={handleBlackHoleClick}
      />

      <SidePanel
        channel={activeChannel}
        allChannels={channels}
        onClose={() => setActiveChannel(null)}
        onNavigate={(ch) => { setProfileOpen(false); setActiveChannel(ch); }}
      />

      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};

export default Index;
