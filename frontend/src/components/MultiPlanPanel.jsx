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

  if (!sorted.length) return null;

  const active = sorted[activeIdx] || sorted[0];

  return (
    <div>
      {/* Tab bar — yatay kaydırılabilir */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {sorted.map((plan, i) => {
          const dot = STATUS_DOT[plan.current_task_status] || 'bg-slate-300';
          const isActive = activeIdx === i;
          return (
            <button
              key={plan.id}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors border ${
                isActive
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              <span className="truncate max-w-[110px]">{plan.equipment_name}</span>
            </button>
          );
        })}
      </div>

      {/* Sekme içeriği */}
      {active.current_task_id ? (
        <TaskDetailPanel
          key={active.current_task_id}
          taskId={active.current_task_id}
          onCompleted={onCompleted}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
            <CalendarCheck size={20} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">Bu birim için aktif görev yok</p>
          <p className="text-xs text-slate-400 mt-1">Bakım görevi oluşturulduğunda burada görünecek.</p>
        </div>
      )}
    </div>
  );
}
