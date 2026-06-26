import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS  = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function todayIstanbul() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

function formatDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first offset (0=Mon … 6=Sun)
function firstDayOffset(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function DatePickerField({ value, onChange, label, required, minDate, className = '' }) {
  const today = todayIstanbul();
  const initYear  = value ? Number(value.split('-')[0]) : Number(today.split('-')[0]);
  const initMonth = value ? Number(value.split('-')[1]) - 1 : Number(today.split('-')[1]) - 1;

  const [open, setOpen]         = useState(false);
  const [mode, setMode]         = useState('calendar'); // 'calendar' | 'year'
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const ref = useRef(null);

  // Sync view when value changes from outside
  useEffect(() => {
    if (value) {
      setViewYear(Number(value.split('-')[0]));
      setViewMonth(Number(value.split('-')[1]) - 1);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day) {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  }

  function selectToday() {
    onChange(today);
    setViewYear(Number(today.split('-')[0]));
    setViewMonth(Number(today.split('-')[1]) - 1);
    setOpen(false);
  }

  // Build calendar cells (null = empty slot)
  const offset = firstDayOffset(viewYear, viewMonth);
  const total  = daysInMonth(viewYear, viewMonth);
  const cells  = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  // Year grid: show 12 years starting from rounded block
  const yearBlock = Math.floor(viewYear / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearBlock + i);

  const fieldCls = `w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 hover:border-gray-300 transition-all ${className}`;

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required ? ' *' : ''}
        </label>
      )}

      <button type="button" onClick={() => { setOpen(o => !o); setMode('calendar'); }} className={fieldCls}>
        <CalendarDays size={14} className="text-gray-400 flex-shrink-0" />
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value ? formatDisplay(value) : 'Tarih seçin'}
        </span>
      </button>

      {/* Hidden required guard */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          tabIndex={-1}
          aria-hidden
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-72 left-0">

          {mode === 'calendar' ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <button type="button" onClick={() => setMode('year')}
                  className="text-sm font-bold text-gray-800 hover:text-amber-600 transition-colors px-2">
                  {MONTHS[viewMonth]} {viewYear}
                </button>
                <button type="button" onClick={nextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />;
                  const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const isSelected = dateStr === value;
                  const isToday    = dateStr === today;
                  const isDisabled = minDate ? dateStr < minDate : false;
                  return (
                    <button key={day} type="button" onClick={() => !isDisabled && selectDay(day)}
                      disabled={isDisabled}
                      className={`w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-colors font-medium
                        ${isDisabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'bg-amber-500 text-white shadow-sm'
                            : isToday
                              ? 'border-2 border-amber-400 text-amber-700'
                              : 'hover:bg-gray-100 text-gray-700'}`}>
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Today */}
              {(!minDate || today >= minDate) && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                  <button type="button" onClick={selectToday}
                    className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors">
                    Bugün
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Year grid */}
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setViewYear(y => y - 12)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm font-bold text-gray-800">{yearBlock} – {yearBlock + 11}</span>
                <button type="button" onClick={() => setViewYear(y => y + 12)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
                  <ChevronRight size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {years.map(y => {
                  const isSelected = y === viewYear;
                  const isCurrentYear = y === Number(today.split('-')[0]);
                  const minYear = minDate ? Number(minDate.split('-')[0]) : null;
                  const isDisabledYear = minYear ? y < minYear : false;
                  return (
                    <button key={y} type="button"
                      onClick={() => { if (!isDisabledYear) { setViewYear(y); setMode('calendar'); } }}
                      disabled={isDisabledYear}
                      className={`py-2 text-sm font-medium rounded-lg transition-colors
                        ${isDisabledYear
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'bg-amber-500 text-white shadow-sm'
                            : isCurrentYear
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'hover:bg-gray-100 text-gray-700'}`}>
                      {y}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                <button type="button"
                  onClick={() => { setViewYear(Number(today.split('-')[0])); setMode('calendar'); }}
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors">
                  Bu Yıl
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
