import { X, ExternalLink } from "lucide-react";

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

const ProfilePanel = ({ open, onClose }: ProfilePanelProps) => {
  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 z-30 h-full w-80 overflow-y-auto border-l border-white/10 bg-black/70 backdrop-blur-2xl p-6 animate-in slide-in-from-right duration-300">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full p-1 text-white/50 hover:text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mb-5 h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-purple-500/30">
        A
      </div>

      <h2 className="text-lg font-semibold text-white mb-1">Arena Explorer</h2>
      <p className="text-xs text-white/40 mb-4">@arena-explorer</p>

      <p className="text-sm text-white/60 leading-relaxed mb-6">
        Curating connections across visual culture, language, technology, and space. This galaxy maps the constellations of ideas collected on Are.na.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg bg-white/5 p-3 text-center">
          <div className="text-lg font-semibold text-white">15</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Channels</div>
        </div>
        <div className="rounded-lg bg-white/5 p-3 text-center">
          <div className="text-lg font-semibold text-white">342</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Blocks</div>
        </div>
        <div className="rounded-lg bg-white/5 p-3 text-center">
          <div className="text-lg font-semibold text-white">28</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Following</div>
        </div>
      </div>

      <a
        href="https://www.are.na"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 hover:text-white hover:border-white/30 transition-colors"
      >
        View on Are.na
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};

export default ProfilePanel;
