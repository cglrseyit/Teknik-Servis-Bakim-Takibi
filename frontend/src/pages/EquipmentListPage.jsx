import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Wrench, ChevronRight, SlidersHorizontal, FileSpreadsheet } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/axios';

const STATUS_CONFIG = {
  active:      { label: 'Aktif',    bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  passive:     { label: 'Pasif',    bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400' },
  maintenance: { label: 'Bakımda', bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
  broken:      { label: 'Arızalı', bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-500' },
};

const FREQUENCY_LABELS = {
  monthly:   'Aylık',
  quarterly: '3 Aylık',
  biannual:  '6 Aylık',
  yearly:    'Yıllık',
  custom:    'Özel',
};

// Bakım Planları sayfasındaki periyot renkleriyle aynı tutulur
const FREQUENCY_COLORS = {
  monthly:    'bg-amber-50 text-amber-700',
  quarterly:  'bg-orange-50 text-orange-700',
  biannual:   'bg-slate-100 text-slate-500',
  semiannual: 'bg-slate-100 text-slate-500',
  yearly:     'bg-red-50 text-red-700',
  custom:     'bg-slate-100 text-slate-600',
};

export default function EquipmentListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    api.get(`/equipment?${params}`)
      .then(r => { if (active) setItems(r.data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, filterStatus]);

  async function exportList() {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      const r = await api.get(`/exports/equipment/list.xlsx?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ekipman-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  return (
    <Layout>
      {/* Filtreler + Butonlar aynı satırda */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Ekipman ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all shadow-sm"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all shadow-sm appearance-none cursor-pointer"
          >
            <option value="">Tüm Durumlar</option>
            {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        {/* Butonlar — arama satırının sağına hizalı */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={exportList}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-semibold rounded-xl transition-colors"
          >
            <FileSpreadsheet size={15} />
            Excel'e Aktar
          </button>
          <Link
            to="/equipment/new"
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-amber-600/20"
          >
            <Plus size={15} strokeWidth={2.5} />
            Ekipman Ekle
          </Link>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ekipman</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kategori</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tedarikçi</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bakım Periyodu</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Durum</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className={`h-4 bg-slate-100 rounded-md animate-pulse ${j === 0 ? 'w-[70%]' : j === 5 ? 'w-10' : 'w-[60%]'}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center">
                  <div className="flex flex-col items-center text-slate-400">
                    <Wrench size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">Ekipman bulunamadı</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map(eq => (
                <tr key={eq.id} onClick={() => navigate(`/equipment/${eq.id}`)} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Wrench size={14} className="text-slate-500" strokeWidth={1.8} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{eq.name}</span>
                        {eq.unit_count > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                            {eq.unit_count} birim{eq.broken_unit_count > 0 && <span className="ml-1 text-red-500">· {eq.broken_unit_count} arızalı</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{eq.category || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{eq.supplier || '—'}</td>
                  <td className="px-5 py-3.5">
                    {(() => {
                      const freq = eq.maintenance_period || eq.maintenance_frequency;
                      if (!freq) return '—';
                      return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold ${FREQUENCY_COLORS[freq] || 'bg-slate-100 text-slate-600'}`}>
                          {FREQUENCY_LABELS[freq] || freq}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3.5">
                    {(() => { const sc = STATUS_CONFIG[eq.status] || STATUS_CONFIG.passive; return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    ); })()}
                  </td>
                  <td className="px-5 py-3.5">
                    <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
