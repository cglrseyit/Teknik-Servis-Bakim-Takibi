import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, WrenchIcon, Clock, CalendarDays, ArrowLeft } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const STATUS_OPTIONS = [
  { value: 'active',      label: 'Aktif',   color: 'text-green-600',  bgColor: 'bg-green-50',  borderColor: 'border-green-500',  icon: CheckCircle2 },
  { value: 'maintenance', label: 'Bakımda', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500', icon: WrenchIcon   },
  { value: 'passive',     label: 'Pasif',   color: 'text-gray-500',   bgColor: 'bg-gray-50',   borderColor: 'border-gray-400',   icon: Clock        },
];

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const PERIOD_OPTIONS = [
  { value: 'monthly',   label: 'Aylık',    sub: 'Her ay' },
  { value: 'quarterly', label: '3 Aylık',  sub: 'Her 3 ayda bir' },
  { value: 'biannual',  label: '6 Aylık',  sub: 'Her 6 ayda bir' },
  { value: 'yearly',    label: '1 Yıllık', sub: 'Yılda bir kez' },
];

export default function EquipmentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);
  const [error, setError] = useState('');
  const [setupLater, setSetupLater] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isUnit, setIsUnit] = useState(false);
  const [form, setForm] = useState({
    name: '', brand: '', model: '', supplier: '',
    serial_number: '', location: '',
    status: 'active', notes: '', maintenance_period: '',
    maintenance_start_date: '',
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/equipment/${id}`).then(r => {
        const eq = r.data;
        setIsUnit(Boolean(eq.parent_id));
        setForm({
          name:               eq.name || '',
          brand:              eq.brand || '',
          model:              eq.model || '',
          supplier:           eq.supplier || '',
          serial_number:      eq.serial_number || '',
          location:           eq.location || '',
          status:             eq.status || 'active',
          notes:              eq.notes || '',
          maintenance_period: eq.maintenance_period || '',
        });
      }).catch(() => {});
    }
  }, [id, isEdit]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (isEdit) await api.put(`/equipment/${id}`, form);
      else        await api.post('/equipment', { ...form, quantity });
      toast?.success(isEdit ? 'Ekipman güncellendi' : 'Ekipman eklendi');
      navigate('/equipment');
    } catch (err) {
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    }
  }

  return (
    <Layout>
      <div className="p-6 overflow-auto min-h-full">
        <div className="max-w-4xl">

          {/* Başlık */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Geri Dön
            </button>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-amber-100 rounded-lg">
                <WrenchIcon className="w-5 h-5 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">
                {isEdit ? 'Ekipmanı Düzenle' : 'Yeni Ekipman'}
              </h1>
            </div>
            <p className="text-sm text-slate-400 ml-[52px]">
              {isEdit ? 'Ekipman bilgilerini güncelleyin' : 'Sisteme yeni bir ekipman kaydedin'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">

              {/* Ad + Adet */}
              <div className={`grid gap-4 ${!isEdit ? 'grid-cols-[1fr_auto]' : ''}`}>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                    Ekipman Adı <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="örn: Klima Santrali, Asansör No:2"
                  />
                </div>

                {!isEdit && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700">Adet</Label>
                    <div className="flex items-center gap-2 h-10">
                      <button
                        type="button"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center text-base"
                      >−</button>
                      <span className="w-8 text-center font-semibold text-slate-800">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(q => Math.min(100, q + 1))}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center text-base"
                      >+</button>
                    </div>
                    {quantity > 1 && (
                      <p className="text-[11px] text-amber-600 leading-tight">{form.name || 'Ekipman'} #1…#{quantity}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Tedarikçi */}
              <div className="space-y-1.5">
                <Label htmlFor="supplier" className="text-sm font-semibold text-slate-700">
                  Tedarikçi {!isUnit && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="supplier"
                  required={!isUnit}
                  value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                  placeholder="örn: ABC Teknik Ltd."
                />
              </div>

              {/* Marka + Model */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="brand" className="text-sm font-semibold text-slate-700">Marka</Label>
                  <Input
                    id="brand"
                    value={form.brand}
                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                    placeholder="örn: Carrier, Siemens"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model" className="text-sm font-semibold text-slate-700">Model</Label>
                  <Input
                    id="model"
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="örn: VRF-3000, LG-X12"
                  />
                </div>
              </div>

              {/* Seri No + Lokasyon */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="serial_number" className="text-sm font-semibold text-slate-700">Seri Numarası</Label>
                  <Input
                    id="serial_number"
                    value={form.serial_number}
                    onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    placeholder="örn: SN-20240101-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-sm font-semibold text-slate-700">Lokasyon</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="örn: 3. Kat, Teknik Oda"
                  />
                </div>
              </div>

              {/* Durum */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">
                  Durum <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {STATUS_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const selected = form.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, status: opt.value }))}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                          selected
                            ? `${opt.bgColor} ${opt.borderColor} shadow-sm`
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? opt.color : 'text-slate-400'}`} />
                        <span className={`font-medium text-sm ${selected ? opt.color : 'text-slate-600'}`}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notlar */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-sm font-semibold text-slate-700">Notlar</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ekipman hakkında önemli notlar..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Bakım Periyodu — birimde gizlenir */}
              {!isUnit && (
                <>
                  <div className="border-t border-slate-100 pt-5 space-y-1.5">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        Bakım Periyodu
                        {!isEdit && !setupLater && <span className="text-red-500">*</span>}
                      </Label>
                      {!isEdit && !setupLater && (
                        <button
                          type="button"
                          onClick={() => { setSetupLater(true); setForm(f => ({ ...f, maintenance_period: '', maintenance_start_date: '' })); }}
                          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
                        >
                          Daha sonra ayarla
                        </button>
                      )}
                    </div>

                    {!isEdit && setupLater ? (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
                        <span className="text-sm text-slate-500">Bakım planı daha sonra ayarlanacak</span>
                        <button
                          type="button"
                          onClick={() => setSetupLater(false)}
                          className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
                        >
                          Şimdi ayarla
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-3">
                          {PERIOD_OPTIONS.map(opt => {
                            const selected = form.maintenance_period === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, maintenance_period: opt.value }))}
                                className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                                  selected
                                    ? 'bg-amber-50 border-amber-500 shadow-sm'
                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <span className={`font-semibold text-sm ${selected ? 'text-amber-700' : 'text-slate-700'}`}>{opt.label}</span>
                                <span className={`text-xs ${selected ? 'text-amber-500' : 'text-slate-400'}`}>{opt.sub}</span>
                              </button>
                            );
                          })}
                        </div>

                        {!isEdit && form.maintenance_period && (() => {
                          const now = new Date();
                          const curYear = now.getFullYear();
                          const curMonth = now.getMonth() + 1;
                          const [selYear, selMonth] = form.maintenance_start_date
                            ? form.maintenance_start_date.split('-').map(Number)
                            : [0, 0];
                          const years = [curYear, curYear + 1, curYear + 2];
                          const cls = 'flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent';
                          function update(year, month) {
                            if (year && month) setForm(f => ({ ...f, maintenance_start_date: `${year}-${String(month).padStart(2,'0')}` }));
                            else setForm(f => ({ ...f, maintenance_start_date: '' }));
                          }
                          return (
                            <div className="mt-3 space-y-1.5">
                              <Label className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                Bakım Başlangıç Ayı
                              </Label>
                              <div className="flex gap-2">
                                <select value={selMonth || ''} onChange={e => update(selYear || curYear, Number(e.target.value))} className={cls}>
                                  <option value="">Ay</option>
                                  {MONTH_NAMES.map((m, i) => {
                                    const mn = i + 1;
                                    return <option key={i} value={mn} disabled={(selYear || curYear) === curYear && mn < curMonth}>{m}</option>;
                                  })}
                                </select>
                                <select value={selYear || ''} onChange={e => update(Number(e.target.value), selMonth || curMonth)} className={cls}>
                                  <option value="">Yıl</option>
                                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                              </div>
                              <p className="text-xs text-slate-400">Boş bırakılırsa bu aydan başlatılır</p>
                            </div>
                          );
                        })()}
                        {quantity > 1 && (
                          <p className="text-xs text-amber-600 pt-1">Bakım planı grubun kendisine bağlanır, tüm birimleri kapsar.</p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Butonlar */}
            <div className="mt-4 flex gap-3 justify-end">
              <Button type="button" variant="outline" size="lg" onClick={() => navigate('/equipment')}>
                İptal
              </Button>
              <Button type="submit" size="lg">
                {isEdit ? 'Değişiklikleri Kaydet' : 'Ekipmanı Kaydet'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
