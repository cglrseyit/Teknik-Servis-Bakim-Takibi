import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function ComboboxInput({ value, onChange, options = [], placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function onDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // value prop değişirse query'yi senkronize et
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  function select(opt) {
    setQuery(opt);
    onChange(opt);
    setOpen(false);
  }

  function handleInput(e) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    if (e.key === 'Enter' && filtered.length === 1) { e.preventDefault(); select(filtered[0]); }
  }

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 pr-8 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <ChevronDown
        size={14}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
      />

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(opt => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); select(opt); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-amber-50 transition-colors ${
                  opt === value ? 'bg-amber-50/60 font-semibold text-amber-700' : 'text-slate-700'
                }`}
              >
                <span>{opt}</span>
                {opt === value && <Check size={13} className="text-amber-500 flex-shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
