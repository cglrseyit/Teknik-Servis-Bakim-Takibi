import { CheckCircle2, RefreshCw } from 'lucide-react';

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STATUS_CLS   = { overdue: 'bg-red-100 text-red-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-amber-100 text-amber-700', postponed: 'bg-orange-100 text-orange-700' };
const STATUS_LABEL = { overdue: 'Gecikmiş', in_progress: 'Devam Ediyor', pending: 'Bekliyor', postponed: 'Ertelendi' };
const FREQ_LABELS  = { monthly: 'Aylık', quarterly: '3 Aylık', semiannual: '6 Aylık', yearly: 'Yıllık', custom: 'Özel' };

export default function MultiPlanPanel({ plans }) {
  if (!plans?.length) return null;

  const first = plans[0];
  const doneCount    = plans.filter(p => p.this_month_completed_at).length;
  const pendingCount = plans.filter(p => p.this_month_has_pending && !p.this_month_completed_at).length;
  const overdueCount = plans.filter(p => p.current_task_status === 'overdue').length;

  return (
    <div className="space-y-4">
      {/* Plan bilgisi */}
      <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm">
        <p className="font-semibold text-slate-700">{first.title}</p>
        {!first.is_one_time && (
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <RefreshCw size={10} />
            {FREQ_LABELS[first.frequency_type] || first.frequency_type}
            {first.frequency_type === 'custom' ? ` (${first.frequency_days} günde bir)` : ''}
            {' · '}{plans.length} birim
          </p>
        )}
      </div>

      {/* Özet sayaçlar */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 rounded-xl py-3">
          <p className="text-xl font-bold text-emerald-700">{doneCount}</p>
          <p className="text-[10px] text-emerald-500 mt-0.5">Tamamlandı</p>
        </div>
        <div className="bg-amber-50 rounded-xl py-3">
          <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
          <p className="text-[10px] text-amber-500 mt-0.5">Bekliyor</p>
        </div>
        <div className="bg-red-50 rounded-xl py-3">
          <p className="text-xl font-bold text-red-700">{overdueCount}</p>
          <p className="text-[10px] text-red-500 mt-0.5">Gecikmiş</p>
        </div>
      </div>

      {/* Birim listesi */}
      <div className="space-y-2">
        {plans.map(plan => {
          const doneThisMonth = plan.this_month_completed_at;
          const statusCls   = STATUS_CLS[plan.current_task_status];
          const statusLabel = STATUS_LABEL[plan.current_task_status];
          return (
            <div key={plan.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${doneThisMonth ? 'bg-emerald-50/50 border-emerald-100' : plan.current_task_status === 'overdue' ? 'bg-red-50/30 border-red-100' : 'bg-white border-slate-100'}`}>
              <div className="min-w-0 mr-3">
                <p className="text-sm font-medium text-slate-700 truncate">{plan.equipment_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {doneThisMonth ? fmt(plan.this_month_completed_at) : plan.last_completed_at ? `Son bakım: ${fmt(plan.last_completed_at)}` : 'Henüz tamamlanmadı'}
                </p>
              </div>
              {doneThisMonth ? (
                <span className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={11} />Tamamlandı
                </span>
              ) : statusCls ? (
                <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold ${statusCls}`}>{statusLabel}</span>
              ) : (
                <span className="flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-400">Görev Yok</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
