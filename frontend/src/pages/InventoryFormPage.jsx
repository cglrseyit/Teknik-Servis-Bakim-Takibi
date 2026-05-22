import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import DayPicker from '../components/DayPicker';
import InventoryPhotoUploader from '../components/InventoryPhotoUploader';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const STATUS_OPTIONS = [
  { value: 'active',      label: 'Aktif',      icon: CheckCircle2,  bgColor: 'bg-emerald-50 border-emerald-300', color: 'text-emerald-700' },
  { value: 'maintenance', label: 'Bakımda',    icon: Clock,         bgColor: 'bg-amber-50 border-amber-300',     color: 'text-amber-700' },
  { value: 'passive',     label: 'Pasif',      icon: XCircle,       bgColor: 'bg-slate-100 border-slate-300',    color: 'text-slate-600' },
  { value: 'broken',      label: 'Arızalı',    icon: AlertTriangle, bgColor: 'bg-red-50 border-red-300',         color: 'text-red-700' },
];

export default function InventoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    inventory_no: '', name: '', category: '', location: '',
    brand: '', model: '', serial_number: '', supplier: '',
    install_date: '', warranty_end: '',
    status: 'active', notes: '',
    quantity: '', power: '', power_unit: '', annual_days: '', lifespan_years: '',
  });
  const [existingAtts, setExistingAtts] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Mevcut kategoriler — datalist için
  const [allCategories, setAllCategories] = useState([]);
  const [allLocations, setAllLocations] = useState([]);

  useEffect(() => {
    api.get('/inventory').then(r => {
      setAllCategories(Array.from(new Set(r.data.map(i => i.category).filter(Boolean))).sort());
      setAllLocations(Array.from(new Set(r.data.map(i => i.location).filter(Boolean))).sort());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/inventory/${id}`).then(r => {
      const it = r.data;
      setForm({
        inventory_no:  it.inventory_no  || '',
        name:          it.name          || '',
        category:      it.category      || '',
        location:      it.location      || '',
        brand:         it.brand         || '',
        model:         it.model         || '',
        serial_number: it.serial_number || '',
        supplier:      it.supplier      || '',
        install_date:  it.install_date  ? it.install_date.split('T')[0] : '',
        warranty_end:  it.warranty_end  ? it.warranty_end.split('T')[0] : '',
        status:        it.status        || 'active',
        notes:         it.notes         || '',
        quantity:      it.quantity      != null ? String(it.quantity) : '',
        power:         it.power          != null ? String(it.power) : '',
        power_unit:    it.power_unit     || '',
        annual_days:   it.annual_days    != null ? String(it.annual_days) : '',
        lifespan_years:it.lifespan_years != null ? String(it.lifespan_years) : '',
      });
      setExistingAtts(it.attachments || []);
    }).catch(() => {
      toast?.error('Kayıt yüklenemedi');
      navigate('/inventory');
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(k, v) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Ad zorunlu');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/inventory/${id}`, form);
        // Bekleyen yeni fotolar varsa upload et
        if (pendingFiles.length > 0) {
          const fd = new FormData();
          pendingFiles.forEach(f => fd.append('files', f));
          await api.post(`/inventory/${id}/attachments`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        toast?.success('Güncellendi');
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        pendingFiles.forEach(f => fd.append('files', f));
        await api.post('/inventory', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast?.success('Envantere eklendi');
      }
      navigate('/inventory');
    } catch (err) {
      const msg = err.response?.data?.error || 'Kaydedilemedi';
      setError(msg);
      toast?.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Geri Dön
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Package size={20} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {isEdit ? 'Envanter Kaydını Düzenle' : 'Yeni Envanter Kaydı'}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Temel bilgiler */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Adı <span className="text-red-500">*</span></Label>
                <Input
                  required
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="örn: Daikin VRV Klima Santrali"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Demirbaş No</Label>
                <Input
                  value={form.inventory_no}
                  onChange={e => update('inventory_no', e.target.value)}
                  placeholder="ENV-2026-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Input
                  list="cat-list"
                  value={form.category}
                  onChange={e => update('category', e.target.value)}
                  placeholder="örn: HVAC, Pompa, Jeneratör"
                />
                <datalist id="cat-list">
                  {allCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Lokasyon</Label>
                <Input
                  list="loc-list"
                  value={form.location}
                  onChange={e => update('location', e.target.value)}
                  placeholder="örn: Bodrum Mekanik Oda"
                />
                <datalist id="loc-list">
                  {allLocations.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Marka</Label>
                <Input value={form.brand} onChange={e => update('brand', e.target.value)} placeholder="örn: Daikin" />
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={form.model} onChange={e => update('model', e.target.value)} placeholder="örn: VRV-IV" />
              </div>
              <div className="space-y-1.5">
                <Label>Adet</Label>
                <Input type="number" min="1" value={form.quantity} onChange={e => update('quantity', e.target.value)} placeholder="1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Seri Numarası</Label>
                <Input value={form.serial_number} onChange={e => update('serial_number', e.target.value)} placeholder="örn: SN-2024-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Tedarikçi</Label>
                <Input value={form.supplier} onChange={e => update('supplier', e.target.value)} placeholder="örn: ABC Teknik Ltd." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kurulum Tarihi</Label>
                <DayPicker
                  value={form.install_date}
                  onChange={v => update('install_date', v)}
                  placeholder="Kurulum tarihi seç"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Garanti Bitiş</Label>
                <DayPicker
                  value={form.warranty_end}
                  onChange={v => update('warranty_end', v)}
                  placeholder="Garanti bitiş tarihi seç"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Durum</Label>
              <div className="grid grid-cols-4 gap-2">
                {STATUS_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = form.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update('status', opt.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${
                        selected ? `${opt.bgColor}` : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? opt.color : 'text-slate-400'}`} />
                      <span className={`font-medium text-xs ${selected ? opt.color : 'text-slate-600'}`}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <textarea
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 resize-none"
                placeholder="Bu kayda özel notlar..."
              />
            </div>
          </div>

          {/* Enerji / Kullanım bilgileri */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700">Enerji / Kullanım Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Güç</Label>
                <Input type="number" step="any" value={form.power} onChange={e => update('power', e.target.value)} placeholder="örn: 200" />
              </div>
              <div className="space-y-1.5">
                <Label>Birim</Label>
                <Input list="unit-list" value={form.power_unit} onChange={e => update('power_unit', e.target.value)} placeholder="W / KW" />
                <datalist id="unit-list">
                  <option value="W" />
                  <option value="KW" />
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Yıllık Ort. Kullanılan Gün</Label>
                <Input type="number" min="0" value={form.annual_days} onChange={e => update('annual_days', e.target.value)} placeholder="örn: 300" />
              </div>
              <div className="space-y-1.5">
                <Label>Ekipman Ömrü (yıl)</Label>
                <Input type="number" min="0" value={form.lifespan_years} onChange={e => update('lifespan_years', e.target.value)} placeholder="örn: 10" />
              </div>
            </div>
          </div>

          {/* Fotolar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <Label>Fotolar</Label>
            <InventoryPhotoUploader
              inventoryId={isEdit ? Number(id) : null}
              existing={existingAtts}
              pending={pendingFiles}
              onPendingChange={setPendingFiles}
              onExistingChange={setExistingAtts}
            />
          </div>

          {/* Aksiyonlar */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-600/20 transition-colors disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : (isEdit ? 'Kaydet' : 'Oluştur')}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

function Label({ children }) {
  return <label className="text-sm font-semibold text-slate-700">{children}</label>;
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 ${props.className || ''}`}
    />
  );
}
