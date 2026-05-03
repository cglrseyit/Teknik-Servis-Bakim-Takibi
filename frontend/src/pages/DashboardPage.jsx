import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Activity, AlertTriangle, CheckCircle2, PlayCircle, Search, X, CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import ConfirmModal from '../components/ConfirmModal';
import SlidePanel from '../components/SlidePanel';
import TaskDetailPanel from '../components/TaskDetailPanel';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// PDF renk kodlarına uygun:
// Gerçekleşen (Tamamlandı) = Kırmızı, Ertelenen/Gecikmiş = Mavi, Planlanan = Gri
const STATUS_CONFIG = {
  pending:     { label: 'Bekliyor',    variant: 'secondary' },
  in_progress: { label: 'Devam Ediyor', variant: 'warning' },
  completed:   { label: 'Gerçekleşti', variant: 'danger' },
  overdue:     { label: 'Gecikmiş',    variant: 'primary' },
  skipped:     { label: 'Atlandı',     variant: 'secondary' },
  postponed:   { label: 'Ertelendi',   variant: 'primary' },
};

const STATUS_FILTERS = [
  { key: 'undone',      label: 'Yapılacaklar' },
  { key: 'in_progress', label: 'Bakımda' },
  { key: 'completed',   label: 'Tamamlananlar' },
];

