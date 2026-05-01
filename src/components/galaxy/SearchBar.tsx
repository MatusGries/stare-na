import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar = ({ value, onChange }: SearchBarProps) => (
  <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-64">
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/65" />
      <input
        type="text"
        placeholder="Search the galaxy…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-white/[0.14] bg-white/[0.06] py-2 pl-9 pr-8 text-[13px] text-white/95 placeholder:text-white/55 backdrop-blur-xl outline-none focus:border-white/30 transition-colors tracking-wide"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/55 hover:text-white/90 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  </div>
);

export default SearchBar;
