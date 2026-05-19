import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, FileSpreadsheet, Package, ChevronRight, Pencil,
  ImageIcon, MapPin, Tag, Hash,
} from 'lucide-react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import InventoryItemPanel from '../components/InventoryItemPanel';
import AuthImage from '../components/AuthImage';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const STATUS_LABELS = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };
const STATUS_COLORS = {
  active:      'bg-emerald-50 text-emerald-700',
  passive:     'bg-slate-100 text-slate-500',
  maintenance: 'bg-amber-100 text-amber-700',
  broken:      'bg-red-50 text-red-700',
};

export default function InventoryListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const canEdit = ['admin', 'teknik_muduru'].includes(user?.role);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)   params.set('search', search);
    if (category) params.set('category', category);
    if (location) params.set('location', location);
    if (status)   params.set('status', status);

    api.get(`/inventory?${params}`)
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    // URL'i sync et
    setSearchParams(params, { replace: true });
  }, [search, category, location, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtre dropdown'larına kategori/lokasyon değerlerini toplayalım
  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort();
  const locations = Array.from(new Set(items.map(i => i.location).filter(Boolean))).sort();

  async function exportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search)   params.set('search', search);
      if (category) params.set('category', category);
      if (location) params.set('location', location);
      if (status)   params.set('status', status);
      const r = await api.get(`/exports/inventory/list.xlsx?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `envanter-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast?.error('Excel indirilemedi');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Layout>
      {/* Filtre + butonlar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Ara (ad / demirbaş no / seri no)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 shadow-sm"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/25 shadow-sm cursor-pointer"
        >
          <option value="">Tüm Kategoriler</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={location}
          onChange={e => setLocation(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/25 shadow-sm cursor-pointer"
        >
          <option value="">Tüm Lokasyonlar</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/25 shadow-sm cursor-pointer"
        >
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={exportExcel}
            disabled={exporting || items.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
          >
            <FileSpreadsheet size={15} />
            {exporting ? 'İndiriliyor…' : 'Excel\'e Aktar'}
          </button>
          {canEdit && (
            <Link
              to="/inventory/new"
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-amber-600/20"
            >
              <Plus size={15} strokeWidth={2.5} />
              Envantere Ekle
            </Link>
          )}
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {['', 'Demirbaş No', 'Adı', 'Kategori', 'Lokasyon', 'Marka / Model', 'Durum', ''].map((h, i) => (
                <th key={i} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded-md animate-pulse w-[60%]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Package size={32} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600">Envanter kalemi bulunamadı</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {search || category || location || status
                      ? 'Filtreleri değiştirmeyi dene.'
                      : 'Yeni bir kayıt eklemek için "Envantere Ekle" tuşunu kullan.'}
                  </p>
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className="hover:bg-amber-50/40 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {item.primary_attachment ? (
                        <AuthImage
                          apiPath={`/inventory/attachments/${item.primary_attachment.id}/download`}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          fallback={<Package size={16} className="text-slate-300" />}
                        />
                      ) : (
                        <Package size={16} className="text-slate-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {item.inventory_no ? (
                      <span className="inline-flex items-center gap-1 text-violet-700 font-mono font-medium">
                        <Hash size={11} className="text-violet-400" />
                        {item.inventory_no}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                    {item.serial_number && (
                      <div className="text-[11px] text-slate-400">SN: {item.serial_number}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {item.category ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700">
                        <Tag size={9} />
                        {item.category}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {item.location ? (
                      <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                        <MapPin size={11} className="text-rose-400" />
                        {item.location}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {[item.brand, item.model].filter(Boolean).join(' · ') || <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[item.status] || ''}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <Link
                          to={`/inventory/${item.id}/edit`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Pencil size={13} />
                        </Link>
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
      <SlidePanel
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title="Envanter Detayı"
      >
        <InventoryItemPanel itemId={selectedId} canEdit={canEdit} />
      </SlidePanel>
    </Layout>
  );
}
