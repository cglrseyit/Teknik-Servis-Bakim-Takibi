import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import TaskDetailPanel from './TaskDetailPanel';

const STATUS_DOT = {
  overdue:    'bg-red-500',
  in_progress: 'bg-blue-500',
  pending:    'bg-amber-500',
  postponed:  'bg-orange-400',
};

const STATUS_PRIORITY = { overdue: 0, in_progress: 1, postponed: 2, pending: 3 };

export default function MultiPlanPanel({ plans, onCompleted }) {
  const sorted = [...(plans || [])].sort((a, b) => {
    const ap = STATUS_PRIORITY[a.current_task_status] ?? 4;
    const bp = STATUS_PRIORITY[b.current_task_status] ?? 4;
    return ap - bp;
  });

  const [activeIdx, setActiveIdx] = useState(0);
  // Bu oturumda tamamlanan görev ID'leri — yeniden yüklemeyi beklemeden geçiş yapmak için
  const [localDone, setLocalDone] = useState(new Set());

  if (!sorted.length) return null;

  const active = sorted[Math.min(activeIdx, sorted.length - 1)];

  function isTabDone(plan) {
    return !plan.current_task_id || localDone.has(plan.current_task_id);
  }

  function handleTaskCompleted() {
    const taskId = sorted[activeIdx]?.current_task_id;

    // Kapanmadan önce tamamlananı işaretle
    const newDone = new Set(localDone);
    if (taskId) newDone.add(taskId);

    setLocalDone(newDone);

    // Sıradaki tamamlanmamış sekmeye geç
    for (let i = activeIdx + 1; i < sorted.length; i++) {
      const p = sorted[i];
      if (p.current_task_id && !newDone.has(p.current_task_id)) {
        setTimeout(() => setActiveIdx(i), 600);
        break;
      }
    }

    onCompleted?.();
  }

  return (
    <div className="flex gap-3 min-h-0">
      {/* Sol: dikey sekme listesi */}
      <div className="flex-shrink-0 w-[120px] space-y-0.5">
        {sorted.map((plan, i) => {
          const done = isTabDone(plan);
          const isActive = activeIdx === i;
          const dot = STATUS_DOT[plan.current_task_status] || 'bg-slate-300';

          return (
            <button
              key={plan.id}
              onClick={() => setActiveIdx(i)}
              className={`w-full text-left px-2.5 py-2.5 rounded-lg text-xs font-medium transition-all border-l-[3px] ${
                isActive
                  ? 'bg-amber-50 text-amber-700 border-l-amber-500'
                  : done
                  ? 'text-emerald-600 border-l-emerald-400 bg-emerald-50/40'
                  : 'text-slate-500 border-l-transparent hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${done ? 'bg-emerald-500' : dot}`} />
                {done && <span className="text-[9px] font-bold text-emerald-600 leading-none">✓</span>}
              </div>
              <span className="block truncate leading-snug">{plan.equipment_name}</span>
            </button>
          );
        })}
      </div>

      {/* Dikey ayırıcı */}
      <div className="w-px bg-slate-100 flex-shrink-0 self-stretch" />

      {/* Sağ: içerik */}
      <div className="flex-1 min-w-0">
        {!isTabDone(active) && active.current_task_id ? (
          <TaskDetailPanel
            key={active.current_task_id}
            taskId={active.current_task_id}
            onCompleted={handleTaskCompleted}
          />
        ) : isTabDone(active) && active.current_task_id ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <span className="text-emerald-500 text-lg">✓</span>
            </div>
            <p className="text-sm font-medium text-emerald-600">Bu birim tamamlandı</p>
            <p className="text-xs text-slate-400 mt-1">Sol listeden başka bir birime geçebilirsiniz.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <CalendarCheck size={18} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">Bu birim için aktif görev yok</p>
            <p className="text-xs text-slate-400 mt-1">Bakım görevi oluşturulduğunda buraya gelecek.</p>
          </div>
        )}
      </div>
    </div>
  );
}
