import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { RefreshCw, Zap } from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const FREQ_OPTIONS = [
  { value: 'monthly', label: 'Aylık' },
  { value: 'quarterly', label: '3 Aylık' },
  { value: 'semiannual', label: '6 Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];

const MONTH_BASED_FREQS = ['monthly', 'quarterly', 'semiannual', 'yearly'];

export default function PlanFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [equipment, setEquipment] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null); // edit modunda grup planı bilgisi
  const [originalForm, setOriginalForm] = useState(null); // edit modunda orijinal değerler
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [isOneTime, setIsOneTime] = useState(false);
  const [form, setForm] = useState({
    equipment_id: searchParams.get('equipment_id') || '',
    title: '', description: '',
    frequency_type: 'monthly', frequency_days: '',
    start_date: '',
    target_month: '',
    target_day: '',
  });

  useEffect(() => {
    api.get('/equipment').then(r => setEquipment(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/plans/${id}`).then(r => {
      const p = r.data;
      setIsOneTime(p.is_one_time || false);
      const sd = p.start_date ? String(p.start_date).split('T')[0] : '';
      setForm({
        equipment_id: String(p.equipment_id),
        title: p.title || '',
        description: p.description || '',
        frequency_type: p.frequency_type || 'monthly',
        frequency_days: p.frequency_days || '',
        start_date: p.frequency_type === 'custom' ? sd : sd.slice(0, 7),
        target_month: p.target_month ? String(p.target_month) : '',
        target_day: p.target_day ? String(p.target_day) : '',
      });
      setOriginalForm({
        frequency_type: p.frequency_type || 'monthly',
        target_month: p.target_month ? String(p.target_month) : '',
      });
      if (p.parent_equipment_id) {
        setGroupInfo({ parentName: p.parent_equipment_name, equipmentName: p.equipment_name });
      }
    }).catch(() => {});
  }, [id, isEdit]);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const url = groupInfo ? `/plans/${id}?deleteGroup=true` : `/plans/${id}`;
      await api.delete(url);
      toast?.success(groupInfo ? 'Gruptaki tüm planlar silindi' : 'Plan silindi');
      navigate('/plans');
    } catch {
      toast?.error('Silme başarısız');
      setDeleting(false);
    }
  }

  function buildPayload(extra = {}) {
    const payload = { ...form, is_one_time: isOneTime, ...extra };
    if (form.start_date && form.start_date.length === 7) {
      payload.start_date = form.start_date + '-01';
    }
    const usesTargetMonth = !isOneTime && MONTH_BASED_FREQS.includes(form.frequency_type);
    payload.target_month = (usesTargetMonth && form.target_month) ? Number(form.target_month) : null;
    payload.target_day = (usesTargetMonth && form.target_day) ? Number(form.target_day) : null;
    if (usesTargetMonth && form.target_month) {
      const tm = Number(form.target_month);
      const td = Number(form.target_day) || 1;
      const now = new Date();
      const year = tm >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
      payload.start_date = `${year}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
    }
    return payload;
  }

  async function submitPlan(payload) {
    if (isEdit) {
      await api.put(`/plans/${id}`, payload);
      toast?.success('Plan güncellendi');
    } else {
      const res = await api.post('/plans', payload);
      const count = res.data?.count ?? 1;
      if (isOneTime) {
        toast?.success('Görev oluşturuldu');
      } else if (count > 1) {
        toast?.success(`${count} birim için bakım planı oluşturuldu`);
      } else {
        toast?.success('Bakım planı oluşturuldu');
      }
    }
    navigate('/plans');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // Edit modunda (periyodik plan) önce onay iste
    if (isEdit && !isOneTime) {
      setShowEditConfirm(true);
      return;
    }
    try {
      await submitPlan(buildPayload());
    } catch (err) {
      if (err.response?.status === 409) {
        setShowReplaceConfirm(true);
        return;
      }
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    }
  }

  async function handleConfirmedSave() {
    setShowEditConfirm(false);
    setError('');
    try {
      await submitPlan(buildPayload());
    } catch (err) {
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    }
  }

  async function handleForceSubmit() {
    setShowReplaceConfirm(false);
    setError('');
    try {
      await submitPlan(buildPayload({ force: true }));
    } catch (err) {
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    }
  }

  const fieldCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white";
  const selectedEquipment = equipment.find(e => String(e.id) === String(form.equipment_id));
  const unitCount = selectedEquipment?.unit_count || 0;

  // Edit modunda zorunluluk mantığı:
  // - Periyot değiştiyse → Bakım Ayı zorunlu
  // - Bakım Ayı seçildiyse → Periyot zorunlu (label için)
  const freqChanged = isEdit && originalForm !== null && form.frequency_type !== originalForm.frequency_type;
  const monthSelected = Boolean(form.target_month);
  const bakimAyiRequired = !isEdit || freqChanged;
  const periyotLabelRequired = !isEdit || monthSelected;

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
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


        {isEdit && groupInfo && (
          <div className="mb-4 p-3 bg-violet-50 border border-violet-200 text-violet-700 text-xs rounded-lg">
            <strong>"{groupInfo.parentName}"</strong> grubuna ait bir birim — değişiklikler gruptaki tüm birimlere uygulanacak.
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ekipman *</label>
            {isEdit && groupInfo ? (
              <div className={`${fieldCls} text-gray-500 cursor-default`}>
                {groupInfo.parentName}
              </div>
            ) : (
            <select required value={form.equipment_id} onChange={set('equipment_id')} className={fieldCls}>
              <option value="">Seçin</option>
              {equipment.map(e => {
                const hasplan = !isEdit && !isOneTime && e.has_periodic_plan;
                return (
                  <option key={e.id} value={e.id}>
                    {e.name}{hasplan ? ' (mevcut plan var)' : ''}
                  </option>
                );
              })}
            </select>
            )}
            {!isEdit && !isOneTime && unitCount > 0 && (
              <div className="mt-1.5 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
                Bu ekipmanın <strong>{unitCount} birimi</strong> var — her birim için otomatik olarak ayrı plan oluşturulacak.
              </div>
            )}
            {!isEdit && !isOneTime && unitCount === 0 && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Periyot {periyotLabelRequired ? '*' : ''}</label>
                <select value={form.frequency_type} onChange={set('frequency_type')} className={fieldCls}>
                  {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {!isOneTime && MONTH_BASED_FREQS.includes(form.frequency_type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bakım Tarihi {bakimAyiRequired ? '*' : ''}</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select required={bakimAyiRequired} value={form.target_day} onChange={set('target_day')} className={fieldCls}>
                    <option value="">Gün seçin</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Gün</p>
                </div>
                <div>
                  <select required={bakimAyiRequired} value={form.target_month} onChange={set('target_month')} className={fieldCls}>
                    <option value="">Ay seçin</option>
                    {['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'].map((m, i) => (
                      <option key={i+1} value={i+1}>{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Ay</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {form.frequency_type === 'yearly'
                  ? 'Her yıl bu tarihte bakım görevi oluşturulur'
                  : form.frequency_type === 'semiannual'
                    ? 'İlk bakım bu tarihte, sonraki 6 ay arayla devam eder'
                    : form.frequency_type === 'quarterly'
                      ? 'İlk bakım bu tarihte, sonraki 3 ay arayla devam eder'
                      : 'Her ay bu günde bakım görevi oluşturulur'}
              </p>
            </div>
          )}


          {isOneTime && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Görev Ayı *</label>
              <input required type="month" value={form.start_date} onChange={set('start_date')}
                min={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })()}
                className={fieldCls} />
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
        title={groupInfo ? 'Tüm grup planları silinecek' : 'Planı silmek istiyor musunuz?'}
        message={groupInfo
          ? `"${groupInfo.parentName}" grubundaki tüm birimlerin bakım planı silinecek.\n\nTamamlanmış bakımlarınız silinmez.`
          : 'Bu bakım planı ve bekleyen görevler silinecek.\n\nTamamlanmış bakımlarınız silinmez.'}
        confirmLabel="Evet, Sil"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmModal
        open={showReplaceConfirm}
        title="Mevcut bakım planı değiştirilecek"
        message={"Seçili ekipmanın mevcut bakım planı silinecek ve yeni plan oluşturulacak. Onaylıyor musunuz?\n\nBakım geçmişiniz silinmez."}
        confirmLabel="Evet, Değiştir"
        variant="warning"
        onConfirm={handleForceSubmit}
        onCancel={() => setShowReplaceConfirm(false)}
      />
      <ConfirmModal
        open={showEditConfirm}
        title="Bakım planı güncellenecek"
        message={"Değişiklikler kaydedilecek. Periyot veya tarih değiştirildiyse bekleyen görevler yeniden oluşturulacak.\n\nBakım geçmişiniz silinmez."}
        confirmLabel="Evet, Kaydet"
        variant="warning"
        onConfirm={handleConfirmedSave}
        onCancel={() => setShowEditConfirm(false)}
      />
    </Layout>
  );
}
