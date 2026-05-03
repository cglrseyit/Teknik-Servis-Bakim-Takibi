import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import TaskDetailPanel from '../components/TaskDetailPanel';
import api from '../api/axios';

const STATUS_LABELS = { pending: 'Bekliyor', in_progress: 'Devam Ediyor', completed: 'Tamamlandı', skipped: 'Atlandı', overdue: 'Gecikmiş' };
const STATUS_COLORS = { pending: 'bg-gray-100 text-gray-600', in_progress: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', skipped: 'bg-gray-100 text-gray-400', overdue: 'bg-red-100 text-red-700' };

export default function MyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [updating, setUpdating] = useState(null);

  function loadTasks() {
    api.get('/tasks/my').then(r => setTasks(r.data)).catch(() => {});
  }

  useEffect(() => { loadTasks(); }, []);

  async function handleStart(e, id) {
    e.stopPropagation();
    setUpdating(id);
    try {
      const { data } = await api.put(`/tasks/${id}/status`, { status: 'in_progress' });
      setTasks(t => t.map(x => x.id === id ? { ...x, ...data } : x));
    } catch (err) {
      alert(err.response?.data?.error || 'Hata oluştu');
    } finally {
      setUpdating(null);
    }
  }

  function handleCompleted() {
    setSelectedTask(null);
    loadTasks();
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Görevlerim</h2>
      <div className="space-y-3">
        {tasks.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
            Bekleyen göreviniz yok
          </div>
        )}
        {tasks.map(t => {
          const isOverdue = t.scheduled_date?.split('T')[0] < today && t.status === 'pending';
          return (
            <div
              key={t.id}
              onClick={() => setSelectedTask(t)}
              className={`bg-white rounded-xl shadow-sm p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-red-400' : 'border-amber-400'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{t.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.equipment_name}{t.location ? ` · ${t.location}` : ''}
                  </p>
                  <p className={`text-xs mt-1 font-medium ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                    {isOverdue ? '⚠ Gecikmiş · ' : ''}{t.scheduled_date?.split('T')[0]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                    {STATUS_LABELS[t.status]}
                  </span>
                  {t.status === 'pending' && (
                    <button
                      onClick={(e) => handleStart(e, t.id)}
                      disabled={updating === t.id}
                      className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-lg hover:bg-yellow-200"
                    >
                      Başla
                    </button>
                  )}
                  {t.status === 'in_progress' && (
                    <span className="text-xs text-green-600 font-medium">Tamamla →</span>
                  )}
                </div>
              </div>
              {t.description && <p className="text-xs text-gray-500 mt-2">{t.description}</p>}
            </div>
          );
        })}
      </div>

      <SlidePanel
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || ''}
      >
        <TaskDetailPanel
          taskId={selectedTask?.id}
          onCompleted={handleCompleted}
        />
      </SlidePanel>
    </Layout>
  );
}
