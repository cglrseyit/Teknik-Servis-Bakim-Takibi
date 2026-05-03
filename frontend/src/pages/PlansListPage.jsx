import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, Wrench, CalendarCheck, RefreshCw, Hash, ChevronRight, Pencil, Zap, Clock } from 'lucide-react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import PlanDetailPanel from '../components/PlanDetailPanel';
import api from '../api/axios';

const FREQ_LABELS = {
  daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık',
  quarterly: '3 Aylık', yearly: 'Yıllık', custom: 'Özel',
};
const FREQ_COLORS = {
  daily:     'bg-amber-50 text-amber-700',
  weekly:    'bg-violet-50 text-violet-700',
  monthly:   'bg-amber-50 text-amber-700',
  quarterly: 'bg-orange-50 text-orange-700',
  yearly:    'bg-red-50 text-red-700',
  custom:    'bg-slate-100 text-slate-600',
};

export default function PlansListPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/plans')
      .then(r => setPlans(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bakım Planları</h1>
          <p className="text-sm text-slate-500 mt-0.5">{plans.length} plan tanımlı</p>
        </div>
        <Link
          to="/plans/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-amber-600/20"
        >
          <Plus size={15} strokeWidth={2.5} />
          Plan Oluştur
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {['Başlık', 'Ekipman', 'Periyot', 'Son Bakım', 'Görev', 'Durum', ''].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded-md animate-pulse" style={{ width: j === 0 ? '70%' : '55%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center">
                  <div className="flex flex-col items-center text-slate-400">
                    <ClipboardList size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">Bakım planı bulunamadı</p>
                  </div>
                </td>
              </tr>
            ) : (
              plans.map(p => (
                <tr key={p.id} onClick={() => setSelectedPlan(p)} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <ClipboardList size={14} className="text-amber-500" strokeWidth={1.8} />
                      </div>
                      <span className="font-semibold text-slate-800">{p.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {p.equipment_name ? (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Wrench size={12} className="text-slate-400" />
                        {p.equipment_name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.is_one_time ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-50 text-orange-700">
                        <Zap size={10} />
                        Tek Seferlik
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${FREQ_COLORS[p.frequency_type] || 'bg-slate-100 text-slate-600'}`}>
                        <RefreshCw size={10} />
                        {FREQ_LABELS[p.frequency_type]}
                        {p.frequency_type === 'custom' ? ` (${p.frequency_days}g)` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.this_month_completed_at ? (
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <CalendarCheck size={12} className="text-emerald-500" />
                        {new Date(p.this_month_completed_at).toLocaleDateString('tr-TR')}
                      </span>
                    ) : p.this_month_has_pending ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
                        <Clock size={10} />
                        Bekliyor
                      </span>
                    ) : p.last_completed_at ? (
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <CalendarCheck size={12} className="text-emerald-500" />
                        {new Date(p.last_completed_at).toLocaleDateString('tr-TR')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
                        <Clock size={10} />
                        Bekliyor
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Hash size={12} className="text-slate-400" />
                      {p.task_count}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {p.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/plans/${p.id}/edit`); }}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <ChevronRight size={14} className="text-slate-300" />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SlidePanel open={Boolean(selectedPlan)} onClose={() => setSelectedPlan(null)} title={selectedPlan?.title || ''}>
        <PlanDetailPanel planId={selectedPlan?.id} />
      </SlidePanel>
    </Layout>
  );
}
