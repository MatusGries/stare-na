import { X, ExternalLink } from "lucide-react";
import type { Channel } from "@/types/channel";

interface SidePanelProps {
  channel: Channel | null;
  allChannels: Channel[];
  onClose: () => void;
  onNavigate: (channel: Channel) => void;
}

const SidePanel = ({ channel, allChannels, onClose, onNavigate }: SidePanelProps) => {
  if (!channel) return null;

  const neighbors = allChannels.filter((c) => channel.neighbors.includes(c.id));

  return (
    <div
      className="absolute right-0 top-0 z-30 h-full w-80 overflow-y-auto border-l border-white/10 bg-black/70 backdrop-blur-2xl p-6 animate-in slide-in-from-right duration-300"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full p-1 text-white/50 hover:text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="mb-4 h-3 w-3 rounded-full"
        style={{ backgroundColor: channel.color, boxShadow: `0 0 12px ${channel.color}` }}
      />

      <h2 className="text-lg font-semibold text-white mb-2">{channel.title}</h2>
      <p className="text-sm text-white/60 leading-relaxed mb-6">{channel.description}</p>

      {neighbors.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-white/40 mb-3">
            Similar Channels
          </h3>
          <div className="space-y-2">
            {neighbors.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate(n)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors text-left"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: n.color }}
                />
                {n.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <a
        href={`https://www.are.na/channel/${channel.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 hover:text-white hover:border-white/30 transition-colors"
      >
        Open on Are.na
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};

export default SidePanel;
