import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ConfirmModal from './ConfirmModal';

const FREQ_LABELS = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', quarterly: '3 Aylık', semiannual: '6 Aylık', yearly: 'Yıllık', custom: 'Özel' };

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function PlanDetailPanel({ planId, onDeleted }) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!planId) return;
    setPlan(null);
    api.get(`/plans/${planId}`).then(r => setPlan(r.data)).catch(() => {});
  }, [planId]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/plans/${planId}`);
      onDeleted?.();
    } catch {
      setDeleting(false);
    }
  }

  if (!plan) return <div className="text-gray-400 text-sm text-center py-10">Yükleniyor...</div>;

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={showConfirm}
        title="Planı Sil"
        message={`"${plan.title}" planını ve bağlı tüm bekleyen görevleri kalıcı olarak silmek istediğinize emin misiniz?`}
        confirmLabel="Evet, Sil"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Plan Bilgileri */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Plan Bilgileri</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Ekipman</p>
            <p className="font-medium text-gray-800">{plan.equipment_name || '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Periyot</p>
            <p className="font-medium text-gray-800">
              {FREQ_LABELS[plan.frequency_type]}
              {plan.frequency_type === 'custom' ? ` (${plan.frequency_days} gün)` : ''}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Durum</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {plan.is_active ? 'Aktif' : 'Pasif'}
            </span>
          </div>
          {plan.description && (
            <div className="col-span-2">
              <p className="text-gray-400 text-xs">Açıklama</p>
              <p className="text-gray-700">{plan.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sonraki Bakım */}
      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Bir Sonraki Bakım</p>
        {plan.next_scheduled_date ? (
          <div>
            <p className="text-xl font-bold text-amber-700">{fmt(plan.next_scheduled_date)}</p>
            <p className="text-xs text-amber-400 mt-1">
              {Math.max(0, Math.ceil((new Date(plan.next_scheduled_date) - new Date()) / 86400000))} gün kaldı
            </p>
          </div>
        ) : (
          <p className="text-amber-400 text-sm">Planlanmış görev yok</p>
        )}
      </div>

      {/* Alt butonlar */}
      <div className="flex items-center justify-between">
        <Link to={`/equipment/${plan.equipment_id}`} className="text-sm text-amber-600 hover:underline">
          Ekipman Detayına Git →
        </Link>
        <div className="flex gap-2">
          {plan.is_active && (
            <button
              onClick={() => navigate(`/plans/${planId}/edit`)}
              className="px-4 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
            >
              Düzenle
            </button>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={deleting}
            className="px-4 py-1.5 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}
