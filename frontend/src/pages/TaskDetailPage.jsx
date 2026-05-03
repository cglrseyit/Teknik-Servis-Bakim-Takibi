import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [nextDate, setNextDate] = useState(null);
  const [form, setForm] = useState({ performed_work: '', maintained_by: '', responsible_person: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/tasks/${id}`).then(async r => {
      setTask(r.data);
      // Sonraki bakım tarihini plan üzerinden hesapla
      if (r.data.plan_id) {
        try {
          const plan = await api.get(`/plans/${r.data.plan_id}`);
          setNextDate(plan.data.next_scheduled_date);
        } catch {}
      }
    }).catch(() => navigate('/tasks/my'));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.performed_work.trim()) { setError('Yapılan işlemleri yazmanız zorunludur'); return; }
    if (!form.maintained_by.trim()) { setError('Bakımı yapan kişi/firma zorunludur'); return; }
    if (!form.responsible_person.trim()) { setError('Sorumlu personel zorunludur'); return; }
    setLoading(true);
    setError('');
    try {
      await api.put(`/tasks/${id}/status`, {
        status: 'completed',
        performed_work: form.performed_work,
        maintained_by: form.maintained_by,
        responsible_person: form.responsible_person,
      });
      navigate('/tasks/my');
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  if (!task) return <Layout><div className="text-gray-400 text-sm">Yükleniyor...</div></Layout>;

  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const isAlreadyDone = ['completed', 'skipped'].includes(task.status);

  return (
    <Layout>
      <div className="max-w-xl">
        <button onClick={() => navigate('/tasks/my')} className="text-sm text-gray-400 hover:text-gray-600 mb-4 block">
          ← Görevlerime Dön
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-1">{task.title}</h2>
        <p className="text-sm text-gray-400 mb-6">
          {task.equipment_name}{task.location ? ` · ${task.location}` : ''}
        </p>

        {/* Bilgi Kartları */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-xs text-amber-400 font-medium mb-1">Bakım Tarihi</p>
            <p className="text-sm font-bold text-amber-700">{today}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 font-medium mb-1">Sonraki Bakım</p>
            <p className="text-sm font-bold text-gray-700">{fmt(nextDate)}</p>
          </div>
          {task.description && (
            <div className="col-span-2 bg-yellow-50 rounded-xl p-4">
              <p className="text-xs text-yellow-600 font-medium mb-1">Bakım Talimatı</p>
              <p className="text-sm text-yellow-800">{task.description}</p>
            </div>
          )}
        </div>

        {isAlreadyDone ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <p className="text-green-700 font-medium">Bu görev tamamlandı</p>
            {task.performed_work && (
              <div className="mt-3 text-left text-sm text-green-800">
                <p className="font-medium">Yapılan İşlem:</p>
                <p>{task.performed_work}</p>
                {task.maintained_by && <>
                  <p className="font-medium mt-2">Bakımı Yapan:</p>
                  <p>{task.maintained_by}</p>
                </>}
                {task.responsible_person && <>
                  <p className="font-medium mt-2">Sorumlu Kişi:</p>
                  <p>{task.responsible_person}</p>
                </>}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-600">Bakım Raporu</h3>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yapılan İşlemler <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={form.performed_work}
                onChange={e => setForm(f => ({ ...f, performed_work: e.target.value }))}
                placeholder="Yapılan bakım, kontrol ve onarım işlemlerini yazın..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bakımı Yapan Kişi/Firma <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.maintained_by}
                  onChange={e => setForm(f => ({ ...f, maintained_by: e.target.value }))}
                  placeholder="Teknisyen adı veya firma"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sorumlu Personel <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.responsible_person}
                  onChange={e => setForm(f => ({ ...f, responsible_person: e.target.value }))}
                  placeholder="İlgilenen otel çalışanı"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Kaydediliyor...' : 'Onayla'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
