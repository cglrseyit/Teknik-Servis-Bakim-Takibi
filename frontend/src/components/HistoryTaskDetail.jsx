import { Zap, Paperclip, FileText, Image as ImageIcon, File } from 'lucide-react';
import downloadAttachment from '../utils/downloadAttachment';

const TASK_STATUS_CONFIG = {
  completed: { label: 'Tamamlandı', cls: 'bg-green-50 text-green-700' },
  skipped:   { label: 'Atlandı',    cls: 'bg-slate-100 text-slate-500' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
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

export default function HistoryTaskDetail({ task }) {
  if (!task) return null;
  const sc = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.completed;

  return (
    <div className="p-1 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="text-base font-semibold text-slate-800 leading-tight">{task.title}</h3>
          {task.is_one_time && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700">
              <Zap size={9} />
              Tek Seferlik
            </span>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.cls}`}>
          {sc.label}
        </span>
      </div>

      {/* Tarihler */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-slate-400 mb-0.5">Planlanan Tarih</div>
          <div className="text-slate-700 font-medium">{fmtDate(task.scheduled_date)}</div>
        </div>
        <div>
          <div className="text-slate-400 mb-0.5">Yapılma Tarihi</div>
          <div className="text-green-700 font-semibold">{fmtDate(task.completed_at)}</div>
        </div>
      </div>

      {/* Detay alanları */}
      {(task.is_one_time || task.maintained_by || task.responsible_person || task.performed_work || task.notes) && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          {task.is_one_time && task.title && (
            <Field label="Arıza Sebebi" value={task.title} bold />
          )}
          {task.maintained_by && <Field label="Bakımı Yapan" value={task.maintained_by} bold />}
          {task.responsible_person && <Field label="Sorumlu Kişi" value={task.responsible_person} bold />}
          {task.performed_work && <Field label="Yapılan İşlem" value={task.performed_work} />}
          {task.notes && <Field label="Notlar" value={task.notes} italic />}
        </div>
      )}

      {/* Ek dosyalar */}
      {task.attachments && task.attachments.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Paperclip size={11} />
            Ek Dosyalar ({task.attachments.length})
          </p>
          <ul className="space-y-1.5">
            {task.attachments.map(a => {
              const Icon = fileIcon(a.mime_type);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => downloadAttachment(a)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 hover:bg-amber-50 rounded-lg text-xs text-slate-700 hover:text-amber-800 transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon size={13} className="flex-shrink-0 text-slate-400" />
                      <span className="truncate text-left">{a.filename}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtSize(a.size_bytes)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, bold, italic }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-400 w-28 flex-shrink-0">{label}</span>
      <span className={`flex-1 ${bold ? 'text-slate-700 font-medium' : italic ? 'text-slate-500 italic' : 'text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}
