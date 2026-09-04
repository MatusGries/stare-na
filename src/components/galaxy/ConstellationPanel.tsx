// ConstellationPanel.tsx — the summary you get when you click a constellation
// (before drilling into any single channel).
//
//   click "cookbook · dreaming" ──> camera frames the whole cluster
//                              └──> this panel: what's in it, biggest first
//                                      └── click a channel ──> the star
import { useEffect } from "react";
import { X } from "lucide-react";
import type { Channel } from "@/types/channel";
import type { Constellation } from "@/lib/pipeline/constellations";

const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

interface ConstellationPanelProps {
  constellation: Constellation | null;
  allChannels: Channel[];
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
}

const ConstellationPanel = ({
  constellation,
  allChannels,
  onClose,
  onSelectChannel,
}: ConstellationPanelProps) => {
  useEffect(() => {
    if (!constellation) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [constellation, onClose]);

  if (!constellation) return null;

  const byId = new Map(allChannels.map((c) => [c.id, c]));
  const members = constellation.channelIds
    .map((id) => byId.get(id))
    .filter(Boolean) as Channel[];
  const totalBlocks = members.reduce((s, c) => s + (c.blockCount ?? 0), 0);

  return (
    <div className="absolute right-0 top-0 z-30 h-full w-full sm:w-72 overflow-y-auto border-l border-white/[0.06] bg-black/50 max-sm:bg-black/80 backdrop-blur-2xl p-7 animate-in slide-in-from-right duration-300">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-1 text-white/55 hover:text-white/90 transition-colors"
        aria-label="Close constellation"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Title */}
      <div className="mt-8 mb-7">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
          Constellation
        </p>
        <h2
          style={{ fontFamily: mono, letterSpacing: "0.14em" }}
          className="text-[15px] font-normal uppercase text-white/95 leading-snug"
        >
          {constellation.name}
        </h2>
      </div>

      {/* Meta */}
      <div className="flex gap-5 mb-8 font-mono text-[10px] tracking-[0.12em] text-white/55">
        <span><span className="text-white/85">{members.length}</span> channels</span>
        <span><span className="text-white/85">{totalBlocks}</span> blocks</span>
      </div>

      {/* Members, biggest first */}
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 mb-4">
        Within
      </p>
      <div className="space-y-0.5 mb-9">
        {members.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectChannel(c)}
            className="flex w-full items-center justify-between gap-3 text-left py-1.5 text-[12.5px] font-normal text-white/80 hover:text-white transition-colors duration-200"
          >
            <span className="truncate">{c.title}</span>
            {c.blockCount !== undefined && (
              <span className="shrink-0 font-mono text-[10px] text-white/40">
                {c.blockCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConstellationPanel;
