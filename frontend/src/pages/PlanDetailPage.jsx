import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';

const FREQ_LABELS = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', quarterly: '3 Aylık', semiannual: '6 Aylık', yearly: 'Yıllık', custom: 'Özel' };

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function PlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api.get(`/plans/${id}`).then(r => setPlan(r.data)).catch(() => navigate('/plans'));
  }, [id]);

  if (!plan) return <Layout><div className="text-gray-400 text-sm">Yükleniyor...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate('/plans')} className="text-sm text-gray-400 hover:text-gray-600">← Planlar</button>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-6">{plan.title}</h2>

        {/* Plan Bilgileri */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Plan Bilgileri</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
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
              <p className="text-gray-400 text-xs">Sorumlu Teknisyen</p>
              <p className="font-medium text-gray-800">{plan.assigned_name || '—'}</p>
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
        <div className="bg-amber-50 rounded-xl shadow-sm p-5 mb-5">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-3">Bir Sonraki Bakım</p>
          {plan.next_scheduled_date ? (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-amber-700">{fmt(plan.next_scheduled_date)}</p>
              <p className="text-xs text-amber-400">
                {Math.max(0, Math.ceil((new Date(plan.next_scheduled_date) - new Date()) / 86400000))} gün kaldı
              </p>
            </div>
          ) : (
            <p className="text-amber-400 text-sm">Planlanmış görev yok</p>
          )}
        </div>

        {/* Ekipman linki */}
        <div className="text-right">
          <Link to={`/equipment/${plan.equipment_id}`} className="text-sm text-amber-600 hover:underline">
            Ekipman Detayına Git →
          </Link>
        </div>
      </div>
    </Layout>
  );
}
