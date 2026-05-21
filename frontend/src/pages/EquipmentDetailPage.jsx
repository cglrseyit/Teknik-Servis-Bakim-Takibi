import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, Clock, AlertCircle, SkipForward, CalendarClock, FileSpreadsheet, Plus, ChevronRight, Trash2, Zap, History } from 'lucide-react';
import SlidePanel from '../components/SlidePanel';
import HistoricalRecordPanel from '../components/HistoricalRecordPanel';
import TaskAttachmentManager from '../components/TaskAttachmentManager';

const STATUS_LABELS = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };
const STATUS_COLORS = {
  active:      'bg-green-100 text-green-700',
  passive:     'bg-slate-100 text-slate-500',
  maintenance: 'bg-amber-100 text-amber-700',
  broken:      'bg-red-100 text-red-600',
};
const UNIT_STATUS_OPTIONS = ['active', 'passive', 'maintenance', 'broken'];

const PERIOD_LABELS = {
  monthly:    'Aylık',
  quarterly:  '3 Aylık',
  biannual:   '6 Aylık',
  semiannual: '6 Aylık',
  yearly:     'Yıllık',
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
  const [deleteUnitConfirm, setDeleteUnitConfirm] = useState(null);
  const [units, setUnits] = useState([]);
  const [siblings, setSiblings] = useState([]);
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitStatus, setNewUnitStatus] = useState('active');
  const [savingUnit, setSavingUnit] = useState(false);
  const [historicalPanelOpen, setHistoricalPanelOpen] = useState(false);

  function reload() {
    api.get(`/equipment/${id}`).then(r => {
      setEquipment(r.data);
      setUnits(r.data.units || []);
      setSiblings(r.data.siblings || []);
    }).catch(() => navigate('/equipment'));
  }

  useEffect(() => { reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUnitStatusChange(unitId, status) {
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, status } : u));
    setSiblings(prev => prev.map(u => u.id === unitId ? { ...u, status } : u));
    try {
      await api.patch(`/equipment/${unitId}/status`, { status });
    } catch {
      reload();
    }
  }

  async function handleAddUnit(e) {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    setSavingUnit(true);
    try {
      await api.post('/equipment', { name: newUnitName.trim(), status: newUnitStatus, parent_id: id });
      setNewUnitName('');
      setNewUnitStatus('active');
      setAddingUnit(false);
      reload();
    } catch {
      // ignore
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleDelete() {
    await api.delete(`/equipment/${id}`);
    navigate('/equipment');
  }

  async function handleDeleteUnit() {
    if (!deleteUnitConfirm) return;
    try {
      await api.delete(`/equipment/${deleteUnitConfirm.id}`);
      setDeleteUnitConfirm(null);
      reload();
    } catch { /* ignore */ }
  }

  async function exportHistory() {
    // Birim sayfasındaysa grubu (parent) export et — her zaman toplu aktarım
    const exportId = equipment?.parent_id || id;
    try {
      const r = await api.get(`/exports/equipment/${exportId}/history.xlsx`, { responseType: 'blob' });
      const cd = r.headers['content-disposition'] || '';
      const match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const filename = match ? decodeURIComponent(match[1]) : `${equipment?.name || 'ekipman'}-bakim-gecmisi.xlsx`;
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  if (!equipment) return <Layout><div className="p-6 text-slate-400 text-sm">Yükleniyor...</div></Layout>;

  const upcomingTasks = equipment.upcoming_tasks || [];
  const completedTasks = equipment.completed_tasks || [];
  const canEditAttachments = ['admin', 'teknik_muduru', 'order_taker'].includes(user?.role);

  function updateTaskAttachments(taskId, nextList) {
    setEquipment(eq => eq ? {
      ...eq,
      completed_tasks: (eq.completed_tasks || []).map(t =>
        t.id === taskId ? { ...t, attachments: nextList } : t
      ),
    } : eq);
  }
  const isGroup = units.length > 0;
  const isUnit = Boolean(equipment.parent_id);
  // Grup ise ilk birimi "ana ekipman" olarak ön panelde göster, kalanları Birimler listesinde bırak
  const mainUnit = isGroup ? units[0] : null;
  const restUnits = isGroup ? units.slice(1) : [];
  // Birim detayında: aynı gruptaki diğer birimler — "Diğer Birimler" kutusu burada da görünsün
  const otherUnits = isUnit ? siblings.filter(u => u.id !== equipment.id) : [];
  const unitListRows = isGroup ? restUnits : otherUnits;
  const par = equipment.parent; // unit ise parent'ın tam verisi artık geliyor
  const info = {
    brand:              mainUnit?.brand              || equipment.brand              || par?.brand,
    location:           mainUnit?.location           || equipment.location           || par?.location,
    supplier:           par?.supplier                || equipment.supplier          || mainUnit?.supplier,
    model:              mainUnit?.model              || equipment.model              || par?.model,
    serial_number:      mainUnit?.serial_number      || equipment.serial_number,
    notes:              mainUnit?.notes              || equipment.notes              || par?.notes,
    maintenance_period: equipment.maintenance_period || mainUnit?.maintenance_period || par?.maintenance_period,
  };

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
      <ConfirmModal
        open={Boolean(deleteUnitConfirm)}
        title="Birimi Sil"
        message={`"${deleteUnitConfirm?.name}" birimini kalıcı olarak silmek istediğinize emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={handleDeleteUnit}
        onCancel={() => setDeleteUnitConfirm(null)}
      />

      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            {isUnit && equipment.parent && (
              <Link to={`/equipment/${equipment.parent.id}`} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 mb-1.5">
                <ChevronRight size={12} className="rotate-180" />
                {equipment.parent.name}
              </Link>
            )}
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">{equipment.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[equipment.status]}`}>
                {STATUS_LABELS[equipment.status]}
              </span>
              {isGroup && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                  {units.length} birim
                </span>
              )}
            </div>
            {info.brand && <p className="text-sm text-slate-400 mt-0.5">{info.brand}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportHistory}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors"
              title="Bakım geçmişini Excel olarak indir"
            >
              <FileSpreadsheet size={14} />
              Excel'e Aktar
            </button>
            {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
              <Link
                to={`/equipment/${id}/edit`}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Düzenle
              </Link>
            )}
            {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
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

            {/* Ekipman bilgileri + Bir sonraki bakım */}
            <div className="bg-white rounded-xl border border-amber-100/60 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700/50">Ekipman Bilgileri</p>
                {(() => {
                  const displayUnit = mainUnit || (isUnit ? equipment : null);
                  if (!displayUnit) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{displayUnit.name}</span>
                      <select
                        value={displayUnit.status}
                        onChange={e => handleUnitStatusChange(displayUnit.id, e.target.value)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${STATUS_COLORS[displayUnit.status] || 'bg-slate-100 text-slate-500'}`}
                      >
                        {UNIT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                      {mainUnit && ['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
                        <button
                          onClick={() => setDeleteUnitConfirm({ id: mainUnit.id, name: mainUnit.name })}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                          title="Bu birimi sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="Tedarikçi"       value={info.supplier} />
                <InfoRow label="Konum"           value={info.location} />
                <InfoRow label="Model"           value={info.model} />
                <InfoRow label="Seri No"         value={info.serial_number} />
                <InfoRow label="Bakım Periyodu"  value={PERIOD_LABELS[info.maintenance_period] || info.maintenance_period} />
              </div>
              {info.notes && (
                <p className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500 leading-relaxed">
                  {info.notes}
                </p>
              )}

              {/* Bir sonraki bakım — aynı çerçeve içinde alt blok */}
              <div className="mt-5 pt-5 border-t border-slate-100">
                {equipment.next_task ? (
                  <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 border border-amber-200/60 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mb-1">Bir Sonraki Bakım</p>
                      <p className="text-lg font-bold text-amber-800">
                        {new Date(equipment.next_task.scheduled_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-amber-600 mt-0.5">{equipment.next_task.title}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-3xl font-bold text-amber-600">
                        {Math.max(0, Math.ceil((new Date(equipment.next_task.scheduled_date) - new Date()) / 86400000))}
                      </p>
                      <p className="text-xs text-amber-400">gün kaldı</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Bir Sonraki Bakım</p>
                    <p className="text-sm text-slate-400">Planlanmış bakım görevi yok</p>
                  </div>
                )}
              </div>
            </div>

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
                  equipment.active_plan
                    ? <Link to={`/plans/${equipment.active_plan.id}/edit`} className="text-xs text-amber-600 hover:text-amber-700 font-medium">Bakım Planını Düzenle</Link>
                    : <Link to={`/plans/new?equipment_id=${id}`} className="text-xs text-amber-600 hover:text-amber-700 font-medium">+ Bakım Planı Ekle</Link>
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

          {/* ─── RIGHT: Birimler (grup ise) + Bakım Geçmişi ─── */}
          <div className="space-y-6">

            {/* Birimler */}
            {(isGroup || isUnit) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Diğer Birimler
                    <span className="ml-1.5 text-xs font-normal text-slate-400">({unitListRows.length})</span>
                  </h3>
                  {isGroup && ['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
                    <button
                      onClick={() => { setAddingUnit(v => !v); setNewUnitName(`${equipment.name} #${units.length + 1}`); }}
                      className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      <Plus size={13} />
                      Birim Ekle
                    </button>
                  )}
                </div>

                {isGroup && addingUnit && (
                  <form onSubmit={handleAddUnit} className="mb-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <input
                      autoFocus
                      value={newUnitName}
                      onChange={e => setNewUnitName(e.target.value)}
                      placeholder="Birim adı"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <select
                      value={newUnitStatus}
                      onChange={e => setNewUnitStatus(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none"
                    >
                      {UNIT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    <button type="submit" disabled={savingUnit} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors">
                      {savingUnit ? '…' : 'Kaydet'}
                    </button>
                    <button type="button" onClick={() => setAddingUnit(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">
                      İptal
                    </button>
                  </form>
                )}

                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Birim</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Seri No</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lokasyon</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Durum</th>
                        {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && <th className="px-2 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {unitListRows.length === 0 ? (
                        <tr>
                          <td colSpan={['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) ? 5 : 4} className="text-center py-6 text-slate-400 text-xs">
                            {isGroup ? 'Başka birim yok' : 'Bu grupta başka birim yok'}
                          </td>
                        </tr>
                      ) : unitListRows.map(u => (
                        <tr
                          key={u.id}
                          onClick={() => navigate(`/equipment/${u.id}`)}
                          className="hover:bg-amber-50/60 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800 text-xs">{u.name}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{u.serial_number || '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{u.location || '—'}</td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <select
                              value={u.status}
                              onChange={e => handleUnitStatusChange(u.id, e.target.value)}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${STATUS_COLORS[u.status] || 'bg-slate-100 text-slate-500'}`}
                            >
                              {UNIT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                          </td>
                          {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
                            <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setDeleteUnitConfirm({ id: u.id, name: u.name })}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                title="Bu birimi sil"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bakım Geçmişi */}
            <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Bakım Geçmişi
                {completedTasks.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">({completedTasks.length})</span>
                )}
              </h3>
              <button
                onClick={() => setHistoricalPanelOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-lg transition-colors shadow-sm"
                title="Eski tarihli bir bakım kaydı ekle"
              >
                <History size={13} />
                Geçmiş Kayıt Ekle
              </button>
            </div>

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
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{t.title}</p>
                          {t.is_one_time && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700">
                              <Zap size={9} />
                              Tek Seferlik
                            </span>
                          )}
                        </div>
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
                            <span className="text-green-600 font-medium">Yapıldı: {fmtDate(t.completed_at)}</span>
                          </>
                        )}
                      </div>

                      {/* Detail rows */}
                      {(t.is_one_time || t.maintained_by || t.responsible_person || t.performed_work || t.notes) && (
                        <div className="border-t border-slate-100 pt-3 space-y-2">
                          {t.is_one_time && t.title && (
                            <div className="flex gap-2 text-xs">
                              <span className="text-slate-400 w-24 flex-shrink-0">Arıza Sebebi</span>
                              <span className="text-slate-700 font-medium">{t.title}</span>
                            </div>
                          )}
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

                      {/* Ek dosyalar — ekle / sil */}
                      {(t.attachments?.length > 0 || canEditAttachments) && (
                        <TaskAttachmentManager
                          taskId={t.id}
                          attachments={t.attachments || []}
                          canEdit={canEditAttachments}
                          onChange={(next) => updateTaskAttachments(t.id, next)}
                          variant="compact"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <SlidePanel
        open={historicalPanelOpen}
        onClose={() => setHistoricalPanelOpen(false)}
        title="Geçmiş Bakım Kaydı Ekle"
        subtitle={equipment?.name}
      >
        {historicalPanelOpen && (
          <HistoricalRecordPanel
            equipmentId={Number(id)}
            equipmentName={equipment?.name || ''}
            unitCount={units.length}
            hasActivePlan={Boolean(equipment?.active_plan)}
            onCreated={() => {
              setHistoricalPanelOpen(false);
              reload();
            }}
          />
        )}
      </SlidePanel>

    </Layout>
  );
}
