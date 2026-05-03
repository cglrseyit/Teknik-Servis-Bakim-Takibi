import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', passive: 'bg-gray-100 text-gray-600', maintenance: 'bg-yellow-100 text-yellow-700', broken: 'bg-red-100 text-red-700' };

const TASK_STATUS_CONFIG = {
  pending:     { label: 'Bekliyor',    cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'Devam Ediyor', cls: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: 'Gerçekleşti', cls: 'bg-red-100 text-red-600' },
  skipped:     { label: 'Atlandı',     cls: 'bg-gray-100 text-gray-400' },
  overdue:     { label: 'Gecikmiş',    cls: 'bg-amber-100 text-amber-600' },
  postponed:   { label: 'Ertelendi',   cls: 'bg-amber-100 text-amber-600' },
};

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
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

  if (!equipment) return <Layout><div className="text-gray-400 text-sm">Yükleniyor...</div></Layout>;

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
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{equipment.name}</h2>
          <div className="flex gap-2">
            {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
              <Link to={`/equipment/${id}/edit`} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                Düzenle
              </Link>
            )}
            {user?.role === 'admin' && (
              <button onClick={() => setShowConfirm(true)} className="px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100">
                Sil
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Marka / Model', `${equipment.brand || '—'} / ${equipment.model || '—'}`],
              ['Seri No', equipment.serial_number || '—'],
              ['Kategori', equipment.category || '—'],
              ['Tedarikçi', equipment.supplier || '—'],
              ['Konum', equipment.location || '—'],
              ['Kurulum', fmtDate(equipment.install_date)],
              ['Garanti Bitiş', fmtDate(equipment.warranty_end)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-400 text-xs">{label}</p>
                <p className="text-gray-800 font-medium">{value}</p>
              </div>
            ))}
            <div>
              <p className="text-gray-400 text-xs">Durum</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[equipment.status]}`}>
                {STATUS_LABELS[equipment.status]}
              </span>
            </div>
          </div>
          {equipment.notes && <p className="mt-4 text-sm text-gray-500 border-t pt-3">{equipment.notes}</p>}
        </div>

        {/* Bir Sonraki Bakım */}
        {equipment.next_task ? (
          <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Bir Sonraki Bakım</p>
              <p className="text-lg font-bold text-amber-700">
                {new Date(equipment.next_task.scheduled_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-amber-500 mt-0.5">{equipment.next_task.title}</p>
              {equipment.next_task.assigned_name && (
                <p className="text-xs text-amber-400 mt-0.5">Sorumlu: {equipment.next_task.assigned_name}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-600">
                {Math.max(0, Math.ceil((new Date(equipment.next_task.scheduled_date) - new Date()) / 86400000))}
              </p>
              <p className="text-xs text-amber-400">gün kaldı</p>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bir Sonraki Bakım</p>
            <p className="text-sm text-gray-400">Planlanmış bakım görevi yok</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700">Bakım Periyodu</h3>
          {['admin', 'teknik_muduru', 'order_taker'].includes(user?.role) && (
            <Link to={`/plans/new?equipment_id=${id}`} className="text-xs text-amber-600 hover:underline">
              + Bakım Planı Ekle
            </Link>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Başlık', 'Vade', 'Yetkili Firma', 'Durum'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(!equipment.recent_tasks || equipment.recent_tasks.length === 0) && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">Henüz görev yok</td></tr>
              )}
              {equipment.recent_tasks?.map(t => {
                const sc = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.pending;
                return (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.title}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(t.scheduled_date)}</td>
                    <td className="px-4 py-3 text-gray-500">{t.maintained_by || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
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
    </Layout>
  );
}
