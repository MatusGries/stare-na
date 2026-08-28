import { X, ArrowUpRight } from "lucide-react";

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
  /** Defaults preserve Tereza's canonical panel on the root route. */
  name?: string;
  slug?: string;
  about?: string;
}

const ProfilePanel = ({
  open,
  onClose,
  name = "Tereza Slančíková",
  slug = "terezka",
  about = "This galaxy maps the shape of a mind — channels collected on Are.na, distributed in space by semantic proximity. Each star is a thread of thought.",
}: ProfilePanelProps) => {
  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 z-30 h-full w-full sm:w-72 overflow-y-auto border-l border-white/[0.07] bg-black/55 max-sm:bg-black/80 backdrop-blur-2xl p-7 animate-in slide-in-from-right duration-300">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-1 text-white/55 hover:text-white/90 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Identity */}
      <div className="mt-8 mb-7">
        <div className="h-9 w-9 rounded-full border border-white/12 flex items-center justify-center mb-5">
          <span className="text-[12px] text-white/80 tracking-widest uppercase">
            {(name || slug).charAt(0)}
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-[0.20em] text-white/55 mb-2.5">
          Curator
        </p>
        <h2 className="text-[16px] font-normal text-white/95 tracking-wide">{name}</h2>
        <p className="text-[12px] text-white/65 mt-1 tracking-wide">@{slug}</p>
      </div>

      {/* About */}
      <p className="text-[13px] text-white/75 leading-relaxed mb-8">{about}</p>

      {/* Are.na link */}
      <a
        href={`https://www.are.na/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.10em] uppercase text-white/65 hover:text-white/95 transition-colors duration-200"
      >
        View on Are.na
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
};

export default ProfilePanel;
