import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import ConfirmModal from './ConfirmModal';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xs font-medium text-gray-700 mt-0.5">{value}</p>
    </div>
  );
}

const MAINTAINER_SUGGESTIONS = ['FORM AŞ', 'ISIEVİ'];

export default function TaskDetailPanel({ taskId, onCompleted }) {
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [nextDate, setNextDate] = useState(null);
  const [form, setForm] = useState({
    performed_work: '',
    maintained_by: '',
    responsible_person: '',
    performed_date: new Date().toISOString().split('T')[0],
    approved_by_manager: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPostponeConfirm, setShowPostponeConfirm] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setTask(null);
    setNextDate(null);
    setForm({
      performed_work: '', maintained_by: '', responsible_person: '',
      performed_date: new Date().toISOString().split('T')[0],
      approved_by_manager: false,
    });
    setError('');

    api.get(`/tasks/${taskId}`).then(async r => {
      setTask(r.data);
      if (r.data.plan_id) {
        try {
          const after = r.data.scheduled_date?.split('T')[0];
          const url = after
            ? `/plans/${r.data.plan_id}?after=${after}`
            : `/plans/${r.data.plan_id}`;
          const plan = await api.get(url);
          setNextDate(plan.data.next_scheduled_date);
        } catch {}
      }
    }).catch(() => {});
  }, [taskId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.performed_work.trim()) { setError('Yapılan işlemleri yazmanız zorunludur'); return; }
    if (!form.maintained_by.trim()) { setError('Bakımı yapan kişi/firma zorunludur'); return; }
    if (!form.responsible_person.trim()) { setError('Sorumlu kişi zorunludur'); return; }
    setLoading(true);
    setError('');
    try {
      await api.put(`/tasks/${taskId}/status`, {
        status: 'completed',
        performed_work: form.performed_work,
        maintained_by: form.maintained_by,
        responsible_person: form.responsible_person,
        performed_date: form.performed_date,
        approved_by_manager: form.approved_by_manager,
      });
      toast?.success('Görev başarıyla tamamlandı');
      onCompleted?.();
    } catch (err) {
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function doPostpone() {
    setShowPostponeConfirm(false);
    setLoading(true);
    try {
      await api.put(`/tasks/${taskId}/status`, { status: 'postponed' });
      toast?.success('Görev ertelendi');
      onCompleted?.();
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  if (!task) return <div className="text-gray-400 text-sm text-center py-10">Yükleniyor...</div>;

  const isAlreadyDone = ['completed', 'skipped'].includes(task.status);
  const isPostponed = task.status === 'postponed';
  const hasEquipmentDetails = task.brand || task.model || task.serial_number || task.category;

  const isFutureMonth = (() => {
    if (!task.scheduled_date) return false;
    const sd = new Date(task.scheduled_date);
    const now = new Date();
    return sd.getFullYear() * 12 + sd.getMonth() > now.getFullYear() * 12 + now.getMonth();
  })();

  return (
    <div className="space-y-4">
      {/* Ekipman bilgisi */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-3">
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Ekipman / Konum</p>
          <p className="font-semibold text-gray-800">
            {task.equipment_name}{task.location ? ` · ${task.location}` : ''}
          </p>
        </div>

        {hasEquipmentDetails && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-gray-200">
            <InfoRow label="Marka" value={task.brand} />
            <InfoRow label="Model" value={task.model} />
            <InfoRow label="Seri No" value={task.serial_number} />
            <InfoRow label="Kategori" value={task.category} />
          </div>
        )}

        {task.description && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-yellow-600 font-medium mb-1">Bakım Talimatı</p>
            <p className="text-yellow-800 text-xs">{task.description}</p>
          </div>
        )}
      </div>

      {/* Tarih bilgileri */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-400 font-medium mb-1">Vade (Ay Sonu)</p>
          <p className="text-sm font-bold text-amber-700">{fmt(task.scheduled_date)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Sonraki Bakım</p>
          <p className="text-sm font-bold text-gray-700">{fmt(nextDate)}</p>
        </div>
      </div>

      {isPostponed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-700 font-medium text-sm mb-1">Bu görev ertelendi</p>
          <p className="text-amber-500 text-xs">Bakımı tamamlamak için aşağıdaki formu doldurun.</p>
        </div>
      )}

      {isFutureMonth && !isAlreadyDone ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <p className="text-blue-700 font-semibold text-sm mb-1">Bu bakımın zamanı henüz gelmedi</p>
          <p className="text-blue-600 text-xs">Bakım, vadesinin geldiği ay içinde gerçekleştirilebilir.</p>
        </div>
      ) : isAlreadyDone ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="text-green-700 font-medium text-center mb-3">Bu görev tamamlandı</p>
          {task.performed_work && (
            <div className="text-sm text-green-800 space-y-2">
              {task.completed_at && <div><p className="font-medium">Bakım Tarihi:</p><p>{fmt(task.completed_at)}</p></div>}
              <div><p className="font-medium">Yapılan İşlem:</p><p>{task.performed_work}</p></div>
              {task.maintained_by && <div><p className="font-medium">Bakımı Yapan:</p><p>{task.maintained_by}</p></div>}
              {task.responsible_person && <div><p className="font-medium">Sorumlu Kişi:</p><p>{task.responsible_person}</p></div>}
              {task.approved_by_manager && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-green-200 mt-2">
                  <span className="text-green-600 text-xs font-semibold">✓ Teknik Müdür tarafından onaylandı</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm font-semibold text-gray-600">Bakım Raporu</p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yapılan İşlemler <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={form.performed_work}
              onChange={e => setForm(f => ({ ...f, performed_work: e.target.value }))}
              placeholder="Yapılan bakım, kontrol ve onarım işlemlerini yazın..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bakımı Yapan Kişi/Firma <span className="text-red-500">*</span>
            </label>
            <input
              list="maintainer-list"
              value={form.maintained_by}
              onChange={e => setForm(f => ({ ...f, maintained_by: e.target.value }))}
              placeholder="Dışarıdan gelen teknisyen adı veya firma"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <datalist id="maintainer-list">
              {MAINTAINER_SUGGESTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Kişi <span className="text-red-500">*</span>
            </label>
            <input
              value={form.responsible_person}
              onChange={e => setForm(f => ({ ...f, responsible_person: e.target.value }))}
              placeholder="İşin başında duran otel çalışanı"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bakımın Yapıldığı Tarih <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.performed_date}
              onChange={e => setForm(f => ({ ...f, performed_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Teknik Müdür Onayı */}
          <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="approved_by_manager"
              checked={form.approved_by_manager}
              onChange={e => setForm(f => ({ ...f, approved_by_manager: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 accent-amber-600"
            />
            <label htmlFor="approved_by_manager" className="text-sm text-gray-700 cursor-pointer select-none">
              Teknik Müdür tarafından onaylandı
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Kaydediliyor...' : '✓ Tamamlandı'}
            </button>
            <button
              type="button"
              onClick={() => setShowPostponeConfirm(true)}
              disabled={loading}
              className="px-4 py-3 bg-amber-50 text-amber-600 font-semibold rounded-xl hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-60 text-sm"
            >
              Ertele
            </button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={showPostponeConfirm}
        title="Görevi ertelemek istiyor musunuz?"
        message="Görev 'Ertelendi' durumuna geçecek ve daha sonra tamamlanabilecek."
        confirmLabel="Evet, Ertele"
        variant="warning"
        onConfirm={doPostpone}
        onCancel={() => setShowPostponeConfirm(false)}
      />
    </div>
  );
}
