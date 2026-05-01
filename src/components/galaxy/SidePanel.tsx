import { X, ArrowUpRight } from "lucide-react";
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
    <div className="absolute right-0 top-0 z-30 h-full w-72 overflow-y-auto border-l border-white/[0.06] bg-black/50 backdrop-blur-2xl p-7 animate-in slide-in-from-right duration-300">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-1 text-white/55 hover:text-white/90 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Title */}
      <div className="mt-8 mb-7">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
          Channel
        </p>
        <h2 className="text-[15px] font-normal text-white/95 leading-snug">
          {channel.title}
        </h2>
      </div>

      {/* Meta row */}
      {(channel.blockCount !== undefined || channel.followerCount !== undefined) && (
        <div className="flex gap-5 mb-6 font-mono text-[10px] tracking-[0.12em] text-white/55">
          {channel.blockCount !== undefined && (
            <span><span className="text-white/85">{channel.blockCount}</span> blocks</span>
          )}
          {channel.followerCount !== undefined && (
            <span><span className="text-white/85">{channel.followerCount}</span> followers</span>
          )}
        </div>
      )}

      {/* Description */}
      {channel.description && (
        <p className="text-[12.5px] text-white/75 leading-relaxed mb-9 font-light">
          {channel.description}
        </p>
      )}

      {/* Nearby */}
      {neighbors.length > 0 && (
        <div className="mb-9">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 mb-4">
            Nearby
          </p>
          <div className="space-y-0.5">
            {neighbors.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate(n)}
                className="block w-full text-left py-1.5 text-[12.5px] font-normal text-white/80 hover:text-white/100 transition-colors duration-200"
              >
                {n.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Block previews */}
      {channel.blocks && channel.blocks.length > 0 && (
        <div className="mb-9">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 mb-4">
            Contents
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {channel.blocks.slice(0, 6).map((b) => (
              <a
                key={b.id}
                href={`https://www.are.na/block/${b.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded overflow-hidden bg-white/[0.04] border border-white/[0.05] flex items-center justify-center group"
                title={b.title}
              >
                {b.imageUrl ? (
                  <img
                    src={b.imageUrl}
                    alt={b.title}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <span className="text-[9px] text-white/65 px-1.5 leading-tight text-center line-clamp-3">
                    {b.title || b.kind}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* External link */}
      <a
        href={`https://www.are.na/tereza-slancikova/${channel.slug || channel.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] uppercase text-white/65 hover:text-white/95 transition-colors duration-200"
      >
        Are.na
        <ArrowUpRight className="h-2.5 w-2.5" />
      </a>
    </div>
  );
};

export default SidePanel;
