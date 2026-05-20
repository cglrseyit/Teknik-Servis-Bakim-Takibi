import { useState, useRef } from 'react';
import { Loader2, Paperclip, X, Calendar, FileText, User, Briefcase, ClipboardList, StickyNote, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import DayPicker from './DayPicker';

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';

const FREQ_OPTIONS = [
  { value: 'monthly', label: 'Aylık' },
  { value: 'quarterly', label: '3 Aylık' },
  { value: 'semiannual', label: '6 Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HistoricalRecordPanel({ equipmentId, equipmentName, unitCount = 0, hasActivePlan = false, onCreated }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    scheduled_date: '',
    title: '',
    maintained_by: '',
    responsible_person: '',
    performed_work: '',
    notes: '',
  });
  const [frequencyType, setFrequencyType] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleFilesPicked(e) {
    const picked = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...picked]);
    e.target.value = '';
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!form.scheduled_date || !form.title.trim() || !form.maintained_by.trim() || !form.responsible_person.trim()) {
      toast?.error('Tarih, başlık, bakımı yapan ve sorumlu kişi zorunlu');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('equipment_id', String(equipmentId));
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (!hasActivePlan && frequencyType) fd.append('frequency_type', frequencyType);
      files.forEach(f => fd.append('files', f));

      const { data } = await api.post('/tasks/historical', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const unitMsg = data.unit_count > 1
        ? `Geçmiş bakım kaydı ${data.unit_count} birime eklendi`
        : 'Geçmiş bakım kaydı eklendi';
      toast?.success(data.plans_created > 0 ? `${unitMsg} · bakım planı oluşturuldu` : unitMsg);
      onCreated?.();
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Kayıt oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <strong className="text-slate-700">{equipmentName}</strong> için geçmiş bir bakım kaydı oluştur. Belgeleri sonradan da ekleyebilirsin.
        {unitCount > 0 && (
          <span className="block mt-1.5 text-violet-700">
            <strong>Not:</strong> Bu bir grup ekipman — kayıt <strong>{unitCount} birime</strong> birden uygulanır, dosyalar tüm birimlere bağlanır.
          </span>
        )}
      </p>

      <Field icon={Calendar} label="Bakım Tarihi *">
        <DayPicker
          value={form.scheduled_date}
          onChange={v => update('scheduled_date', v)}
          max={todayStr()}
          placeholder="Bakımın yapıldığı tarihi seç"
        />
      </Field>

      <Field icon={FileText} label="Bakım Başlığı *">
        <input
          type="text"
          required
          placeholder="örn: Yıllık Bakım, Kompresör Değişimi"
          value={form.title}
          onChange={e => update('title', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
        />
      </Field>

      <Field icon={Briefcase} label="Bakımı Yapan *">
        <input
          type="text"
          required
          placeholder="Firma veya teknisyen adı"
          value={form.maintained_by}
          onChange={e => update('maintained_by', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
        />
      </Field>

      <Field icon={User} label="Sorumlu Kişi *">
        <input
          type="text"
          required
          placeholder="Otel tarafı sorumlu"
          value={form.responsible_person}
          onChange={e => update('responsible_person', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
        />
      </Field>

      <Field icon={ClipboardList} label="Yapılan İşlem">
        <textarea
          rows={3}
          placeholder="Açıklama (opsiyonel)"
          value={form.performed_work}
          onChange={e => update('performed_work', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 resize-y"
        />
      </Field>

      <Field icon={StickyNote} label="Notlar">
        <textarea
          rows={2}
          placeholder="Notlar (opsiyonel)"
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 resize-y"
        />
      </Field>

      {!hasActivePlan && (
        <Field icon={RefreshCw} label="Bakım Periyodu (opsiyonel)">
          <select
            value={frequencyType}
            onChange={e => setFrequencyType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 bg-white"
          >
            <option value="">Plan oluşturma</option>
            {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {frequencyType && (
            <p className="text-[11px] text-slate-500 mt-1.5 bg-amber-50/70 border border-amber-100 rounded px-2 py-1.5">
              Bu kaydın tarihinden itibaren <strong>{FREQ_OPTIONS.find(o => o.value === frequencyType)?.label.toLowerCase()}</strong> periyotla otomatik bakım planı oluşturulacak; gelecek görevler planlanacak.
            </p>
          )}
        </Field>
      )}

      <Field icon={Paperclip} label="Belgeler (opsiyonel)">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          onChange={handleFilesPicked}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Paperclip size={13} className="inline mr-1.5 text-slate-400" />
          Dosya seç ({files.length} dosya)
        </button>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-50 rounded text-xs">
                <span className="truncate text-slate-700">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="p-1 text-slate-400 hover:text-red-500"
                  aria-label="Kaldır"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-amber-600/20"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
          {submitting ? 'Kaydediliyor...' : 'Geçmiş Kayıt Oluştur'}
        </button>
      </div>
    </form>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
        <Icon size={12} className="text-slate-400" />
        {label}
      </label>
      {children}
    </div>
  );
}
