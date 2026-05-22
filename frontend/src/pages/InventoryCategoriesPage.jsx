import { useEffect, useState } from 'react';
import {
  LayoutGrid, ChevronRight, Wind, Droplet, Zap, Flame, Package, Cog,
  ArrowLeft, MapPin, Tag, Hash, Layers, Check, Search, Loader2,
  FolderInput, Pencil, Trash2,
} from 'lucide-react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import InventoryItemPanel from '../components/InventoryItemPanel';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function iconFor(cat) {
  const c = (cat || '').toLowerCase();
  if (c.includes('hvac') || c.includes('klima') || c.includes('havalandır')) return Wind;
  if (c.includes('pompa') || c.includes('su')) return Droplet;
  if (c.includes('elektrik') || c.includes('jenerator') || c.includes('jeneratör')) return Zap;
  if (c.includes('ısı') || c.includes('isi') || c.includes('kazan') || c.includes('boyler')) return Flame;
  if (c.includes('mekanik')) return Cog;
  return Package;
}

const TONE_PALETTE = [
  { bg: 'bg-amber-50',   ring: 'ring-amber-200',   icon: 'text-amber-600',  iconBg: 'bg-amber-100',   count: 'text-amber-700' },
  { bg: 'bg-rose-50',    ring: 'ring-rose-200',    icon: 'text-rose-600',   iconBg: 'bg-rose-100',    count: 'text-rose-700' },
  { bg: 'bg-blue-50',    ring: 'ring-blue-200',    icon: 'text-blue-600',   iconBg: 'bg-blue-100',    count: 'text-blue-700' },
  { bg: 'bg-violet-50',  ring: 'ring-violet-200',  icon: 'text-violet-600', iconBg: 'bg-violet-100',  count: 'text-violet-700' },
  { bg: 'bg-emerald-50', ring: 'ring-emerald-200', icon: 'text-emerald-600',iconBg: 'bg-emerald-100', count: 'text-emerald-700' },
  { bg: 'bg-orange-50',  ring: 'ring-orange-200',  icon: 'text-orange-600', iconBg: 'bg-orange-100',  count: 'text-orange-700' },
];

const STATUS_LABELS = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };
const STATUS_COLORS = {
  active:      'bg-emerald-50 text-emerald-700',
  passive:     'bg-slate-100 text-slate-500',
  maintenance: 'bg-amber-100 text-amber-700',
  broken:      'bg-red-50 text-red-700',
};

