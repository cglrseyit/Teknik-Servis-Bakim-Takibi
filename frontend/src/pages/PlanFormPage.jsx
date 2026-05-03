import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { RefreshCw, Zap } from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Günlük' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
  { value: 'quarterly', label: '3 Aylık' },
  { value: 'semiannual', label: '6 Aylık' },
  { value: 'yearly', label: 'Yıllık' },
  { value: 'custom', label: 'Özel (gün sayısı gir)' },
];

const MONTH_BASED_FREQS = ['quarterly', 'semiannual', 'yearly'];

export default function PlanFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [equipment, setEquipment] = useState([]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOneTime, setIsOneTime] = useState(false);
  const [form, setForm] = useState({
    equipment_id: searchParams.get('equipment_id') || '',
    title: '', description: '',
    frequency_type: 'monthly', frequency_days: '',
    advance_notice_days: '3',
    start_date: '',
    target_month: '',
  });

  useEffect(() => {
    api.get('/equipment').then(r => setEquipment(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/plans/${id}`).then(r => {
      const p = r.data;
      setIsOneTime(p.is_one_time || false);
      setForm({
        equipment_id: String(p.equipment_id),
        title: p.title || '',
        description: p.description || '',
        frequency_type: p.frequency_type || 'monthly',
        frequency_days: p.frequency_days || '',
        advance_notice_days: String(p.advance_notice_days ?? 3),
        start_date: p.start_date ? String(p.start_date).split('T')[0].slice(0, 7) : '',
        target_month: p.target_month ? String(p.target_month) : '',
      });
    }).catch(() => {});
  }, [id, isEdit]);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api.delete(`/plans/${id}`);
      toast?.success('Plan silindi');
      navigate('/plans');
    } catch {
      toast?.error('Silme başarısız');
      setDeleting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      // Convert "YYYY-MM" month picker value to first day of that month for the API
      const payload = { ...form, is_one_time: isOneTime };
      if (form.start_date && form.start_date.length === 7) {
        payload.start_date = form.start_date + '-01';
      }
      const usesTargetMonth = !isOneTime && MONTH_BASED_FREQS.includes(form.frequency_type);
      payload.target_month = (usesTargetMonth && form.target_month)
        ? Number(form.target_month) : null;
      // Ay-bazli periyotlarda (3/6 aylik, yillik) start_date'i target_month'tan otomatik turet
      if (usesTargetMonth && form.target_month) {
        const tm = Number(form.target_month);
        const now = new Date();
        const year = tm > now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
        payload.start_date = `${year}-${String(tm).padStart(2, '0')}-01`;
      }
      if (isEdit) {
        await api.put(`/plans/${id}`, payload);
        toast?.success('Plan güncellendi');
      } else {
        await api.post('/plans', payload);
        toast?.success(isOneTime ? 'Görev oluşturuldu' : 'Bakım planı oluşturuldu');
      }
      navigate('/plans');
    } catch (err) {
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    }
  }

  const fieldCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white";

  return (
    <Layout>
      <div className="max-w-xl">
        <h2 className="text-xl font-bold text-gray-800 mb-6">
          {isEdit ? 'Bakım Planını Düzenle' : 'Yeni Bakım Planı'}
        </h2>

        {/* Plan Tipi Toggle — edit modunda kilitli */}
        <div className={`flex gap-3 mb-6 ${isEdit ? 'opacity-50 pointer-events-none' : ''}`}>
          <button
            type="button"
            onClick={() => setIsOneTime(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              !isOneTime
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <RefreshCw size={15} />
            Periyodik Bakım
          </button>
          <button
            type="button"
            onClick={() => setIsOneTime(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              isOneTime
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <Zap size={15} />
            Tek Seferlik / Arıza
          </button>
        </div>

        {isOneTime && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg">
            Tek seferlik görev — tamamlandığında yeni tarih atanmaz, plan otomatik kapanır.
          </div>
        )}

        {isEdit && !isOneTime && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs rounded-lg">
            Periyot veya başlangıç tarihi değiştirilirse mevcut bekleyen görevler silinip yeni periyoda göre yeniden oluşturulur.
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ekipman *</label>
            <select required value={form.equipment_id} onChange={set('equipment_id')} className={fieldCls}>
              <option value="">Seçin</option>
              {equipment.map(e => {
                // Yeni periyodik plan olusturulurken, periyodik plani olan ekipmanlar secilemez
                const blocked = !isEdit && !isOneTime && e.has_periodic_plan;
                return (
                  <option key={e.id} value={e.id} disabled={blocked}>
                    {e.name}{blocked ? ' (zaten bakım planı var)' : ''}
                  </option>
                );
              })}
            </select>
            {!isEdit && !isOneTime && (
              <p className="text-xs text-gray-400 mt-1">Bir ekipman aynı anda yalnızca bir periyodik bakım planına sahip olabilir</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isOneTime ? 'Arıza / Görev Başlığı *' : 'Plan Başlığı *'}
            </label>
            <input
              required
              value={form.title}
              onChange={set('title')}
              placeholder={isOneTime ? 'örn: Klima Arıza Tamiri' : 'örn: Aylık Filtre Değişimi'}
              className={fieldCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea value={form.description} onChange={set('description')} rows={2} className={fieldCls} />
          </div>

          {!isOneTime && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periyot *</label>
                <select required value={form.frequency_type} onChange={set('frequency_type')} className={fieldCls}>
                  {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {form.frequency_type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gün Sayısı *</label>
                  <input type="number" min="1" required value={form.frequency_days} onChange={set('frequency_days')} className={fieldCls} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uyarı Süresi (gün)</label>
                <input type="number" min="0" max="30" value={form.advance_notice_days} onChange={set('advance_notice_days')} className={fieldCls} />
              </div>
            </div>
          )}

          {!isOneTime && MONTH_BASED_FREQS.includes(form.frequency_type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bakım Ayı *</label>
              <select required value={form.target_month} onChange={set('target_month')} className={fieldCls}>
                <option value="">Seçin</option>
                {['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'].map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {form.frequency_type === 'yearly'
                  ? 'Her yıl bu ayın son gününe otomatik görev atanır'
                  : form.frequency_type === 'semiannual'
                    ? 'İlk bakım bu ayda, sonraki 6 ay arayla devam eder'
                    : 'İlk bakım bu ayda, sonraki 3 ay arayla devam eder'}
              </p>
            </div>
          )}

          {(isOneTime || !MONTH_BASED_FREQS.includes(form.frequency_type)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isOneTime ? 'Görev Ayı *' : isEdit ? 'Referans Ayı *' : 'İlk Bakım Ayı *'}
              </label>
              <input required type="month" value={form.start_date} onChange={set('start_date')} className={fieldCls} />
              <p className="text-xs text-gray-400 mt-1">Ay seçin — görev o ayın son gününe atanır</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className={`px-5 py-2 text-white text-sm rounded-lg font-semibold transition-colors ${
                isOneTime ? 'bg-orange-500 hover:bg-orange-600' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isEdit ? 'Değişiklikleri Kaydet' : isOneTime ? 'Görevi Oluştur' : 'Planı Oluştur'}
            </button>
            <button type="button" onClick={() => navigate('/plans')} className="px-5 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              İptal
            </button>
          </div>

          {isEdit && (
            <div className="pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="px-4 py-2 text-red-600 text-sm font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Planı Sil'}
              </button>
            </div>
          )}
        </form>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title="Planı silmek istiyor musunuz?"
        message="Bu plan ve bağlı tüm bekleyen görevler kalıcı olarak silinecek."
        confirmLabel="Evet, Sil"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Layout>
  );
}
