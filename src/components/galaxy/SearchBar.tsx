import { Search, X } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import type { Channel } from "@/types/channel";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  channels: Channel[];
  onSelect: (channel: Channel) => void;
}

const SearchBar = ({ value, onChange, channels, onSelect }: SearchBarProps) => {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length === 0) return [];
    return channels
      .filter((c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false)
      )
      .sort((a, b) => {
        // Rank: title starts with query > a word starts with it > mid-word > description-only
        const rank = (c: Channel) => {
          const t = c.title.toLowerCase();
          if (t.startsWith(q)) return 0;
          if (t.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return 1;
          if (t.includes(q)) return 2;
          return 3;
        };
        return rank(a) - rank(b);
      })
      .slice(0, 8);
  }, [value, channels]);

  useEffect(() => {
    setActiveIdx(0);
  }, [value]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const select = (ch: Channel) => {
    onSelect(ch);
    onChange("");
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-80">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/65" />
        <input
          type="text"
          placeholder="Search the galaxy…"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[activeIdx]) select(results[activeIdx]);
            else if (e.key === "Escape") clear();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            }
          }}
          className="w-full rounded-full border border-white/[0.14] bg-white/[0.06] py-2 pl-9 pr-8 text-[13px] text-white/95 placeholder:text-white/55 backdrop-blur-xl outline-none focus:border-white/30 transition-colors tracking-wide"
        />
        {value && (
          <button
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/55 hover:text-white/90 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && value.trim().length > 0 && (
        <div className="mt-2 rounded-2xl border border-white/[0.10] bg-black/75 backdrop-blur-2xl overflow-hidden shadow-2xl">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-white/55 text-center">
              No channels match
            </div>
          ) : (
            results.map((ch, i) => (
              <button
                key={ch.id}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => select(ch)}
                className={
                  "flex w-full items-center justify-between text-left px-4 py-2.5 text-[13px] font-light transition-colors duration-150 " +
                  (i === activeIdx
                    ? "bg-white/[0.08] text-white"
                    : "text-white/85 hover:bg-white/[0.05] hover:text-white")
                }
              >
                <span className="truncate pr-3">{ch.title}</span>
                {ch.blockCount !== undefined && (
                  <span className="shrink-0 font-mono text-[10px] text-white/45">
                    {ch.blockCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
