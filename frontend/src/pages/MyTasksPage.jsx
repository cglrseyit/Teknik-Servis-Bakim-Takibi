import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import TaskDetailPanel from '../components/TaskDetailPanel';
import GroupTaskPanel from '../components/GroupTaskPanel';
import { Layers } from 'lucide-react';
import api from '../api/axios';

const STATUS_LABELS = {
  pending: 'Bekliyor', in_progress: 'Devam Ediyor', completed: 'Tamamlandı',
  skipped: 'Atlandı', overdue: 'Gecikmiş', postponed: 'Ertelendi',
};
const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-400',
  overdue: 'bg-red-100 text-red-700',
  postponed: 'bg-orange-100 text-orange-700',
};

// Görevleri parent_equipment_id'ye göre gruplandır
function computeRows(tasks) {
  const rows = [];
  const seenParents = new Map();

  for (const t of tasks) {
    if (t.parent_equipment_id) {
      if (seenParents.has(t.parent_equipment_id)) {
        rows[seenParents.get(t.parent_equipment_id)].tasks.push(t);
      } else {
        const idx = rows.length;
        rows.push({
          isGroup: true,
          parentId: t.parent_equipment_id,
          parentName: t.parent_equipment_name || t.equipment_name,
          tasks: [t],
        });
        seenParents.set(t.parent_equipment_id, idx);
      }
    } else {
      rows.push({ isGroup: false, task: t, tasks: [t] });
    }
  }
  return rows;
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  function loadTasks() {
    api.get('/tasks/my').then(r => setTasks(r.data)).catch(() => {});
  }

  useEffect(() => { loadTasks(); }, []);

  // Grup seçiliyken tasks yenilenince grubu da güncelle
  useEffect(() => {
    if (!selectedGroup) return;
    const rows = computeRows(tasks);
    const updated = rows.find(r => r.isGroup && r.parentId === selectedGroup.parentId);
    if (updated) setSelectedGroup(updated);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTaskCompleted() {
    setSelectedTask(null);
    loadTasks();
  }

  const rows = computeRows(tasks);
  const today = new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Bakım Görevleri</h2>
      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
            Bekleyen görev yok
          </div>
        )}

        {rows.map(row =>
          row.isGroup
            ? <GroupCard key={`g-${row.parentId}`} row={row} today={today} onClick={() => setSelectedGroup(row)} />
            : <TaskCard key={row.task.id} task={row.task} today={today} onClick={() => setSelectedTask(row.task)} />
        )}
      </div>

      {/* Tekil görev paneli */}
      <SlidePanel
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || ''}
      >
        <TaskDetailPanel
          taskId={selectedTask?.id}
          onCompleted={handleTaskCompleted}
        />
      </SlidePanel>

      {/* Grup görev paneli */}
      <SlidePanel
        wide
        open={Boolean(selectedGroup)}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup?.parentName || ''}
        subtitle={selectedGroup ? `${selectedGroup.tasks.length} birim · Bakım Tamamlama` : ''}
      >
        <GroupTaskPanel
          tasks={selectedGroup?.tasks}
          onCompleted={loadTasks}
          onBulkCompleted={() => { setSelectedGroup(null); loadTasks(); }}
        />
      </SlidePanel>
    </Layout>
  );
}

function TaskCard({ task, today, onClick }) {
  const isOverdue = task.scheduled_date?.split('T')[0] < today && task.status === 'pending';
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-red-400' : 'border-amber-400'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-800 truncate">{task.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {task.equipment_name}{task.location ? ` · ${task.location}` : ''}
          </p>
          <p className={`text-xs mt-1 font-medium ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
            {isOverdue ? '⚠ Gecikmiş · ' : ''}{task.scheduled_date?.split('T')[0]}
          </p>
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>
      {task.description && <p className="text-xs text-gray-500 mt-2 truncate">{task.description}</p>}
    </div>
  );
}

function GroupCard({ row, today, onClick }) {
  const overdueCount = row.tasks.filter(t => t.status === 'overdue' || (t.scheduled_date?.split('T')[0] < today && t.status === 'pending')).length;
  const inProgressCount = row.tasks.filter(t => t.status === 'in_progress').length;
  const pendingCount = row.tasks.filter(t => t.status === 'pending').length;
  const firstTask = row.tasks[0];

  // Özet durum
  let statusLabel, statusClass;
  if (overdueCount > 0) {
    statusLabel = `${overdueCount} Gecikmiş`;
    statusClass = 'bg-red-100 text-red-700';
  } else if (inProgressCount > 0) {
    statusLabel = `${inProgressCount} Devam Ediyor`;
    statusClass = 'bg-yellow-100 text-yellow-700';
  } else {
    statusLabel = `${pendingCount} Bekliyor`;
    statusClass = 'bg-gray-100 text-gray-600';
  }

  const borderClass = overdueCount > 0 ? 'border-red-400' : 'border-violet-400';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Layers size={14} className="text-violet-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-800 truncate">{firstTask.title}</p>
              <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">
                {row.tasks.length} birim
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{row.parentName}</p>
            <p className="text-xs text-gray-500 mt-1">{firstTask.scheduled_date?.split('T')[0]}</p>
          </div>
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
