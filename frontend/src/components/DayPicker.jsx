import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

function todayYMD() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function parseYMD(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function fmtTr(s) {
  const p = parseYMD(s);
  if (!p) return '';
  return `${p.d} ${MONTH_NAMES[p.m - 1]} ${p.y}`;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

// Pazartesi=0 ... Pazar=6 (TR convention)
function firstWeekdayMon(y, m) {
  const js = new Date(y, m - 1, 1).getDay(); // 0=Sun ... 6=Sat
  return (js + 6) % 7;
}

export default function DayPicker({ value, onChange, max, min, placeholder = 'Tarih seç', error = false }) {
  const today = todayYMD();
  const initial = parseYMD(value) || parseYMD(today);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m); // 1-12
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      const p = parseYMD(value) || parseYMD(today);
      setViewYear(p.y);
      setViewMonth(p.m);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function shiftMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function pick(day) {
    const v = ymd(viewYear, viewMonth, day);
    if (max && v > max) return;
    if (min && v < min) return;
    onChange(v);
    setOpen(false);
  }

  const dim = daysInMonth(viewYear, viewMonth);
  const firstW = firstWeekdayMon(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < firstW; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm border ${
          error
            ? 'bg-red-50/40 border-red-200 text-red-700'
            : value
              ? 'bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200/70 text-amber-800 hover:from-amber-100 hover:to-amber-100'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-2">
          <CalendarDays size={14} className={value ? 'text-amber-600' : 'text-slate-400'} />
          <span>{value ? fmtTr(value) : placeholder}</span>
        </span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''} ${value ? 'text-amber-500' : 'text-slate-400'}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-[280px]">
          {/* Header — month/year nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
              aria-label="Önceki ay"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-gray-800">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
              aria-label="Sonraki ay"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-[10px] font-semibold text-slate-400 text-center py-1 uppercase tracking-wide">
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const v = ymd(viewYear, viewMonth, d);
              const isSelected = v === value;
              const isToday = v === today;
              const disabled = (max && v > max) || (min && v < min);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  disabled={disabled}
                  className={`h-8 text-xs font-medium rounded-md transition-colors ${
                    disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : isSelected
                        ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600'
                        : isToday
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          : 'text-slate-600 hover:bg-gray-100'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Footer — Bugün shortcut */}
          {(!max || today <= max) && (!min || today >= min) && (
            <button
              type="button"
              onClick={() => { onChange(today); setOpen(false); }}
              className="mt-3 w-full text-xs font-semibold text-amber-600 hover:text-amber-700 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
            >
              Bugün
            </button>
          )}
        </div>
      )}
    </div>
  );
}
