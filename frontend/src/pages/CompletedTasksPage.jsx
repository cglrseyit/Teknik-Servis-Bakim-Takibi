import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, Paperclip, Zap, CheckCircle2, History } from 'lucide-react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import EquipmentCombobox from '../components/EquipmentCombobox';
import HistoryTaskDetail from '../components/HistoryTaskDetail';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const STATUS_CONFIG = {
  completed: { label: 'Tamamlandı', cls: 'bg-green-50 text-green-700' },
  skipped:   { label: 'Atlandı',    cls: 'bg-slate-100 text-slate-500' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CompletedTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [equipment, setEquipment] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);          // GET /equipment/:id sonucu
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Ekipman listesi yükle
  useEffect(() => {
    api.get('/equipment').then(r => {
      setEquipment(r.data);
      // URL'den derin link?
      const urlId = Number(searchParams.get('equipment'));
      if (urlId && r.data.some(e => e.id === urlId)) {
        setSelectedId(urlId);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Seçilen ekipmanın görevlerini yükle
  useEffect(() => {
    if (!selectedId) {
      setData(null);
      return;
    }
    setLoading(true);
    api.get(`/equipment/${selectedId}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  // URL'i güncelle (derin link)
  function handleSelect(id) {
    setSelectedId(id);
    setSelectedTask(null);
    if (id) {
      setSearchParams({ equipment: String(id) }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  async function exportExcel() {
    if (!selectedId) return;
    setExporting(true);
    try {
      const r = await api.get(`/exports/equipment/${selectedId}/history.xlsx`, { responseType: 'blob' });
      const disp = r.headers['content-disposition'] || '';
      const match = disp.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      const filename = match
        ? decodeURIComponent(match[1].replace(/^"|"$/g, ''))
        : `${data?.name || 'ekipman'}-bakim-gecmisi.xlsx`;
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
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

  const tasks = data?.completed_tasks || [];

  return (
    <Layout>
      {/* Üst kontroller */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <EquipmentCombobox
              value={selectedId}
              onChange={handleSelect}
              equipment={equipment}
              placeholder="Ekipman seç ve geçmişi gör..."
            />
          </div>
          <button
            onClick={exportExcel}
            disabled={!selectedId || exporting || tasks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={tasks.length === 0 ? 'Önce ekipman seç (en az 1 kayıt olmalı)' : 'Excel olarak indir'}
          >
            <FileSpreadsheet size={15} />
            {exporting ? 'İndiriliyor…' : 'Excel\'e Aktar'}
          </button>
        </div>
      </div>

      {/* İçerik */}
      {!selectedId ? (
        <EmptyState
          icon={History}
          title="Yukarıdan bir ekipman seç"
          subtitle="Seçtiğin ekipmanın yapılmış tüm bakımları burada listelenecek."
        />
      ) : loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                {['Tarih', 'Görev Başlığı', 'Bakımı Yapan', 'Sorumlu Kişi', 'Ekler', 'Durum'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded-md animate-pulse w-[60%]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Bu ekipman için tamamlanmış bakım yok"
          subtitle={data?.name ? `"${data.name}" henüz hiç bakım almamış görünüyor.` : ''}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {data?.name}
              {data?.units?.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">({data.units.length} birim)</span>
              )}
            </span>
            <span className="text-xs text-slate-400">{tasks.length} kayıt</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  {['Tarih', 'Görev Başlığı', 'Bakımı Yapan', 'Sorumlu Kişi', 'Ekler', 'Durum'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tasks.map(t => {
                  const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.completed;
                  const attCount = t.attachments?.length || 0;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className="hover:bg-amber-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                        {fmtDate(t.completed_at || t.scheduled_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{t.title}</span>
                          {t.is_one_time && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700">
                              <Zap size={9} />
                              Tek Seferlik
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{t.maintained_by || '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{t.responsible_person || '—'}</td>
                      <td className="px-5 py-3.5">
                        {attCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                            <Paperclip size={11} />
                            {attCount}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detay paneli */}
      <SlidePanel
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title="Bakım Detayı"
      >
        <HistoryTaskDetail task={selectedTask} />
      </SlidePanel>
    </Layout>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
      <Icon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
