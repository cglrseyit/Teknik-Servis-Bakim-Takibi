import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight, Package, Tag } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/axios';

export default function InventoryLocationsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/summary/location')
      .then(r => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const total = data.reduce((acc, x) => acc + x.count, 0);

  return (
    <Layout>
      <div className="mb-5">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <MapPin size={14} className="text-rose-500" />
          <span>Lokasyona göre envanter özeti</span>
        </div>
        <p className="text-2xl font-bold text-slate-800">
          Toplam {total} <span className="text-base font-normal text-slate-500">kayıt · {data.length} lokasyon</span>
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm h-48 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Henüz envanter kalemi yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(loc => (
            <div key={loc.location} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <Link
                to={`/inventory?location=${encodeURIComponent(loc.location)}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-rose-50 to-rose-50/30 border-b border-rose-100/60 hover:from-rose-100/70 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} className="text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{loc.location}</p>
                    <p className="text-[11px] text-slate-500">{loc.count} kayıt</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>

              <ul className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {(loc.items || []).map(item => (
                  <li key={item.id}>
                    <Link
                      to={`/inventory?search=${encodeURIComponent(item.name)}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-amber-50/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package size={12} className="text-slate-300 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{item.name}</span>
                      </div>
                      {item.category && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 flex-shrink-0">
                          <Tag size={9} />
                          {item.category}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