export default function InventoryCategoriesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = ['admin', 'teknik_muduru', 'order_taker'].includes(user?.role);

  // Kategori özeti
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Seçili kategori detayı
  const [selectedCat, setSelectedCat] = useState(null);
  const [catItems, setCatItems] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  // Detay paneli
  const [selectedId, setSelectedId] = useState(null);

  // Kategoriye ekle paneli
  const [catAddOpen, setCatAddOpen] = useState(false);
  const [catAddAll, setCatAddAll] = useState([]);
  const [catAddSearch, setCatAddSearch] = useState('');
  const [catAddSelected, setCatAddSelected] = useState(new Set());
  const [catAddBusy, setCatAddBusy] = useState(false);

  useEffect(() => {
    api.get('/inventory/summary/category')
      .then(r => setSummary(r.data))
      .catch(() => setSummary([]))
      .finally(() => setSummaryLoading(false));
  }, []);

  function openCategory(cat) {
    setSelectedCat(cat);
    setSelectedId(null);
    setCatLoading(true);
    api.get(`/inventory?category=${encodeURIComponent(cat)}`)
      .then(r => setCatItems(r.data))
      .catch(() => setCatItems([]))
      .finally(() => setCatLoading(false));
  }

  function reloadCatItems() {
    if (!selectedCat) return;
    setCatLoading(true);
    api.get(`/inventory?category=${encodeURIComponent(selectedCat)}`)
      .then(r => setCatItems(r.data))
      .catch(() => setCatItems([]))
      .finally(() => setCatLoading(false));
    // Özet sayaçlarını da güncelle
    api.get('/inventory/summary/category').then(r => setSummary(r.data)).catch(() => {});
  }

  function goBack() {
    setSelectedCat(null);
    setCatItems([]);
    setSelectedId(null);
    // Özet yenile (ekleme/silme varsa sayılar değişmiş olabilir)
    api.get('/inventory/summary/category').then(r => setSummary(r.data)).catch(() => {});
  }

  async function handleDelete(item) {
    if (!window.confirm(`"${item.name}" kaydı silinsin mi? Bu işlem geri alınamaz.`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      toast?.success('Kayıt silindi');
      if (selectedId === item.id) setSelectedId(null);
      reloadCatItems();
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Silinemedi');
    }
  }

  // --- Kategoriye ekle ---
  async function openCatAdd() {
    setCatAddSearch('');
    setCatAddSelected(new Set());
    setCatAddBusy(true);
    setCatAddOpen(true);
    try {
      const r = await api.get('/inventory');
      setCatAddAll(r.data);
    } catch { setCatAddAll([]); }
    finally { setCatAddBusy(false); }
  }

  function toggleCatItem(id) {
    setCatAddSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible(visibleIds) {
    const allSel = visibleIds.every(id => catAddSelected.has(id));
    setCatAddSelected(prev => {
      const next = new Set(prev);
      visibleIds.forEach(id => allSel ? next.delete(id) : next.add(id));
      return next;
    });
  }

  async function confirmCatAdd() {
    if (catAddSelected.size === 0) return;
    setCatAddBusy(true);
    try {
      await api.patch('/inventory/bulk-category', { ids: [...catAddSelected], category: selectedCat });
      toast?.success(`${catAddSelected.size} kayıt "${selectedCat}" kategorisine taşındı`);
      setCatAddOpen(false);
      reloadCatItems();
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Güncelleme başarısız');
    } finally {
      setCatAddBusy(false);
    }
  }

  const total = summary.reduce((acc, x) => acc + x.count, 0);

  // ── Kategori detay görünümü ──────────────────────────────────────────
  if (selectedCat) {
    const tone = TONE_PALETTE[summary.findIndex(s => s.category === selectedCat) % TONE_PALETTE.length] || TONE_PALETTE[0];
    const Icon = iconFor(selectedCat);

    const q = catAddSearch.toLowerCase();
    const filtered = catAddAll.filter(it =>
      !q || it.name?.toLowerCase().includes(q) ||
      it.brand?.toLowerCase().includes(q) ||
      it.location?.toLowerCase().includes(q)
    );
    const visibleIds = filtered.map(it => it.id);
    const inCat = filtered.filter(it => it.category === selectedCat);
    const outCat = filtered.filter(it => it.category !== selectedCat);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => catAddSelected.has(id));

    return (
      <Layout>
        {/* Başlık */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium"
            >
              <ArrowLeft size={16} />
              Kategoriler
            </button>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${tone.iconBg} flex items-center justify-center`}>
                <Icon size={16} className={tone.icon} />
              </div>
              <span className="text-lg font-bold text-slate-800">{selectedCat}</span>
              <span className="text-sm text-slate-400 font-normal">{catItems.length} kayıt</span>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={openCatAdd}
              className="flex items-center gap-2 px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-sm font-semibold rounded-xl transition-colors"
            >
              <FolderInput size={15} />
              Ekipman Ekle
            </button>
          )}
        </div>

        {/* Tablo */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                {['', 'Adı', 'Lokasyon', 'Marka', 'Durum', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {catLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded-md animate-pulse w-[60%]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : catItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <Package size={28} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Bu kategoride henüz ekipman yok</p>
                    {canEdit && (
                      <button
                        onClick={openCatAdd}
                        className="mt-3 text-sm text-violet-600 hover:underline font-medium"
                      >
                        Ekipman ekle
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                catItems.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className="hover:bg-amber-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Package size={15} className="text-slate-300" />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        {item.quantity > 1 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                            <Layers size={9} />
                            {item.quantity}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {item.location
                        ? <span className="inline-flex items-center gap-1 text-sm text-slate-600"><MapPin size={11} className="text-rose-400" />{item.location}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {item.brand || <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[item.status] || ''}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(item); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detay paneli */}
        <SlidePanel open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Envanter Detayı">
          <InventoryItemPanel
            itemId={selectedId}
            canEdit={canEdit}
            onDeleted={() => { setSelectedId(null); reloadCatItems(); }}
          />
        </SlidePanel>

        {/* Kategoriye ekle paneli */}
        <SlidePanel open={catAddOpen} onClose={() => setCatAddOpen(false)} title={`"${selectedCat}" kategorisine ekle`}>
          <div className="flex flex-col gap-3 h-full">
            <p className="text-xs text-slate-500">
              Ekipmanları seçerek bu kategoriye taşıyabilirsin.
            </p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Ekipman ara…"
                value={catAddSearch}
                onChange={e => setCatAddSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
              />
            </div>

            {catAddBusy ? (
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> Yükleniyor…
              </div>
            ) : (
              <>
                {filtered.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleAllVisible(visibleIds)}
                    className="flex items-center gap-2 text-xs font-semibold text-violet-700 hover:text-violet-900 px-1"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allVisibleSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                      {allVisibleSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    {allVisibleSelected ? 'Tümünü kaldır' : `Tümünü seç (${filtered.length})`}
                  </button>
                )}
                <div className="flex-1 overflow-y-auto space-y-1 max-h-[60vh]">
                  {outCat.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 pb-1">Diğer / Kategorisiz ({outCat.length})</p>
                      {outCat.map(it => (
                        <CatAddRow key={it.id} item={it} selected={catAddSelected.has(it.id)} onToggle={() => toggleCatItem(it.id)} />
                      ))}
                    </>
                  )}
                  {inCat.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 pb-1 pt-2">Zaten bu kategoride ({inCat.length})</p>
                      {inCat.map(it => (
                        <CatAddRow key={it.id} item={it} selected={catAddSelected.has(it.id)} onToggle={() => toggleCatItem(it.id)} dim />
                      ))}
                    </>
                  )}
                  {filtered.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">Ekipman bulunamadı</p>
                  )}
                </div>
              </>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCatAddOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmCatAdd}
                disabled={catAddSelected.size === 0 || catAddBusy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
              >
                {catAddBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {catAddSelected.size > 0 ? `${catAddSelected.size} kaydı taşı` : 'Ekipman seç'}
              </button>
            </div>
          </div>
        </SlidePanel>
      </Layout>
    );
  }

  // ── Kategori özeti görünümü ──────────────────────────────────────────
  return (
    <Layout>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <LayoutGrid size={14} className="text-amber-500" />
            <span>Kategoriye göre envanter özeti</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            Toplam {total} <span className="text-base font-normal text-slate-500">kayıt · {summary.length} kategori</span>
          </p>
        </div>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm h-32 animate-pulse" />
          ))}
        </div>
      ) : summary.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Henüz envanter kalemi yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {summary.map((row, idx) => {
            const Icon = iconFor(row.category);
            const t = TONE_PALETTE[idx % TONE_PALETTE.length];
            return (
              <button
                key={row.category}
                type="button"
                onClick={() => openCategory(row.category)}
                className={`group relative ${t.bg} ${t.ring} ring-1 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl ${t.iconBg} flex items-center justify-center`}>
                    <Icon size={20} className={t.icon} />
                  </div>
                  <ChevronRight size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">{row.category}</p>
                <p className={`text-3xl font-bold ${t.count}`}>{row.count}</p>
                <p className="text-xs text-slate-500 mt-1">kayıt</p>
              </button>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

function CatAddRow({ item, selected, onToggle, dim }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
        selected
          ? 'bg-violet-50 border-violet-300'
          : dim
            ? 'bg-slate-50 border-slate-100 opacity-50 hover:opacity-80'
            : 'bg-white border-slate-100 hover:bg-slate-50'
      }`}
    >
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
        {selected && <Check size={10} className="text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{item.name}</div>
        <div className="text-[11px] text-slate-400 truncate">
          {[item.brand, item.location, item.category ? `📁 ${item.category}` : null].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      {item.quantity > 1 && (
        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
          {item.quantity} adet
        </span>
      )}
    </button>
  );
}
