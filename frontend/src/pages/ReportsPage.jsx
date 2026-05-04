import { useEffect, useState } from 'react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { History, ClipboardList, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, Zap, Mail } from 'lucide-react';
import Layout from '../components/Layout';
import SlidePanel from '../components/SlidePanel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

function KpiCard({ title, subtitle, value, valueColor, accentBg, accentText, Icon, trend, footer }) {
  const TrendIcon = trend?.dir === 'up' ? ArrowUpRight : trend?.dir === 'down' ? ArrowDownRight : Minus;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl ${accentBg} flex items-center justify-center`}>
          <Icon size={16} className={accentText} strokeWidth={2} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${trend.bg} ${trend.text}`}>
            <TrendIcon size={11} strokeWidth={2.5} />
            {trend.label}
          </span>
        )}
      </div>
      {footer && <p className="text-[11px] text-slate-400 mt-2">{footer}</p>}
    </div>
  );
}

const STATUS_LABELS = { pending: 'Bekliyor', in_progress: 'Devam Eden', completed: 'Tamamlandı', overdue: 'Gecikmiş', skipped: 'Atlandı' };
const PIE_COLORS = { pending: '#94a3b8', in_progress: '#fbbf24', completed: '#22c55e', overdue: '#ef4444', skipped: '#cbd5e1' };
const EQUIP_STATUS_LABELS = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };

