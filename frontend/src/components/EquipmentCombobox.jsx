import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Wrench, Layers, X } from 'lucide-react';

export default function EquipmentCombobox({ value, onChange, equipment, placeholder = 'Ekipman seç...' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = equipment.find(e => e.id === value) || null;

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? equipment.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.supplier || '').toLowerCase().includes(q)
      )
    : equipment;

  function pick(eq) {
    onChange(eq.id);
    setOpen(false);
    setQuery('');
  }

  function clear(e) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm border ${
          selected
            ? 'bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200/70 text-amber-800 hover:from-amber-100 hover:to-amber-100'
            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Wrench size={14} className={selected ? 'text-amber-600' : 'text-slate-400'} />
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          {selected?.unit_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 flex-shrink-0">
              <Layers size={9} />
              {selected.unit_count}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') clear(e); }}
              className="p-0.5 rounded hover:bg-amber-200/60 cursor-pointer"
              title="Seçimi temizle"
            >
              <X size={12} className="text-amber-700" />
            </span>
          )}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''} ${selected ? 'text-amber-500' : 'text-slate-400'}`} />
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ara..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Eşleşen ekipman yok</div>
            ) : (
              filtered.map(e => {
                const isSel = e.id === value;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => pick(e)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                      isSel ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      e.unit_count > 0 ? 'bg-violet-50' : 'bg-amber-50'
                    }`}>
                      {e.unit_count > 0
                        ? <Layers size={13} className="text-violet-500" />
                        : <Wrench size={13} className="text-amber-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isSel ? 'text-amber-800' : 'text-slate-800'}`}>
                        {e.name}
                        {e.unit_count > 0 && (
                          <span className="ml-1.5 text-[10px] font-semibold text-violet-600">({e.unit_count} birim)</span>
                        )}
                      </div>
                      {(e.location || e.supplier) && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {[e.location, e.supplier].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
