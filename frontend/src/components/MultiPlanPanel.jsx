import { useState } from 'react';
import { CheckCircle2, Pencil, X, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STATUS_CLS   = { overdue: 'bg-red-100 text-red-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-amber-100 text-amber-700', postponed: 'bg-orange-100 text-orange-700' };
const STATUS_LABEL = { overdue: 'Gecikmiş', in_progress: 'Devam Ediyor', pending: 'Bekliyor', postponed: 'Ertelendi' };
const FREQ_LABELS  = { monthly: 'Aylık', quarterly: '3 Aylık', semiannual: '6 Aylık', yearly: 'Yıllık', custom: 'Özel' };
const FREQ_OPTIONS = [
  { value: 'monthly',   label: 'Aylık' },
  { value: 'quarterly', label: '3 Aylık' },
  { value: 'semiannual',label: '6 Aylık' },
  { value: 'yearly',    label: 'Yıllık' },
  { value: 'custom',    label: 'Özel (gün sayısı gir)' },
];
const MONTH_BASED = ['monthly', 'quarterly', 'semiannual', 'yearly'];
const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const fieldCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white';

export default function MultiPlanPanel({ plans, onRefresh }) {
  const toast = useToast();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  if (!plans?.length) return null;

  const first = plans[0];
  const doneCount    = plans.filter(p => p.this_month_completed_at).length;
  const pendingCount = plans.filter(p => p.this_month_has_pending && !p.this_month_completed_at).length;
  const overdueCount = plans.filter(p => p.current_task_status === 'overdue').length;

  function startEdit() {
    setForm({
      title:          first.title || '',
      description:    first.description || '',
      frequency_type: first.frequency_type || 'monthly',
      frequency_days: first.frequency_days || '',
      target_month:   first.target_month ? String(first.target_month) : '',
      is_active:      first.is_active !== false,
    });
    setEditMode(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { toast?.error('Plan başlığı zorunlu'); return; }
    setSaving(true);
    try {
      await api.put(`/plans/${first.id}`, {
        equipment_id:   first.equipment_id,
        title:          form.title,
        description:    form.description,
        frequency_type: form.frequency_type,
        frequency_days: form.frequency_type === 'custom' ? (form.frequency_days || null) : null,
        advance_notice_days: 3,
        is_active:      form.is_active,
        target_month:   MONTH_BASED.includes(form.frequency_type) && form.target_month
                          ? Number(form.target_month) : null,
      });
      toast?.success(`Plan güncellendi — tüm ${plans.length} birime uygulandı`);
      setEditMode(false);
      onRefresh?.();
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  /* ── DÜZENLEME MODU ── */
  if (editMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Planı Düzenle</p>
          <button onClick={() => setEditMode(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
          Değişiklikler <strong>tüm {plans.length} birime</strong> uygulanacak.
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan Başlığı *</label>
          <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className={fieldCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
          <textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className={fieldCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Periyot *</label>
          <select value={form.frequency_type} onChange={e => setForm(f => ({...f, frequency_type: e.target.value, target_month: ''}))} className={fieldCls}>
            {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {form.frequency_type === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gün Sayısı *</label>
            <input type="number" min="1" value={form.frequency_days} onChange={e => setForm(f => ({...f, frequency_days: e.target.value}))} className={fieldCls} />
          </div>
        )}

        {MONTH_BASED.includes(form.frequency_type) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bakım Ayı</label>
            <select value={form.target_month} onChange={e => setForm(f => ({...f, target_month: e.target.value}))} className={fieldCls}>
              <option value="">Seçin</option>
              {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} className="w-4 h-4 rounded accent-amber-500" />
          <label htmlFor="is_active" className="text-sm text-gray-700">Plan aktif</label>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button onClick={() => setEditMode(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors">
            İptal
          </button>
        </div>
      </div>
    );
  }

  /* ── GÖRÜNTÜLEME MODU ── */
  return (
    <div className="space-y-4">
      {/* Başlık + düzenle */}
      <div className="flex items-start justify-between gap-2">
        <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm flex-1">
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
        <button onClick={startEdit}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded-xl transition-colors flex-shrink-0">
          <Pencil size={12} />
          Düzenle
        </button>
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
