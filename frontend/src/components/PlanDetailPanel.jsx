import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const FREQ_LABELS = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', quarterly: '3 Aylık', yearly: 'Yıllık', custom: 'Özel' };

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function PlanDetailPanel({ planId }) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (!planId) return;
    setPlan(null);
    api.get(`/plans/${planId}`).then(r => setPlan(r.data)).catch(() => {});
  }, [planId]);

  if (!plan) return <div className="text-gray-400 text-sm text-center py-10">Yükleniyor...</div>;

  const last = plan.last_maintenance;

  return (
    <div className="space-y-5">
      {/* Ekipman Detayı */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ekipman</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Ekipman Adı</p>
            <p className="font-medium text-gray-800">{plan.equipment_name || '—'}</p>
          </div>
          {plan.location && (
            <div>
              <p className="text-gray-400 text-xs">Konum</p>
              <p className="font-medium text-gray-800">{plan.location}</p>
            </div>
          )}
          {plan.brand && (
            <div>
              <p className="text-gray-400 text-xs">Marka</p>
              <p className="font-medium text-gray-800">{plan.brand}</p>
            </div>
          )}
          {plan.serial_number && (
            <div>
              <p className="text-gray-400 text-xs">Seri No</p>
              <p className="font-medium text-gray-800">{plan.serial_number}</p>
            </div>
          )}
          {plan.category && (
            <div>
              <p className="text-gray-400 text-xs">Kategori</p>
              <p className="font-medium text-gray-800">{plan.category}</p>
            </div>
          )}
        </div>
      </div>

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

      {/* Son Bakım */}
      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Son Bakım</p>
        {last ? (
          <div className="space-y-2 text-sm">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-gray-400">Tarih</p>
                <p className="font-semibold text-gray-800">{fmt(last.completed_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Yapan Personel</p>
                <p className="font-semibold text-gray-800">{last.completed_by_name || '—'}</p>
              </div>
            </div>
            {last.performed_work && (
              <div>
                <p className="text-xs text-gray-400">Yapılan İşlem</p>
                <p className="text-gray-700 bg-gray-50 rounded p-2 text-xs">{last.performed_work}</p>
              </div>
            )}
            {last.maintained_by && (
              <div>
                <p className="text-xs text-gray-400">Bakımı Yapan</p>
                <p className="text-gray-700 bg-gray-50 rounded p-2 text-xs">{last.maintained_by}</p>
              </div>
            )}
            {last.responsible_person && (
              <div>
                <p className="text-xs text-gray-400">Sorumlu Kişi</p>
                <p className="text-gray-700 bg-gray-50 rounded p-2 text-xs">{last.responsible_person}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Henüz bakım yapılmadı</p>
        )}
      </div>

      {/* Sonraki Bakım */}
      <div className="bg-amber-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Sonraki Bakım</p>
        {plan.next_scheduled_date ? (
          <div>
            <p className="text-xl font-bold text-amber-700">{fmt(plan.next_scheduled_date)}</p>
            <p className="text-xs text-amber-400 mt-1">
              {Math.ceil((new Date(plan.next_scheduled_date) - new Date()) / 86400000)} gün kaldı
            </p>
          </div>
        ) : (
          <p className="text-amber-400 text-sm">Planlanmış görev yok</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Link to={`/equipment/${plan.equipment_id}`} className="text-sm text-amber-600 hover:underline">
          Ekipman Detayına Git →
        </Link>
        {plan.is_active && (
          <button
            onClick={() => navigate(`/plans/${planId}/edit`)}
            className="px-4 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
          >
            Düzenle
          </button>
        )}
      </div>
    </div>
  );
}