const ACTION_LABELS = {
  task_completed:    'Görev Tamamlandı',
  plan_created:      'Plan Oluşturuldu',
  plan_deleted:      'Plan Silindi',
  equipment_created: 'Ekipman Eklendi',
  equipment_deleted: 'Ekipman Silindi',
};

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconBg, iconColor, badge, children }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className={`${iconBg} px-4 py-3 flex items-center justify-between border-b border-slate-200`}>
        <div className="flex items-center gap-2.5">
          <Icon size={14} className={iconColor} strokeWidth={2} />
          <p className="text-sm font-semibold text-slate-700">{title}</p>
        </div>
        {badge}
      </div>
      <div className="bg-white p-4">{children}</div>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [statusDist, setStatusDist] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logDetail, setLogDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [auditTab, setAuditTab] = useState('completed');
  const [testingEmail, setTestingEmail] = useState(false);

  async function handleTestEmail() {
    setTestingEmail(true);
    try {
      const r = await api.post('/reports/test-email', {});
      toast.success(r.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mail gönderilemedi');
    } finally {
      setTestingEmail(false);
    }
  }

  useEffect(() => {
    api.get('/reports/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/reports/by-status').then(r => setStatusDist(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get(`/reports/audit-logs?type=${auditTab}`).then(r => setAuditLogs(r.data)).catch(() => {});
  }, [user, auditTab]);

  function monthTrend(curr, prev) {
    if (prev === 0) return curr > 0 ? { dir: 'up', label: 'Yeni', bg: 'bg-emerald-50', text: 'text-emerald-600' } : null;
    const diff = curr - prev;
    const pct = Math.round((diff / prev) * 100);
    if (diff === 0) return { dir: 'flat', label: '0%', bg: 'bg-slate-100', text: 'text-slate-500' };
    return diff > 0
      ? { dir: 'up', label: `+${pct}%`, bg: 'bg-emerald-50', text: 'text-emerald-600' }
      : { dir: 'down', label: `${pct}%`, bg: 'bg-red-50', text: 'text-red-600' };
  }

  function handleLogClick(log) {
    setSelectedLog(log);
    setLogDetail(null);
    setLoadingDetail(true);
    api.get(`/reports/audit-logs/${log.id}`)
      .then(r => setLogDetail(r.data))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }

  const pieData = statusDist.map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    color: PIE_COLORS[d.status] || '#94a3b8',
  }));

  const trend = stats ? monthTrend(stats.completed_this_month, stats.completed_last_month) : null;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Raporlar</h1>
        <p className="text-sm text-slate-500 mt-0.5">Bakım operasyonu özeti ve geçmiş kayıtlar</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Aktif Bakım Planı"
          subtitle="Periyodik takipte"
          value={stats?.active_plans ?? '—'}
          valueColor="text-slate-900"
          accentBg="bg-violet-50"
          accentText="text-violet-600"
          Icon={ClipboardList}
        />
        <KpiCard
          title="Bu Ay Tamamlanan"
          subtitle="Bakım görevi"
          value={stats?.completed_this_month ?? '—'}
          valueColor="text-emerald-600"
          accentBg="bg-emerald-50"
          accentText="text-emerald-600"
          Icon={CheckCircle2}
          trend={trend}
          footer={stats ? `Geçen ay: ${stats.completed_last_month}` : null}
        />
        <KpiCard
          title="Geciken Görev"
          subtitle="Acil müdahale"
          value={stats?.overdue ?? '—'}
          valueColor={stats?.overdue > 0 ? 'text-red-600' : 'text-slate-900'}
          accentBg="bg-red-50"
          accentText="text-red-600"
          Icon={AlertTriangle}
        />
      </div>

      {/* Donut Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Görev Durum Dağılımı</p>
            <p className="text-xs text-slate-400 mt-0.5">Toplam {pieData.reduce((s, d) => s + d.value, 0)} görev</p>
          </div>
        </div>
        {pieData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Veri yok</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map(d => {
                const total = pieData.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <div key={d.name} className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-sm text-slate-700">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{pct}%</span>
                      <span className="text-sm font-semibold text-slate-800 min-w-[24px] text-right">{d.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Audit Log — sadece admin */}
      {user?.role === 'admin' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Son İşlemler</p>
                <p className="text-xs text-slate-400 mt-0.5">Denetim kaydı — son 50 işlem</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <Mail size={12} strokeWidth={2} />
                  {testingEmail ? 'Gönderiliyor...' : 'Test E-posta'}
                </button>
                <span className="text-[11px] text-slate-400 font-medium">{auditLogs.length} kayıt</span>
              </div>
            </div>
            {/* Sekmeler */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {[
                { value: 'completed', label: 'Tamamlananlar' },
                { value: 'audit',     label: 'Denetimler' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setAuditTab(t.value)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    auditTab === t.value
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {auditLogs.length === 0 ? (
            <div className="py-14 text-center">
              <History size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Henüz kayıt yok</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['İşlem', 'Kullanıcı', 'Detay', 'Tarih', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {auditLogs.map(log => {
                  const isDeleted = log.action === 'equipment_deleted';
                  let equipName = log.equipment_name || null;
                  if (!equipName && isDeleted && log.detail) {
                    try { equipName = JSON.parse(log.detail).equipment?.name || null; } catch { /* plain text */ }
                  }
                  return (
                    <tr
                      key={log.id}
                      onClick={() => handleLogClick(log)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3 font-medium text-slate-700">{ACTION_LABELS[log.action] || log.action}</td>
                      <td className="px-5 py-3 text-slate-500">{log.user_name || '—'}</td>
                      <td className="px-5 py-3 text-slate-700 font-medium truncate max-w-xs">{equipName || '—'}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{fmt(log.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                            <History size={11} />
                            Son İşlem
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Detay →</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Audit Log Detay Modalı */}
      <SlidePanel
        open={Boolean(selectedLog)}
        onClose={() => { setSelectedLog(null); setLogDetail(null); }}
        title={selectedLog ? (ACTION_LABELS[selectedLog.action] || selectedLog.action) : ''}
        subtitle={logDetail?.equipment?.name || selectedLog?.detail || ''}
      >
        {loadingDetail ? (
          <div className="text-slate-400 text-sm text-center py-10">Yükleniyor...</div>
        ) : logDetail ? (
          <div className="space-y-4">

            {/* İşlem özeti */}
            <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Yapan Kullanıcı</p>
                <p className="text-sm font-semibold text-slate-800">{logDetail.user_name || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Tarih</p>
                <p className="text-sm font-medium text-slate-600">{fmt(logDetail.created_at)}</p>
              </div>
            </div>

            {/* Ekipman bilgileri */}
            {logDetail.equipment ? (
              <SectionCard title="Ekipman Bilgileri" icon={ClipboardList} iconBg="bg-slate-50" iconColor="text-slate-500">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="Ekipman Adı" value={logDetail.equipment.name} />
                  <Field label="Kategori" value={logDetail.equipment.category} />
                  <Field label="Marka" value={logDetail.equipment.brand} />
                  <Field label="Tedarikçi" value={logDetail.equipment.supplier} />
                  <Field label="Durum" value={EQUIP_STATUS_LABELS[logDetail.equipment.status] || logDetail.equipment.status} />
                  {logDetail.equipment.maintenance_period && (
                    <Field label="Bakım Periyodu" value={logDetail.equipment.maintenance_period} />
                  )}
                </div>
                {logDetail.equipment.notes && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Ekipman Notları</p>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{logDetail.equipment.notes}</p>
                  </div>
                )}
              </SectionCard>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Ekipman bilgisi mevcut değil</p>
            )}

            {/* Görev detayları (task_completed log'ları için) */}
            {logDetail.task_detail?.title && (
              <SectionCard
                title="Görev Detayları"
                icon={CheckCircle2}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                badge={logDetail.task_detail.is_one_time ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-100 text-orange-700">
                    <Zap size={9} />
                    Tek Seferlik
                  </span>
                ) : null}
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-4">
                  {logDetail.task_detail.scheduled_date && (
                    <Field label="Planlanan Tarih" value={fmtDate(logDetail.task_detail.scheduled_date)} />
                  )}
                  {logDetail.task_detail.completed_at && (
                    <Field label="Tamamlanma" value={fmt(logDetail.task_detail.completed_at)} />
                  )}
                  <Field label="Bakımı Yapan" value={logDetail.task_detail.maintained_by} />
                  <Field label="Sorumlu Kişi" value={logDetail.task_detail.responsible_person} />
                </div>
                {logDetail.task_detail.performed_work && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Yapılan İşlem</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{logDetail.task_detail.performed_work}</p>
                  </div>
                )}
                {logDetail.task_detail.notes && (
                  <div className="pt-4 border-t border-slate-100 mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Notlar</p>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{logDetail.task_detail.notes}</p>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Son tamamlanan görev (sadece equipment_deleted loglarında) */}
            {logDetail.last_task && (
              <SectionCard title="Son Tamamlanan İşlem" icon={History} iconBg="bg-amber-50" iconColor="text-amber-600">
                <div className="space-y-4">
                  <Field label="Görev" value={logDetail.last_task.title} />
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {logDetail.last_task.completed_at && (
                      <Field label="Tamamlanma Tarihi" value={fmt(logDetail.last_task.completed_at)} />
                    )}
                    {logDetail.last_task.completed_by_name && (
                      <Field label="Tamamlayan" value={logDetail.last_task.completed_by_name} />
                    )}
                    {logDetail.last_task.maintained_by && (
                      <Field label="Bakımı Yapan" value={logDetail.last_task.maintained_by} />
                    )}
                    {logDetail.last_task.responsible_person && (
                      <Field label="Sorumlu Kişi" value={logDetail.last_task.responsible_person} />
                    )}
                  </div>
                  {logDetail.last_task.performed_work && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Yapılan İşlem</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{logDetail.last_task.performed_work}</p>
                    </div>
                  )}
                  {logDetail.last_task.notes && (
                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Notlar</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{logDetail.last_task.notes}</p>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}
            {selectedLog?.action === 'equipment_deleted' && !logDetail.last_task && (
              <p className="text-xs text-slate-400 text-center py-2">Bu ekipman için tamamlanmış işlem kaydı bulunamadı</p>
            )}
          </div>
        ) : null}
      </SlidePanel>
    </Layout>
  );
}
