import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid, ChevronRight, Wind, Droplet, Zap, Flame, Package, Cog,
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/axios';

// Bilinen kategorilere uygun ikon; bulamazsak Package
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

export default function InventoryCategoriesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/summary/category')
      .then(r => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const total = data.reduce((acc, x) => acc + x.count, 0);

  return (
    <Layout>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <LayoutGrid size={14} className="text-amber-500" />
            <span>Kategoriye göre envanter özeti</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            Toplam {total} <span className="text-base font-normal text-slate-500">kayıt · {data.length} kategori</span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm h-32 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Henüz envanter kalemi yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((row, idx) => {
            const Icon = iconFor(row.category);
            const t = TONE_PALETTE[idx % TONE_PALETTE.length];
            return (
              <Link
                key={row.category}
                to={`/inventory?category=${encodeURIComponent(row.category)}`}
                className={`group relative ${t.bg} ${t.ring} ring-1 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5`}
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
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
