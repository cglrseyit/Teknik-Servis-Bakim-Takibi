import { useState } from 'react';
import TaskDetailPanel from './TaskDetailPanel';

const STATUS_DOT = {
  overdue:    'bg-red-500',
  in_progress: 'bg-blue-500',
  pending:    'bg-amber-500',
  postponed:  'bg-orange-400',
};

const STATUS_PRIORITY = { overdue: 0, in_progress: 1, postponed: 2, pending: 3 };

export default function GroupTaskPanel({ tasks, onCompleted, onBulkCompleted }) {
  const sorted = [...(tasks || [])].sort((a, b) => {
    const ap = STATUS_PRIORITY[a.status] ?? 5;
    const bp = STATUS_PRIORITY[b.status] ?? 5;
    return ap - bp;
  });

  const [activeIdx, setActiveIdx] = useState(0);
  const [localDone, setLocalDone] = useState(new Set());

  if (!sorted.length) return null;

  const active = sorted[Math.min(activeIdx, sorted.length - 1)];

  function isTabDone(task) {
    return ['completed', 'skipped'].includes(task.status) || localDone.has(task.id);
  }

  function handleTaskCompleted() {
    const taskId = sorted[activeIdx]?.id;
    const newDone = new Set(localDone);
    if (taskId) newDone.add(taskId);
    setLocalDone(newDone);

    // Sıradaki tamamlanmamış sekmeye 600ms sonra geç
    for (let i = activeIdx + 1; i < sorted.length; i++) {
      const t = sorted[i];
      if (!newDone.has(t.id) && !['completed', 'skipped'].includes(t.status)) {
        setTimeout(() => setActiveIdx(i), 600);
        break;
      }
    }

    onCompleted?.();
  }

  return (
    <div className="flex gap-3">
      {/* Sol: dikey sekme listesi */}
      <div className="flex-shrink-0 w-[120px] space-y-0.5">
        {sorted.map((task, i) => {
          const done = isTabDone(task);
          const isActive = activeIdx === i;
          const dot = STATUS_DOT[task.status] || 'bg-slate-300';

          return (
            <button
              key={task.id}
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
              <span className="block truncate leading-snug">{task.equipment_name}</span>
            </button>
          );
        })}
      </div>

      {/* Dikey ayırıcı */}
      <div className="w-px bg-slate-100 flex-shrink-0 self-stretch" />

      {/* Sağ: içerik */}
      <div className="flex-1 min-w-0">
        {!isTabDone(active) ? (
          <TaskDetailPanel
            key={active.id}
            taskId={active.id}
            groupTasks={sorted}
            onCompleted={handleTaskCompleted}
            onBulkCompleted={onBulkCompleted}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <span className="text-emerald-500 text-xl">✓</span>
            </div>
            <p className="text-sm font-medium text-emerald-600">Bu birim tamamlandı</p>
            <p className="text-xs text-slate-400 mt-1">Sol listeden başka bir birime geçebilirsiniz.</p>
          </div>
        )}
      </div>
    </div>
  );
}
