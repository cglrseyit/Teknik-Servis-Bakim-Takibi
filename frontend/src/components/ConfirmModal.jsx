import { AlertTriangle } from 'lucide-react';

const VARIANTS = {
  danger:  { icon: 'text-red-600',    iconBg: 'bg-red-100',    btn: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: 'text-amber-600',  iconBg: 'bg-amber-100',  btn: 'bg-amber-500 hover:bg-amber-600' },
};

export default function ConfirmModal({ open, title, message, confirmLabel = 'Evet, Sil', variant = 'danger', onConfirm, onCancel }) {
  if (!open) return null;
  const v = VARIANTS[variant] || VARIANTS.danger;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-modal-in">
        <div className="flex flex-col items-center text-center">
          <div className={`w-12 h-12 ${v.iconBg} rounded-full flex items-center justify-center mb-4`}>
            <AlertTriangle className={`w-6 h-6 ${v.icon}`} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
          {message && <p className="text-sm text-slate-500 mb-6">{message}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors ${v.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
