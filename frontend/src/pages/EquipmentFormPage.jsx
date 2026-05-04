import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, WrenchIcon, Clock, CalendarDays } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SelectTrigger } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

const CATEGORIES = ['HVAC', 'Elektrik', 'Asansör', 'Su Sistemi', 'Jeneratör', 'Güvenlik', 'Diğer'];

const STATUS_OPTIONS = [
  { value: 'active',      label: 'Aktif',   color: 'text-green-600',  bgColor: 'bg-green-50',  borderColor: 'border-green-500',  icon: CheckCircle2 },
  { value: 'maintenance', label: 'Bakımda', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500', icon: WrenchIcon   },
  { value: 'passive',     label: 'Pasif',   color: 'text-gray-500',   bgColor: 'bg-gray-50',   borderColor: 'border-gray-400',   icon: Clock        },
];

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const PERIOD_OPTIONS = [
  { value: 'monthly',   label: 'Aylık',   sub: 'Her ay' },
  { value: 'quarterly', label: '3 Aylık', sub: 'Her 3 ayda bir' },
  { value: 'biannual',  label: '6 Aylık', sub: 'Her 6 ayda bir' },
  { value: 'yearly',    label: '1 Yıllık', sub: 'Yılda bir kez' },
];

export default function EquipmentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);
  const [error, setError] = useState('');
  const [setupLater, setSetupLater] = useState(false);
  const [form, setForm] = useState({
    name: '', brand: '', category: '', supplier: '',
    status: 'active', notes: '', maintenance_period: '',
    maintenance_start_date: '',
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/equipment/${id}`).then(r => {
        const eq = r.data;
        setForm({
          name: eq.name || '',
          brand: eq.brand || '',
          category: eq.category || '',
          supplier: eq.supplier || '',
          status: eq.status || 'active',
          notes: eq.notes || '',
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
      else await api.post('/equipment', form);
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
      <div className="max-w-2xl mx-auto">
        {/* Başlık */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2 bg-primary/10 rounded-lg">
              <WrenchIcon className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEdit ? 'Ekipmanı Düzenle' : 'Yeni Ekipman'}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm ml-[52px]">
            {isEdit ? 'Ekipman bilgilerini güncelleyin' : 'Sisteme yeni bir ekipman kaydedin'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Zorunlu Bilgiler */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Zorunlu Bilgiler</CardTitle>
              <CardDescription>Tüm zorunlu alanları doldurunuz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">
                  Ekipman Adı <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="örn: Klima Santrali, Asansör No:2"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Durum <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={form.status}
                  onValueChange={val => setForm(f => ({ ...f, status: val }))}
                  className="grid grid-cols-3 gap-3"
                >
                  {STATUS_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const selected = form.status === opt.value;
                    return (
                      <div key={opt.value}>
                        <RadioGroupItem value={opt.value} id={`status-${opt.value}`} className="peer sr-only" />
                        <Label
                          htmlFor={`status-${opt.value}`}
                          className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm ${
                            selected
                              ? `${opt.bgColor} ${opt.borderColor} shadow-sm`
                              : 'bg-background border-border hover:border-muted-foreground/40'
                          }`}
                        >
                          <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? opt.color : 'text-muted-foreground'}`} />
                          <span className={`font-medium text-sm ${selected ? opt.color : 'text-foreground'}`}>
                            {opt.label}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier" className="text-sm font-semibold">
                  Tedarikçi <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="supplier"
                  required
                  value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                  placeholder="örn: ABC Teknik Ltd."
                />
              </div>

              {/* Bakım Periyodu */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    Bakım Periyodu
                    {!isEdit && !setupLater && <span className="text-destructive">*</span>}
                  </Label>
                  {!isEdit && !setupLater && (
                    <button
                      type="button"
                      onClick={() => { setSetupLater(true); setForm(f => ({ ...f, maintenance_period: '', maintenance_start_date: '' })); }}
                      className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
                    >
                      Bakımı daha sonra ayarla
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
                    <RadioGroup
                      value={form.maintenance_period}
                      onValueChange={val => setForm(f => ({ ...f, maintenance_period: val }))}
                      className="grid grid-cols-2 gap-3"
                    >
                      {PERIOD_OPTIONS.map(opt => {
                        const selected = form.maintenance_period === opt.value;
                        return (
                          <div key={opt.value}>
                            <RadioGroupItem value={opt.value} id={`period-${opt.value}`} className="peer sr-only" />
                            <Label
                              htmlFor={`period-${opt.value}`}
                              className={`flex flex-col gap-0.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm ${
                                selected
                                  ? 'bg-amber-50 border-amber-500 shadow-sm'
                                  : 'bg-background border-border hover:border-muted-foreground/40'
                              }`}
                            >
                              <span className={`font-semibold text-sm ${selected ? 'text-amber-700' : 'text-foreground'}`}>
                                {opt.label}
                              </span>
                              <span className={`text-xs ${selected ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                {opt.sub}
                              </span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>

                    {!isEdit && form.maintenance_period && (() => {
                      const now = new Date();
                      const curYear = now.getFullYear();
                      const curMonth = now.getMonth() + 1;
                      const [selYear, selMonth] = form.maintenance_start_date
                        ? form.maintenance_start_date.split('-').map(Number)
                        : [0, 0];
                      const years = [curYear, curYear + 1, curYear + 2];
                      const selectCls = 'flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent';
                      function update(year, month) {
                        if (year && month) setForm(f => ({ ...f, maintenance_start_date: `${year}-${String(month).padStart(2,'0')}` }));
                        else setForm(f => ({ ...f, maintenance_start_date: '' }));
                      }
                      return (
                        <div className="space-y-1.5 pt-1">
                          <Label className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                            Bakım Başlangıç Ayı
                          </Label>
                          <div className="flex gap-2">
                            <select
                              value={selMonth || ''}
                              onChange={e => update(selYear || curYear, Number(e.target.value))}
                              className={selectCls}
                            >
                              <option value="">Ay</option>
                              {MONTH_NAMES.map((m, i) => {
                                const monthNum = i + 1;
                                const disabled = (selYear || curYear) === curYear && monthNum < curMonth;
                                return <option key={i} value={monthNum} disabled={disabled}>{m}</option>;
                              })}
                            </select>
                            <select
                              value={selYear || ''}
                              onChange={e => update(Number(e.target.value), selMonth || curMonth)}
                              className={selectCls}
                            >
                              <option value="">Yıl</option>
                              {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                          <p className="text-xs text-slate-400">Boş bırakılırsa bu aydan başlatılır</p>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Opsiyonel Bilgiler */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Opsiyonel Bilgiler</CardTitle>
              <CardDescription>İsteğe bağlı ek bilgileri girebilirsiniz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="brand" className="text-sm font-semibold">Marka</Label>
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  placeholder="örn: Carrier, Siemens"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-semibold">Kategori</Label>
                <SelectTrigger
                  id="category"
                  value={form.category}
                  onValueChange={val => setForm(f => ({ ...f, category: val }))}
                  placeholder="Kategori seçiniz"
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold">Notlar</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ekipman hakkında önemli notlar..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Butonlar */}
          <div className="mt-6 flex gap-3 justify-end">
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