const STAT_CARDS = [
  { key: 'pending',              label: 'Bu Ayın Bekleyenleri', Icon: ClipboardList, color: 'bg-amber-500',   change: 'Bu ay bekliyor' },
  { key: 'in_progress',         label: 'Devam Eden',           Icon: Activity,      color: 'bg-yellow-500', change: 'Acil olanlar' },
  { key: 'completed_this_month',label: 'Tamamlanan',           Icon: CheckCircle2,  color: 'bg-green-500',  change: 'Bu ay' },
  { key: 'overdue',             label: 'Gecikmiş',             Icon: AlertTriangle, color: 'bg-red-500',    change: 'Dikkat gerekiyor' },
];

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function lastDayOfMonth(ym) {
  const [year, month] = ym.split('-').map(Number);
  const day = new Date(year, month, 0).getDate();
  return `${ym}-${String(day).padStart(2, '0')}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function MonthPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => Number(value.split('-')[0]));
  const ref = useRef(null);

  const [selYear, selMonth] = value.split('-').map(Number);
  const todayYM = currentYearMonth();

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setPickerYear(Number(value.split('-')[0]));
  }, [open, value]);

  function pick(monthIdx) {
    onChange(`${pickerYear}-${String(monthIdx + 1).padStart(2, '0')}`);
    setOpen(false);
  }

  return (
    <div className="relative inline-flex items-center gap-1" ref={ref}>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(value, -1))}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Önceki ay"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200/70 text-amber-800 hover:from-amber-100 hover:to-amber-100 transition-all shadow-sm min-w-[140px]"
      >
        <CalendarDays size={14} className="text-amber-600" />
        <span className="text-sm font-semibold">{MONTH_NAMES[selMonth - 1]} {selYear}</span>
        <ChevronDown size={13} className={`text-amber-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <button
        type="button"
        onClick={() => onChange(shiftMonth(value, 1))}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Sonraki ay"
      >
        <ChevronRight size={16} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-72">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setPickerYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-gray-800">{pickerYear}</span>
            <button
              type="button"
              onClick={() => setPickerYear(y => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES.map((m, i) => {
              const isSelected = pickerYear === selYear && i + 1 === selMonth;
              const isToday = `${pickerYear}-${String(i + 1).padStart(2, '0')}` === todayYM;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick(i)}
                  className={`px-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-amber-500 text-white shadow-sm'
                      : isToday
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { onChange(todayYM); setOpen(false); }}
            className="mt-3 w-full text-xs font-semibold text-amber-600 hover:text-amber-700 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
          >
            Bu Aya Dön
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);
  const [statusFilter, setStatusFilter] = useState('undone');
  const [selectedTask, setSelectedTask] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [earlyStart, setEarlyStart] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const taskParamHandled = useRef(false);

  const today = new Date().toISOString().split('T')[0];

  function loadSummary() {
    api.get('/tasks/summary').then(r => setSummary(r.data)).catch(() => {});
  }

  function loadTasks() {
    if (!user) return;

    if (search) {
      api.get(`/tasks?search=${encodeURIComponent(search)}`).then(r => setTasks(r.data)).catch(() => {});
      return;
    }

    const firstDay = `${selectedMonth}-01`;
    const lastDay = lastDayOfMonth(selectedMonth);

    const params = new URLSearchParams({ date_from: firstDay, date_to: lastDay });
    if (statusFilter === 'undone') {
      params.set('undone', 'true');
    } else {
      params.set('status', statusFilter);
    }

    api.get(`/tasks?${params}`).then(r => setTasks(r.data)).catch(() => {});
  }

  useEffect(() => {
    if (!user || taskParamHandled.current) return;
    const taskId = searchParams.get('task');
    if (!taskId) return;
    taskParamHandled.current = true;
    api.get(`/tasks/${taskId}`).then(r => {
      setSelectedTask(r.data);
      setSearchParams({}, { replace: true });
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { if (user) loadTasks(); }, [selectedMonth, statusFilter, user, search]);

  async function doStart(id) {
    setUpdating(id);
    try {
      const { data } = await api.put(`/tasks/${id}/status`, { status: 'in_progress' });
      setTasks(t => t.map(x => x.id === id ? { ...x, ...data } : x));
    } catch (err) {
      alert(err.response?.data?.error || 'Hata oluştu');
    } finally { setUpdating(null); }
  }

  function handleStart(e, task) {
    e.stopPropagation();
    const scheduledDate = task.scheduled_date?.split('T')[0];
    if (scheduledDate) {
      const daysLeft = Math.ceil((new Date(scheduledDate) - new Date(today)) / (1000 * 60 * 60 * 24));
      if (daysLeft > 10) {
        setEarlyStart({ id: task.id, daysLeft });
        return;
      }
    }
    doStart(task.id);
  }

  function handleCompleted() {
    setSelectedTask(null);
    loadTasks();
    loadSummary();
  }

  // Kategori bazlı gruplama (arama modunda düz liste)
  const groupedTasks = useMemo(() => {
    if (search || tasks.length === 0) return null;
    const groups = {};
    for (const t of tasks) {
      const cat = t.category || 'Diğer';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [tasks, search]);

  function renderTaskRow(t) {
    const isOverdue = t.status === 'overdue' ||
      (t.scheduled_date?.split('T')[0] < today && t.status === 'pending');
    const effectiveStatus = isOverdue && t.status === 'pending' ? 'overdue' : t.status;
    const sc = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;

    return (
      <tr
        key={t.id}
        onClick={() => setSelectedTask(t)}
        className="hover:bg-gray-50 cursor-pointer"
      >
        <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.title}</td>
        <td className="px-6 py-4 text-sm text-gray-600">
          {t.equipment_name || '—'}
          {t.location ? <span className="text-gray-400"> · {t.location}</span> : ''}
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">{t.assigned_name || '—'}</td>
        <td className="px-6 py-4 text-sm text-gray-600">
          {t.scheduled_date
            ? new Date(t.scheduled_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </td>
        <td className="px-6 py-4">
          <Badge variant={sc.variant} appearance="light">{sc.label}</Badge>
        </td>
        <td className="px-6 py-4">
          {t.status === 'pending' && (
            <button
              onClick={e => handleStart(e, t)}
              disabled={updating === t.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Başla
            </button>
          )}
          {t.status === 'in_progress' && (
            <span className="text-xs text-green-600 font-semibold">Tamamla →</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <Layout>
      <div className="p-6 overflow-auto">

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {STAT_CARDS.map(({ key, label, Icon, color, change }) => (
            <div key={key} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">{label}</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">
                {summary
                  ? (summary[key] ?? 0)
                  : <span className="inline-block w-10 h-8 bg-gray-100 rounded animate-pulse" />
                }
              </p>
              <p className="text-xs text-gray-500">{change}</p>
            </div>
          ))}
        </div>

        {/* Task Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">

            {/* Sol: Başlık + Ay Seçici */}
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 shrink-0">Bakım Görevleri</h3>
              <MonthPicker
                value={selectedMonth}
                onChange={ym => { setSelectedMonth(ym); setStatusFilter('undone'); }}
              />
            </div>

            {/* Sağ: Arama + Durum Filtreleri */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-44">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Ekipman ara..."
                  className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setSearch(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {!search && (
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  {STATUS_FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        statusFilter === f.key
                          ? 'bg-white text-gray-800 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              {search && (
                <span className="text-xs text-amber-600 font-medium">{tasks.length} sonuç</span>
              )}
            </div>
          </div>

          {/* PDF Efsanesi (Legend) */}
          <div className="px-6 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center gap-5 text-xs text-gray-500 flex-wrap">
            <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Durum Göstergesi:</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gray-300 inline-block" />Planlanan Bakım</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-400 inline-block" />Gerçekleşen Bakım</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />Ertelenen Bakım</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-yellow-400 inline-block" />Devam Ediyor</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Görev</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ekipman</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sorumlu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        {search
                          ? `"${search}" için görev bulunamadı`
                          : `${monthLabel(selectedMonth)} için ${statusFilter === 'completed' ? 'tamamlanan' : statusFilter === 'in_progress' ? 'devam eden' : 'bekleyen'} görev yok`}
                      </p>
                    </td>
                  </tr>
                ) : groupedTasks ? (
                  Object.entries(groupedTasks).map(([cat, catTasks]) => (
                    <>
                      <tr key={`cat-${cat}`} className="bg-amber-50/50 border-y border-amber-100">
                        <td colSpan={6} className="px-6 py-2 text-[11px] font-bold text-amber-600 uppercase tracking-widest">
                          ▸ {cat}
                        </td>
                      </tr>
                      {catTasks.map(t => renderTaskRow(t))}
                    </>
                  ))
                ) : (
                  tasks.map(t => renderTaskRow(t))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(earlyStart)}
        title="Erken Başlatma Uyarısı"
        message={`Bu bakımın planlanmış tarihine ${earlyStart?.daysLeft} gün kaldı. Yine de şimdi başlatmak istiyor musunuz?`}
        confirmLabel="Evet, Başlat"
        variant="warning"
        onConfirm={() => { doStart(earlyStart.id); setEarlyStart(null); }}
        onCancel={() => setEarlyStart(null)}
      />

      <SlidePanel
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || ''}
      >
        <TaskDetailPanel taskId={selectedTask?.id} onCompleted={handleCompleted} />
      </SlidePanel>
    </Layout>
  );
}
