import { useRef, useState } from 'react';
import {
  Zap, Paperclip, FileText, Image as ImageIcon, File,
  CalendarCheck, CalendarClock, Wrench, UserCog, ClipboardCheck,
  StickyNote, AlertTriangle, CheckCircle2, Upload, X, Loader2,
} from 'lucide-react';
import api from '../api/axios';
import downloadAttachment from '../utils/downloadAttachment';
import { useToast } from '../context/ToastContext';

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';

const STATUS_CONFIG = {
  completed: {
    label: 'Tamamlandı',
    badgeCls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    Icon: CheckCircle2,
    iconCls: 'text-emerald-500',
  },
  skipped: {
    label: 'Atlandı',
    badgeCls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    Icon: AlertTriangle,
    iconCls: 'text-slate-400',
  },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fileIcon(mime) {
  if (!mime) return File;
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return File;
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HistoryTaskDetail({ task, canEdit = false, onAttachmentsChange }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [localAtts, setLocalAtts] = useState(null);

  if (!task) return null;
  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.completed;
  const StatusIcon = sc.Icon;
  const attachments = localAtts ?? task.attachments ?? [];

  function notifyChange(next) {
    setLocalAtts(next);
    onAttachmentsChange?.(next);
  }

  async function handleFilesPicked(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    setUploading(true);
    try {
      const fd = new FormData();
      picked.forEach(f => fd.append('files', f));
      const { data } = await api.post(`/tasks/${task.id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notifyChange([...attachments, ...data]);
      toast?.success(`${data.length} belge eklendi`);
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(att) {
    if (!window.confirm(`"${att.filename}" silinsin mi?`)) return;
    setDeletingId(att.id);
    try {
      await api.delete(`/attachments/${att.id}`);
      notifyChange(attachments.filter(a => a.id !== att.id));
      toast?.success('Belge silindi');
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-gradient-to-br from-amber-50/70 via-amber-50/30 to-white border border-amber-100 rounded-2xl p-5 space-y-5">

      {/* ─── Hero: başlık + rozetler + tarihler ─── */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {task.is_one_time && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-100 text-orange-700 ring-1 ring-orange-200">
                <Zap size={10} />
                Tek Seferlik
              </span>
            )}
          </div>
          <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.badgeCls}`}>
            <StatusIcon size={12} className={sc.iconCls} />
            {sc.label}
          </span>
        </div>
        <h2 className="text-lg font-bold text-slate-800 leading-snug break-words mb-4">{task.title}</h2>
        <div className="grid grid-cols-2 gap-3">
          <DateCard
            icon={CalendarClock}
            label="Planlanan Tarih"
            value={fmtDate(task.scheduled_date)}
            tone="slate"
          />
          <DateCard
            icon={CalendarCheck}
            label="Yapılma Tarihi"
            value={fmtDate(task.completed_at)}
            tone="emerald"
          />
        </div>
      </div>

      {/* ─── Arıza Sebebi (yalnızca tek seferlik) ─── */}
      {task.is_one_time && task.title && (
        <SectionDivider icon={AlertTriangle} title="Arıza Sebebi" accent="orange">
          <p className="text-sm text-slate-700 leading-relaxed bg-orange-50/60 border border-orange-100 rounded-lg px-3.5 py-2.5 break-words">
            {task.title}
          </p>
        </SectionDivider>
      )}

      {/* ─── Bakım bilgileri ─── */}
      {(task.maintained_by || task.responsible_person) && (
        <SectionDivider icon={Wrench} title="Bakım Bilgileri">
          <div className="grid grid-cols-1 gap-2">
            {task.maintained_by && (
              <InfoBlock icon={Wrench} label="Bakımı Yapan" value={task.maintained_by} iconCls="text-amber-600" iconBg="bg-amber-50" />
            )}
            {task.responsible_person && (
              <InfoBlock icon={UserCog} label="Sorumlu Kişi" value={task.responsible_person} iconCls="text-violet-600" iconBg="bg-violet-50" />
            )}
          </div>
        </SectionDivider>
      )}

      {/* ─── Yapılan İşlem ─── */}
      {task.performed_work && (
        <SectionDivider icon={ClipboardCheck} title="Yapılan İşlem">
          <p className="text-sm text-slate-700 leading-relaxed bg-white border border-slate-200 rounded-lg px-3.5 py-3 break-words whitespace-pre-wrap shadow-sm">
            {task.performed_work}
          </p>
        </SectionDivider>
      )}

      {/* ─── Notlar ─── */}
      {task.notes && (
        <SectionDivider icon={StickyNote} title="Notlar">
          <p className="text-sm text-slate-600 leading-relaxed bg-white/70 border border-amber-100/60 rounded-lg px-3.5 py-3 italic break-words whitespace-pre-wrap shadow-sm">
            {task.notes}
          </p>
        </SectionDivider>
      )}

      {/* ─── Ek dosyalar ─── */}
      {(attachments.length > 0 || canEdit) && (
        <SectionDivider icon={Paperclip} title={`Ek Dosyalar${attachments.length > 0 ? ` (${attachments.length})` : ''}`}>
          {attachments.length > 0 ? (
            <ul className="space-y-1.5">
              {attachments.map(a => {
                const Icon = fileIcon(a.mime_type);
                const isDeleting = deletingId === a.id;
                return (
                  <li key={a.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadAttachment(a)}
                      className="flex-1 flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg text-xs text-slate-700 hover:text-amber-800 transition-all group shadow-sm"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
                          <Icon size={13} className="text-slate-500 group-hover:text-amber-600" />
                        </span>
                        <span className="truncate text-left font-medium">{a.filename}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 group-hover:text-amber-600">
                        {fmtSize(a.size_bytes)}
                      </span>
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        disabled={isDeleting}
                        className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Belgeyi sil"
                      >
                        {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">Henüz belge eklenmemiş.</p>
          )}

          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED}
                onChange={handleFilesPicked}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => !uploading && fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50/60 rounded-lg text-xs font-medium text-amber-700 transition-colors disabled:opacity-60"
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? 'Yükleniyor…' : 'Belge ekle'}
              </button>
            </>
          )}
        </SectionDivider>
      )}
    </div>
  );
}

/* ──────────── Yardımcı bileşenler ──────────── */

function SectionDivider({ icon: Icon, title, accent = 'slate', children }) {
  const accentCls = {
    slate:  'text-slate-400',
    orange: 'text-orange-500',
  }[accent] || 'text-slate-400';

  return (
    <div className="pt-4 border-t border-amber-100/70">
      <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
        <Icon size={12} className={accentCls} />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DateCard({ icon: Icon, label, value, tone }) {
  const tones = {
    slate:   { bg: 'bg-slate-50',    border: 'border-slate-100',    iconCls: 'text-slate-400',   valueCls: 'text-slate-800'   },
    emerald: { bg: 'bg-emerald-50/60', border: 'border-emerald-100', iconCls: 'text-emerald-500', valueCls: 'text-emerald-700' },
  };
  const t = tones[tone] || tones.slate;

  return (
    <div className={`${t.bg} ${t.border} border rounded-lg px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={t.iconCls} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className={`text-sm font-bold ${t.valueCls}`}>{value}</div>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value, iconCls, iconBg }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-slate-100 rounded-lg px-3.5 py-2.5">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={14} className={iconCls} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</div>
        <div className="text-sm font-medium text-slate-800 break-words leading-relaxed">{value}</div>
      </div>
    </div>
  );
}
