import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, WrenchIcon, Clock, AlertTriangle, CalendarDays, ArrowLeft } from 'lucide-react';
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
  { value: 'broken',      label: 'Arızalı', color: 'text-red-600',    bgColor: 'bg-red-50',    borderColor: 'border-red-400',    icon: AlertTriangle },
];

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const PERIOD_OPTIONS = [
  { value: 'monthly',   label: 'Aylık',    sub: 'Her ay' },
  { value: 'quarterly', label: '3 Aylık',  sub: 'Her 3 ayda bir' },
  { value: 'biannual',  label: '6 Aylık',  sub: 'Her 6 ayda bir' },
  { value: 'yearly',    label: '1 Yıllık', sub: 'Yılda bir kez' },
];

function emptyUnit(name, index) {
  return { name: name ? `${name} #${index + 1}` : `Birim ${index + 1}`, supplier: '', brand: '', model: '', serial_number: '', location: '', status: 'active', notes: '' };
}

function UnitFields({ unit, onChange, hasError }) {
  const set = (key, val) => onChange({ ...unit, [key]: val });
  const missing = (field) => hasError && !unit[field]?.trim();
  return (
    <div className="space-y-5">
      {hasError && (!unit.name?.trim() || !unit.supplier?.trim()) && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
          Bu birimde zorunlu alanlar eksik: {[!unit.name?.trim() && 'Birim Adı', !unit.supplier?.trim() && 'Tedarikçi'].filter(Boolean).join(', ')}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-slate-700">Birim Adı <span className="text-red-500">*</span></Label>
        <Input
          value={unit.name}
          onChange={e => set('name', e.target.value)}
          placeholder="örn: Kombi #1"
          className={missing('name') ? 'border-red-400 focus:ring-red-400' : ''}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Tedarikçi <span className="text-red-500">*</span></Label>
          <Input
            value={unit.supplier}
            onChange={e => set('supplier', e.target.value)}
            placeholder="örn: ABC Teknik Ltd."
            className={missing('supplier') ? 'border-red-400 focus:ring-red-400' : ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Seri Numarası</Label>
          <Input value={unit.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="örn: SN-001" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Marka</Label>
          <Input value={unit.brand} onChange={e => set('brand', e.target.value)} placeholder="örn: Vaillant" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-slate-700">Model</Label>
          <Input value={unit.model} onChange={e => set('model', e.target.value)} placeholder="örn: ecoTEC Pro" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-slate-700">Lokasyon</Label>
        <Input value={unit.location} onChange={e => set('location', e.target.value)} placeholder="örn: 3. Kat, Teknik Oda" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-slate-700">Durum</Label>
        <div className="grid grid-cols-4 gap-2">
          {STATUS_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const selected = unit.status === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => set('status', opt.value)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all text-left ${selected ? `${opt.bgColor} ${opt.borderColor}` : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? opt.color : 'text-slate-400'}`} />
                <span className={`font-medium text-xs ${selected ? opt.color : 'text-slate-600'}`}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-slate-700">Notlar</Label>
        <Textarea value={unit.notes} onChange={e => set('notes', e.target.value)} placeholder="Bu birime özel notlar..." rows={2} className="resize-none" />
      </div>
    </div>
  );
}

export default function EquipmentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);
  const [error, setError] = useState('');
  const [unitErrors, setUnitErrors] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [isUnit, setIsUnit] = useState(false);
  const [unitList, setUnitList] = useState([]);
  const [step, setStep] = useState('form'); // 'form' | 'period'
  const [form, setForm] = useState({
    name: '', brand: '', model: '', supplier: '',
    serial_number: '', location: '',
    status: 'active', notes: '', maintenance_period: '',
    maintenance_start_date: '',
  });

  function changeQuantity(delta) {
    setQuantity(q => {
      const next = Math.min(100, Math.max(1, q + delta));
      if (next <= 1) {
        setUnitList([]);
        setActiveTab(0);
      } else if (next > q) {
        setUnitList(prev => {
          const arr = [...prev];
          while (arr.length < next) arr.push(emptyUnit(form.name, arr.length));
          return arr;
        });
        setActiveTab(next - 1);
      } else {
        setUnitList(prev => prev.slice(0, next));
        setActiveTab(prev => (typeof prev === 'number' && prev >= next) ? next - 1 : prev);
      }
      return next;
    });
  }

  function handleGroupNameChange(val) {
    setForm(f => ({ ...f, name: val }));
    setUnitList(prev => prev.map((u, i) => {
      const defaultName = `${form.name} #${i + 1}`;
      if (u.name === defaultName || u.name === `${val} #${i + 1}` || u.name === `Birim ${i + 1}`) {
        return { ...u, name: `${val} #${i + 1}` };
      }
      return u;
    }));
  }

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

  // Adım 1: Ekipman bilgilerini doğrula, adım 2'ye geç
  function handleFormNext(e) {
    e.preventDefault();
    setError('');

    if (quantity > 1) {
      const errors = unitList.map(u => !u.name?.trim() || !u.supplier?.trim());
      setUnitErrors(errors);
      const firstBad = errors.findIndex(Boolean);
      if (firstBad !== -1) {
        setActiveTab(firstBad);
        setError('Tüm birimlerde Birim Adı ve Tedarikçi zorunludur.');
        return;
      }
      setUnitErrors([]);
    }

    setStep('period');
  }

  // Adım 2: Ekipmanı oluştur (skipPlan=true → bakım planı olmadan)
  async function doCreate(skipPlan = false) {
    setError('');
    try {
      const period = skipPlan ? null : (form.maintenance_period || null);
      const startDate = skipPlan ? null : (form.maintenance_start_date || null);

      if (quantity > 1) {
        await api.post('/equipment', {
          name: form.name,
          maintenance_period: period,
          maintenance_start_date: startDate,
          units: unitList,
        });
      } else {
        await api.post('/equipment', { ...form, maintenance_period: period, maintenance_start_date: startDate, quantity: 1 });
      }
      toast?.success('Ekipman eklendi');
      navigate('/equipment');
    } catch (err) {
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    }
  }

  // Düzenleme modu: direkt kaydet
  async function handleEditSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.put(`/equipment/${id}`, form);
      toast?.success('Ekipman güncellendi');
      navigate('/equipment');
    } catch (err) {
      const msg = err.response?.data?.error || 'Hata oluştu';
      setError(msg);
      toast?.error(msg);
    }
  }

  const isMulti = quantity > 1 && !isEdit;

  // Bakım periyodu başlangıç ayı seçici (adım 2'de kullanılır)
  function renderStartMonth() {
    if (!form.maintenance_period) return null;
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const [selYear, selMonth] = form.maintenance_start_date
      ? form.maintenance_start_date.split('-').map(Number)
      : [0, 0];
    const years = [curYear, curYear + 1, curYear + 2];
    const cls = 'flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400';

    function updateDate(year, month) {
      if (year && month) setForm(f => ({ ...f, maintenance_start_date: `${year}-${String(month).padStart(2, '0')}` }));
      else setForm(f => ({ ...f, maintenance_start_date: '' }));
    }

    return (
      <div className="mt-4 space-y-1.5">
        <Label className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          Bakım Başlangıç Ayı
        </Label>
        <div className="flex gap-2">
          <select value={selMonth || ''} onChange={e => updateDate(selYear || curYear, Number(e.target.value))} className={cls}>
            <option value="">Ay</option>
            {MONTH_NAMES.map((m, i) => {
              const mn = i + 1;
              return <option key={i} value={mn} disabled={(selYear || curYear) === curYear && mn < curMonth}>{m}</option>;
            })}
          </select>
          <select value={selYear || ''} onChange={e => updateDate(Number(e.target.value), selMonth || curMonth)} className={cls}>
            <option value="">Yıl</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-400">Boş bırakılırsa bu aydan başlatılır</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-6 overflow-auto min-h-full">
        <div className="max-w-4xl">

          {/* Başlık */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => step === 'period' ? setStep('form') : navigate(-1)}
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
                {isEdit ? 'Ekipmanı Düzenle' : step === 'period' ? 'Bakım Periyodu' : 'Yeni Ekipman'}
              </h1>
            </div>
            <p className="text-sm text-slate-400 ml-[52px]">
              {isEdit
                ? 'Ekipman bilgilerini güncelleyin'
                : step === 'period'
                ? 'Bakım planını yapılandırın veya daha sonra ayarlayın'
                : 'Sisteme yeni bir ekipman kaydedin'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>
          )}

          {/* ── ADIM 2: Bakım Periyodu ── */}
          {!isEdit && step === 'period' ? (
            <div>
              {/* Özet: hangi ekipman için */}
              <div className="mb-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <WrenchIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-slate-700">{form.name}</span>
                  {quantity > 1 && <span className="ml-2 text-xs text-slate-400">{quantity} birim</span>}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  Bakım Periyodu
                </Label>

                <div className="grid grid-cols-4 gap-3">
                  {PERIOD_OPTIONS.map(opt => {
                    const selected = form.maintenance_period === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, maintenance_period: opt.value }))}
                        className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${selected ? 'bg-amber-50 border-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                        <span className={`font-semibold text-sm ${selected ? 'text-amber-700' : 'text-slate-700'}`}>{opt.label}</span>
                        <span className={`text-xs ${selected ? 'text-amber-500' : 'text-slate-400'}`}>{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>

                {renderStartMonth()}
              </div>

              <div className="mt-4 flex gap-3 justify-end">
                <Button type="button" variant="outline" size="lg" onClick={() => setStep('form')}>
                  ← Geri Dön
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => doCreate(true)}>
                  Daha Sonra Ayarla
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => doCreate(false)}
                  disabled={!form.maintenance_period}
                >
                  Ekipmanı Kaydet
                </Button>
              </div>
            </div>
          ) : (
            /* ── ADIM 1: Ekipman Bilgileri ── */
            <form onSubmit={isEdit ? handleEditSubmit : handleFormNext}>

              {/* Ekipman adı + Adet */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
                <div className={`grid gap-4 ${!isEdit ? 'grid-cols-[1fr_auto]' : ''} items-end`}>
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                      Ekipman Adı <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      required
                      value={form.name}
                      onChange={e => handleGroupNameChange(e.target.value)}
                      placeholder={isMulti ? 'örn: Kombi' : 'örn: Klima Santrali, Asansör No:2'}
                    />
                    {isMulti && <p className="text-xs text-slate-400">Birim adları: {form.name || 'Ekipman'} #1, #2… — her sekmeden düzenlenebilir</p>}
                  </div>

                  {!isEdit && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-slate-700">Adet</Label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => changeQuantity(-1)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center">−</button>
                        <span className="w-8 text-center font-semibold text-slate-800">{quantity}</span>
                        <button type="button" onClick={() => changeQuantity(+1)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center">+</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Çoklu birim sekmeleri */}
              {isMulti ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex border-b border-slate-100 overflow-x-auto">
                    {unitList.map((u, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveTab(i)}
                        className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                          activeTab === i
                            ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                            : unitErrors[i]
                            ? 'border-red-300 text-red-500 hover:bg-red-50'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {u.name || `Birim ${i + 1}`}
                        {unitErrors[i] && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    <UnitFields
                      unit={unitList[activeTab] ?? unitList[0]}
                      onChange={updated => {
                        setUnitList(prev => prev.map((u, i) => i === activeTab ? updated : u));
                        setUnitErrors(prev => prev.map((e, i) => i === activeTab ? false : e));
                      }}
                      hasError={!!unitErrors[activeTab]}
                    />
                  </div>
                </div>
              ) : (
                /* Tekli ekipman formu */
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="supplier" className="text-sm font-semibold text-slate-700">
                        Tedarikçi {!isUnit && <span className="text-red-500">*</span>}
                      </Label>
                      <Input id="supplier" required={!isUnit} value={form.supplier}
                        onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="örn: ABC Teknik Ltd." />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="serial_number" className="text-sm font-semibold text-slate-700">Seri Numarası</Label>
                      <Input id="serial_number" value={form.serial_number}
                        onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="örn: SN-20240101-001" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="brand" className="text-sm font-semibold text-slate-700">Marka</Label>
                      <Input id="brand" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="örn: Carrier, Siemens" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="model" className="text-sm font-semibold text-slate-700">Model</Label>
                      <Input id="model" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="örn: VRF-3000" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="location" className="text-sm font-semibold text-slate-700">Lokasyon</Label>
                    <Input id="location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="örn: 3. Kat, Teknik Oda" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700">Durum <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-4 gap-2">
                      {STATUS_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const selected = form.status === opt.value;
                        return (
                          <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, status: opt.value }))}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all text-left ${selected ? `${opt.bgColor} ${opt.borderColor}` : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                            <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? opt.color : 'text-slate-400'}`} />
                            <span className={`font-medium text-xs ${selected ? opt.color : 'text-slate-600'}`}>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-sm font-semibold text-slate-700">Notlar</Label>
                    <Textarea id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Ekipman hakkında önemli notlar..." rows={3} className="resize-none" />
                  </div>

                  {/* Düzenleme modunda bakım periyodu göster */}
                  {isEdit && !isUnit && (
                    <div className="border-t border-slate-100 pt-5 space-y-3">
                      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        Bakım Periyodu
                      </Label>
                      <div className="grid grid-cols-4 gap-3">
                        {PERIOD_OPTIONS.map(opt => {
                          const selected = form.maintenance_period === opt.value;
                          return (
                            <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, maintenance_period: opt.value }))}
                              className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${selected ? 'bg-amber-50 border-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                              <span className={`font-semibold text-sm ${selected ? 'text-amber-700' : 'text-slate-700'}`}>{opt.label}</span>
                              <span className={`text-xs ${selected ? 'text-amber-500' : 'text-slate-400'}`}>{opt.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Butonlar */}
              <div className="mt-4 flex gap-3 justify-end">
                <Button type="button" variant="outline" size="lg" onClick={() => navigate('/equipment')}>İptal</Button>
                <Button type="submit" size="lg">
                  {isEdit ? 'Değişiklikleri Kaydet' : 'Onayla →'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
