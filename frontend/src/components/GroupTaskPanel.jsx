import { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const STATUS_DOT = {
  overdue:    'bg-red-500',
  in_progress: 'bg-blue-500',
  pending:    'bg-amber-500',
  postponed:  'bg-orange-400',
  completed:  'bg-emerald-500',
};

const STATUS_PRIORITY = { overdue: 0, in_progress: 1, postponed: 2, pending: 3 };

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function emptyForm() {
  return {
    performed_work: '',
    maintained_by: '',
    responsible_person: '',
    performed_date: new Date().toISOString().split('T')[0],
  };
}

function isValid(f) {
  return !!(f?.performed_work?.trim() && f?.maintained_by?.trim() && f?.responsible_person?.trim());
}

export default function GroupTaskPanel({ tasks, onCompleted }) {
  const toast = useToast();

  const sorted = [...(tasks || [])].sort((a, b) => {
    const ap = STATUS_PRIORITY[a.status] ?? 5;
    const bp = STATUS_PRIORITY[b.status] ?? 5;
    return ap - bp;
  });

  const [activeIdx, setActiveIdx] = useState(0);
  const [forms, setForms] = useState(() => {
    const m = {};
    for (const t of sorted) m[t.id] = emptyForm();
    return m;
  });
  const [results, setResults] = useState({}); // taskId → 'success' | { error: string }
  const [submitting, setSubmitting] = useState(false);

  if (!sorted.length) return null;

  const active = sorted[Math.min(activeIdx, sorted.length - 1)];

  function isDone(t) {
    return ['completed', 'skipped'].includes(t.status) || results[t.id] === 'success';
  }

  const pendingTasks = sorted.filter(t => !isDone(t));
  const filledCount = pendingTasks.filter(t => isValid(forms[t.id])).length;

  function updateForm(taskId, field, value) {
    setForms(prev => ({ ...prev, [taskId]: { ...(prev[taskId] || emptyForm()), [field]: value } }));
  }

  async function handleGroupComplete() {
    if (filledCount === 0) return;
    setSubmitting(true);
    const newResults = { ...results };
    let successCount = 0;

    for (const t of sorted) {
      if (isDone(t)) continue;
      const f = forms[t.id];
      if (!isValid(f)) {
        // doldurulmamış sekmeler atlanır
        continue;
      }
      try {
        await api.put(`/tasks/${t.id}/status`, {
          status: 'completed',
          performed_work: f.performed_work,
          maintained_by: f.maintained_by,
          responsible_person: f.responsible_person,
          performed_date: f.performed_date,
        });
        newResults[t.id] = 'success';
        successCount++;
      } catch (err) {
        newResults[t.id] = { error: err.response?.data?.error || 'Hata oluştu' };
      }
    }

    setResults(newResults);
    setSubmitting(false);

    if (successCount > 0) {
      toast?.success(`${successCount} bakım tamamlandı`);
      onCompleted?.();
    }
    const firstError = Object.values(newResults).find(r => r?.error);
    if (firstError) toast?.error(firstError.error);
  }

  return (
    <div>
      {/* Sekme çubuğu */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {sorted.map((t, i) => {
          const done = isDone(t);
          const hasError = results[t.id]?.error;
          const filled = !done && !hasError && isValid(forms[t.id]);

          let dot = STATUS_DOT[t.status] || 'bg-slate-300';
          if (done) dot = 'bg-emerald-500';
          else if (hasError) dot = 'bg-red-500';
          else if (filled) dot = 'bg-emerald-400';

          const isActive = activeIdx === i;
          return (
            <button
              key={t.id}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors border ${
                isActive
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              <span className="truncate max-w-[110px]">{t.equipment_name}</span>
              {done && <span className="text-emerald-600 text-[10px] font-bold">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Aktif sekme içeriği */}
      <TabContent
        task={active}
        form={forms[active.id] || emptyForm()}
        result={results[active.id]}
        isDone={isDone(active)}
        onChange={(field, val) => updateForm(active.id, field, val)}
      />

      {/* Grubu Tamamla */}
      {pendingTasks.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          {filledCount < pendingTasks.length && filledCount > 0 && (
            <p className="text-xs text-slate-400 text-center mb-2">
              {pendingTasks.length - filledCount} sekme boş — doldurulmayan birimler beklemede kalır
            </p>
          )}
          <button
            onClick={handleGroupComplete}
            disabled={submitting || filledCount === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Kaydediliyor...'
              : filledCount > 0
              ? `✓ Grubu Tamamla  (${filledCount}/${pendingTasks.length} birim hazır)`
              : 'Zorunlu alanları doldurun'}
          </button>
        </div>
      )}

      {pendingTasks.length === 0 && (
        <div className="mt-4 py-3 bg-emerald-50 rounded-xl text-center text-emerald-700 text-sm font-medium">
          ✓ Tüm birimler tamamlandı
        </div>
      )}
    </div>
  );
}

function TabContent({ task, form, result, isDone, onChange }) {
  const alreadyDone = ['completed', 'skipped'].includes(task.status);
  const justDone = result === 'success';
  const hasError = result?.error;

  const isFutureMonth = (() => {
    if (!task.scheduled_date) return false;
    const sd = new Date(task.scheduled_date);
    const now = new Date();
    return sd.getFullYear() * 12 + sd.getMonth() > now.getFullYear() * 12 + now.getMonth();
  })();

  return (
    <div className="space-y-4">
      {/* Ekipman bilgisi */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
        <div>
          <p className="text-gray-400 text-xs mb-0.5">Ekipman / Konum</p>
          <p className="font-semibold text-gray-800">
            {task.equipment_name}{task.location ? ` · ${task.location}` : ''}
          </p>
        </div>
        {task.description && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-yellow-600 font-medium mb-1">Bakım Talimatı</p>
            <p className="text-yellow-800 text-xs">{task.description}</p>
          </div>
        )}
      </div>

      <div className="bg-amber-50 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-400 font-medium mb-0.5">Vade</p>
        <p className="text-sm font-bold text-amber-700">{fmt(task.scheduled_date)}</p>
      </div>

      {/* Tamamlandı görünümü */}
      {(alreadyDone || justDone) ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-medium text-center mb-3">✓ Bakım Tamamlandı</p>
          <div className="text-sm text-green-800 space-y-1.5">
            {alreadyDone && task.completed_at && (
              <div><p className="text-xs font-medium text-green-600">Tarih:</p><p>{fmt(task.completed_at)}</p></div>
            )}
            {(alreadyDone ? task.performed_work : form.performed_work) && (
              <div>
                <p className="text-xs font-medium text-green-600">Yapılan İşlem:</p>
                <p>{alreadyDone ? task.performed_work : form.performed_work}</p>
              </div>
            )}
            {(alreadyDone ? task.maintained_by : form.maintained_by) && (
              <div>
                <p className="text-xs font-medium text-green-600">Bakımı Yapan:</p>
                <p>{alreadyDone ? task.maintained_by : form.maintained_by}</p>
              </div>
            )}
            {(alreadyDone ? task.responsible_person : form.responsible_person) && (
              <div>
                <p className="text-xs font-medium text-green-600">Sorumlu:</p>
                <p>{alreadyDone ? task.responsible_person : form.responsible_person}</p>
              </div>
            )}
          </div>
        </div>
      ) : hasError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <p className="font-medium mb-1">Hata oluştu:</p>
          <p>{result.error}</p>
          <p className="text-xs mt-2 text-red-500">Formu tekrar doldurup "Grubu Tamamla"ya basın.</p>
        </div>
      ) : isFutureMonth ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <p className="text-blue-700 font-semibold text-sm mb-1">Bu bakımın zamanı henüz gelmedi</p>
          <p className="text-blue-600 text-xs">Bakım, vadesinin geldiği ay içinde yapılabilir.</p>
        </div>
      ) : (
        /* Form */
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">Bakım Raporu</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yapılan İşlemler <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={form.performed_work}
              onChange={e => onChange('performed_work', e.target.value)}
              placeholder="Yapılan bakım ve kontrol işlemlerini yazın..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bakımı Yapan Kişi/Firma <span className="text-red-500">*</span>
            </label>
            <input
              list={`maintainer-list-${task.id}`}
              value={form.maintained_by}
              onChange={e => onChange('maintained_by', e.target.value)}
              placeholder="Teknisyen adı veya firma"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <datalist id={`maintainer-list-${task.id}`}>
              {['FORM AŞ', 'ISIEVİ'].map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Kişi <span className="text-red-500">*</span>
            </label>
            <input
              value={form.responsible_person}
              onChange={e => onChange('responsible_person', e.target.value)}
              placeholder="İşin başında duran otel çalışanı"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bakımın Yapıldığı Tarih
            </label>
            <input
              type="date"
              value={form.performed_date}
              onChange={e => onChange('performed_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
