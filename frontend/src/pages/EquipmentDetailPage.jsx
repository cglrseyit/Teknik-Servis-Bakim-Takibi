import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, Clock, AlertCircle, SkipForward, CalendarClock } from 'lucide-react';

const STATUS_LABELS = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };
const STATUS_COLORS = {
  active:      'bg-green-100 text-green-700',
  passive:     'bg-slate-100 text-slate-500',
  maintenance: 'bg-amber-100 text-amber-700',
  broken:      'bg-red-100 text-red-600',
};

const PERIOD_LABELS = {
  monthly:   'Aylık',
  quarterly: '3 Aylık',
  biannual:  '6 Aylık',
  yearly:    'Yıllık',
};

const TASK_STATUS_CONFIG = {
  pending:     { label: 'Bekliyor',     cls: 'bg-slate-100 text-slate-500',  Icon: Clock },
  in_progress: { label: 'Devam Ediyor', cls: 'bg-yellow-100 text-yellow-700', Icon: Clock },
  overdue:     { label: 'Gecikmiş',     cls: 'bg-red-100 text-red-600',       Icon: AlertCircle },
  postponed:   { label: 'Ertelendi',    cls: 'bg-amber-100 text-amber-600',   Icon: CalendarClock },
  completed:   { label: 'Gerçekleşti', cls: 'bg-green-100 text-green-700',   Icon: CheckCircle2 },
  skipped:     { label: 'Atlandı',      cls: 'bg-slate-100 text-slate-400',   Icon: SkipForward },
};

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  );
}

export default function EquipmentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    api.get(`/equipment/${id}`).then(r => setEquipment(r.data)).catch(() => navigate('/equipment'));
  }, [id, navigate]);

  async function handleDelete() {
    await api.delete(`/equipment/${id}`);
    navigate('/equipment');
  }

  if (!equipment) return <Layout><div className="p-6 text-slate-400 text-sm">Yükleniyor...</div></Layout>;

  const upcomingTasks = equipment.upcoming_tasks || [];
  const completedTasks = equipment.completed_tasks || [];

  return (
    <Layout>
      <ConfirmModal
        open={showConfirm}
        title="Ekipmanı Sil"
        message={`"${equipment.name}" ekipmanını ve tüm bakım geçmişini kalıcı olarak silmek istediğinize emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">{equipment.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[equipment.status]}`}>
                {STATUS_LABELS[equipment.status]}
              </span>
            </div>
            {equipment.brand && <p className="text-sm text-slate-400 mt-0.5">{equipment.brand}</p>}
          </div>
          <div className="flex gap-2">
            {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
              <Link
                to={`/equipment/${id}/edit`}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Düzenle
              </Link>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-red-50 border border-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
              >
                Sil
              </button>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-6 items-start">

          {/* ─── LEFT: Ekipman detayları ─── */}
          <div className="space-y-4">

            {/* Ekipman bilgileri */}
            <div className="bg-white rounded-xl border border-amber-100/60 shadow-sm p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700/50 mb-4">Ekipman Bilgileri</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="Kategori"        value={equipment.category} />
                <InfoRow label="Tedarikçi"       value={equipment.supplier} />
                <InfoRow label="Bakım Periyodu"  value={PERIOD_LABELS[equipment.maintenance_period] || equipment.maintenance_period} />
              </div>
              {equipment.notes && (
                <p className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500 leading-relaxed">
                  {equipment.notes}
                </p>
              )}
            </div>

            {/* Bir sonraki bakım */}
            {equipment.next_task ? (
              <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 border border-amber-200/60 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mb-1">Bir Sonraki Bakım</p>
                  <p className="text-lg font-bold text-amber-800">
                    {new Date(equipment.next_task.scheduled_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-amber-600 mt-0.5">{equipment.next_task.title}</p>
                  {equipment.next_task.assigned_name && (
                    <p className="text-xs text-amber-500 mt-0.5">Atanan: {equipment.next_task.assigned_name}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-3xl font-bold text-amber-600">
                    {Math.max(0, Math.ceil((new Date(equipment.next_task.scheduled_date) - new Date()) / 86400000))}
                  </p>
                  <p className="text-xs text-amber-400">gün kaldı</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Bir Sonraki Bakım</p>
                <p className="text-sm text-slate-400">Planlanmış bakım görevi yok</p>
              </div>
            )}

            {/* Yaklaşan / Aktif görevler */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Yaklaşan Görevler
                  {upcomingTasks.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">({upcomingTasks.length})</span>
                  )}
                </h3>
                {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
                  <Link to={`/plans/new?equipment_id=${id}`} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                    + Bakım Planı Ekle
                  </Link>
                )}
              </div>
              <div className="bg-white rounded-xl border border-amber-100/60 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      {['Başlık', 'Vade', 'Yetkili Firma', 'Durum'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {upcomingTasks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Aktif görev yok</td>
                      </tr>
                    ) : (
                      upcomingTasks.map(t => {
                        const sc = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.pending;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800 text-xs">{t.title}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(t.scheduled_date)}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{t.maintained_by || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.cls}`}>
                                {sc.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Tamamlanan bakımlar ─── */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Bakım Geçmişi
              {completedTasks.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">({completedTasks.length})</span>
              )}
            </h3>

            {completedTasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-amber-100/60 shadow-sm p-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Tamamlanmış bakım kaydı yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedTasks.map(t => {
                  const isSkipped = t.status === 'skipped';
                  return (
                    <div
                      key={t.id}
                      className={`bg-white rounded-xl border shadow-sm p-4 border-l-[3px] ${
                        isSkipped
                          ? 'border-slate-100 border-l-slate-300'
                          : 'border-amber-100/60 border-l-green-400'
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{t.title}</p>
                        <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${TASK_STATUS_CONFIG[t.status]?.cls || ''}`}>
                          {TASK_STATUS_CONFIG[t.status]?.label}
                        </span>
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-4 mb-3 text-[11px] text-slate-400">
                        <span>Planlanan: {fmtDate(t.scheduled_date)}</span>
                        {t.completed_at && (
                          <>
                            <span className="text-slate-200">•</span>
                            <span className="text-green-600 font-medium">Yapıldı: {fmtDateTime(t.completed_at)}</span>
                          </>
                        )}
                      </div>

                      {/* Detail rows */}
                      {(t.maintained_by || t.responsible_person || t.performed_work || t.notes) && (
                        <div className="border-t border-slate-100 pt-3 space-y-2">
                          {t.maintained_by && (
                            <div className="flex gap-2 text-xs">
                              <span className="text-slate-400 w-24 flex-shrink-0">Bakımı Yapan</span>
                              <span className="text-slate-700 font-medium">{t.maintained_by}</span>
                            </div>
                          )}
                          {t.responsible_person && (
                            <div className="flex gap-2 text-xs">
                              <span className="text-slate-400 w-24 flex-shrink-0">Sorumlu Kişi</span>
                              <span className="text-slate-700 font-medium">{t.responsible_person}</span>
                            </div>
                          )}
                          {t.performed_work && (
                            <div className="flex gap-2 text-xs">
                              <span className="text-slate-400 w-24 flex-shrink-0">Yapılan İşlem</span>
                              <span className="text-slate-700">{t.performed_work}</span>
                            </div>
                          )}
                          {t.notes && (
                            <div className="flex gap-2 text-xs">
                              <span className="text-slate-400 w-24 flex-shrink-0">Notlar</span>
                              <span className="text-slate-500 italic">{t.notes}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
