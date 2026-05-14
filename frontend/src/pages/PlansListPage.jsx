import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, Wrench, CalendarCheck, RefreshCw, ChevronRight, Pencil, Zap, Clock, Layers } from 'lucide-react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import PlanDetailPanel from '../components/PlanDetailPanel';
import MultiPlanPanel from '../components/MultiPlanPanel';
import api from '../api/axios';

const FREQ_LABELS = {
  monthly: 'Aylık', quarterly: '3 Aylık', semiannual: '6 Aylık', yearly: 'Yıllık', custom: 'Özel',
};
const FREQ_COLORS = {
  monthly:    'bg-amber-50 text-amber-700',
  quarterly:  'bg-orange-50 text-orange-700',
  semiannual: 'bg-slate-100 text-slate-500',
  yearly:     'bg-red-50 text-red-700',
  custom:     'bg-slate-100 text-slate-600',
};

// Planları parent_equipment_id'ye göre gruplandır
function computeRows(plans) {
  const rows = [];
  const seenParents = new Map(); // parent_equipment_id → index in rows

  for (const plan of plans) {
    if (plan.parent_equipment_id) {
      if (seenParents.has(plan.parent_equipment_id)) {
        rows[seenParents.get(plan.parent_equipment_id)].plans.push(plan);
      } else {
        const idx = rows.length;
        rows.push({
          isGroup: true,
          parentId: plan.parent_equipment_id,
          parentName: plan.parent_equipment_name || plan.equipment_name,
          plans: [plan],
        });
        seenParents.set(plan.parent_equipment_id, idx);
      }
    } else {
      rows.push({ isGroup: false, plan, plans: [plan] });
    }
  }
  return rows;
}

export default function PlansListPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);   // tekil plan
  const [selectedGroup, setSelectedGroup] = useState(null); // grup planları

  function loadPlans() {
    setLoading(true);
    api.get('/plans')
      .then(r => setPlans(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPlans(); }, []);

  // Grup seçiliyken planlar yenilenince grubu da güncelle
  useEffect(() => {
    if (!selectedGroup) return;
    const rows = computeRows(plans);
    const updated = rows.find(r => r.isGroup && r.parentId === selectedGroup.parentId);
    if (updated) setSelectedGroup(updated);
  }, [plans]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = computeRows(plans);

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
              {['Başlık', 'Ekipman', 'Periyot', 'Son Bakım', 'Durum', ''].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className={`h-4 bg-slate-100 rounded-md animate-pulse ${j === 0 ? 'w-[70%]' : 'w-[55%]'}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center">
                  <div className="flex flex-col items-center text-slate-400">
                    <ClipboardList size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">Bakım planı bulunamadı</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(row => row.isGroup
                ? <GroupRow key={`g-${row.parentId}`} row={row} onClick={() => setSelectedGroup(row)} onEdit={id => navigate(`/plans/${id}/edit`)} />
                : <PlanRow key={row.plan.id} p={row.plan} onClick={() => setSelectedPlan(row.plan)} onEdit={id => navigate(`/plans/${id}/edit`)} />
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Tekil plan paneli */}
      <SlidePanel open={Boolean(selectedPlan)} onClose={() => setSelectedPlan(null)} title={selectedPlan?.title || ''}>
        <PlanDetailPanel
          planId={selectedPlan?.id}
          onDeleted={() => { setSelectedPlan(null); loadPlans(); }}
        />
      </SlidePanel>

      {/* Grup (çoklu birim) paneli */}
      <SlidePanel
        wide
        open={Boolean(selectedGroup)}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup?.parentName || ''}
        subtitle={selectedGroup ? `${selectedGroup.plans.length} birim · Bakım Tamamlama` : ''}
      >
        <MultiPlanPanel
          plans={selectedGroup?.plans}
          onCompleted={loadPlans}
        />
      </SlidePanel>
    </Layout>
  );
}

function PlanRow({ p, onClick, onEdit }) {
  return (
    <tr onClick={onClick} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
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
        <FreqBadge plan={p} />
      </td>
      <td className="px-5 py-3.5">
        <LastMaintenance plan={p} />
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge active={p.is_active} />
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit(p.id); }}
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
          >
            <Pencil size={13} />
          </button>
          <ChevronRight size={14} className="text-slate-300" />
        </div>
      </td>
    </tr>
  );
}

function GroupRow({ row, onClick, onEdit }) {
  const first = row.plans[0];
  const completedCount = row.plans.filter(p => p.this_month_completed_at).length;
  const pendingCount = row.plans.filter(p => p.this_month_has_pending && !p.this_month_completed_at).length;
  const activeCount = row.plans.filter(p => p.is_active).length;

  return (
    <tr onClick={onClick} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Layers size={14} className="text-violet-500" strokeWidth={1.8} />
          </div>
          <div>
            <span className="font-semibold text-slate-800">{first.title}</span>
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-600">
              {row.plans.length} birim
            </span>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="flex items-center gap-1.5 text-slate-500">
          <Wrench size={12} className="text-slate-400" />
          {row.parentName}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <FreqBadge plan={first} />
      </td>
      <td className="px-5 py-3.5">
        {completedCount > 0 && (
          <span className="flex items-center gap-1.5 text-slate-600">
            <CalendarCheck size={12} className="text-emerald-500" />
            {completedCount}/{row.plans.length} Tamamlandı
          </span>
        )}
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 mt-0.5">
            <Clock size={10} />
            {pendingCount} Bekliyor
          </span>
        )}
        {completedCount === 0 && pendingCount === 0 && '—'}
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${activeCount === row.plans.length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${activeCount === row.plans.length ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {activeCount}/{row.plans.length} Aktif
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight size={14} className="text-slate-300" />
        </div>
      </td>
    </tr>
  );
}

function FreqBadge({ plan }) {
  if (plan.is_one_time) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-50 text-orange-700">
        <Zap size={10} />
        Tek Seferlik
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${FREQ_COLORS[plan.frequency_type] || 'bg-slate-100 text-slate-600'}`}>
      <RefreshCw size={10} />
      {FREQ_LABELS[plan.frequency_type]}
      {plan.frequency_type === 'custom' ? ` (${plan.frequency_days}g)` : ''}
    </span>
  );
}

function LastMaintenance({ plan }) {
  return (
    <>
      {plan.this_month_completed_at ? (
        <span className="flex items-center gap-1.5 text-slate-600">
          <CalendarCheck size={12} className="text-emerald-500" />
          {new Date(plan.this_month_completed_at).toLocaleDateString('tr-TR')}
        </span>
      ) : plan.last_completed_at ? (
        <span className="flex items-center gap-1.5 text-slate-600">
          <CalendarCheck size={12} className="text-emerald-500" />
          {new Date(plan.last_completed_at).toLocaleDateString('tr-TR')}
        </span>
      ) : null}
      {!plan.this_month_completed_at && plan.this_month_has_pending && (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 mt-0.5">
          <Clock size={10} />
          Bekliyor
        </span>
      )}
    </>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Aktif' : 'Pasif'}
    </span>
  );
}
