import { useEffect, useRef, useState } from "react";

// Reusable search-as-you-type input (Instagram-style live dropdown).
// Generic: pass a `search(query) => Promise<items[]>` and render props.
// Debounced, cached, keyboard/blur-safe.
export default function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  search,
  renderItem,
  getKey = (item) => item.url || item.id,
  minChars = 3,
  debounceMs = 350,
  placeholder = "Type to search…",
  isFullValue = (v) => /^https?:\/\//i.test(v),
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const cache = useRef(new Map());

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleChange(v) {
    onChange(v);
    const q = v.trim();
    clearTimeout(timer.current);
    if (isFullValue(q) || q.length < minChars) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (cache.current.has(q.toLowerCase())) {
      setResults(cache.current.get(q.toLowerCase()));
      setOpen(true);
      return;
    }
    setLoading(true);
    setOpen(true);
    timer.current = setTimeout(async () => {
      try {
        const items = await search(q);
        cache.current.set(q.toLowerCase(), items);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
  }

  function pick(item) {
    onSelect(item);
    setResults([]);
    setOpen(false);
  }

  const showDropdown = open && !isFullValue(value.trim()) && value.trim().length >= minChars;

  return (
    <div className="relative">
      <input
        className="glass-input w-full rounded-2xl px-4 py-2.5 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showDropdown && (loading || results.length > 0) && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md bg-white shadow-lg ring-1 ring-black/10">
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-ink/60">Searching…</div>
          ) : (
            results.map((item) => (
              <button
                type="button"
                key={getKey(item)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                className="block w-full border-b border-black/5 px-3 py-2 text-left last:border-b-0 hover:bg-sand"
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
