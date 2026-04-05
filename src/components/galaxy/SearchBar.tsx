import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar = ({ value, onChange }: SearchBarProps) => (
  <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-72">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
      <input
        type="text"
        placeholder="Search channels…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/30 backdrop-blur-xl outline-none focus:border-white/25 transition-colors"
      />
    </div>
  </div>
);

export default SearchBar;
