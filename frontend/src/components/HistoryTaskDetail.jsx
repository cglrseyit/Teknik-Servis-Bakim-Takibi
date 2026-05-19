import {
  Zap, Paperclip, FileText, Image as ImageIcon, File,
  CalendarCheck, CalendarClock, Wrench, UserCog, ClipboardCheck,
  StickyNote, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import downloadAttachment from '../utils/downloadAttachment';

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

export default function HistoryTaskDetail({ task }) {
  if (!task) return null;
  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.completed;
  const StatusIcon = sc.Icon;

  return (
    <div className="space-y-4">

      {/* ─── Hero ─── */}
      <div className="bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-white border border-amber-100 rounded-2xl p-5">
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
        <h2 className="text-lg font-bold text-slate-800 leading-snug break-words">{task.title}</h2>
      </div>

      {/* ─── Tarih bilgileri ─── */}
      <Section icon={CalendarClock} title="Tarih Bilgileri">
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
      </Section>

      {/* ─── Arıza Sebebi (yalnızca tek seferlik) ─── */}
      {task.is_one_time && task.title && (
        <Section icon={AlertTriangle} title="Arıza Sebebi" accent="orange">
          <p className="text-sm text-slate-700 leading-relaxed bg-orange-50/50 border border-orange-100 rounded-lg px-3.5 py-2.5 break-words">
            {task.title}
          </p>
        </Section>
      )}

      {/* ─── Bakım bilgileri ─── */}
      {(task.maintained_by || task.responsible_person) && (
        <Section icon={Wrench} title="Bakım Bilgileri">
          <div className="grid grid-cols-1 gap-2">
            {task.maintained_by && (
              <InfoBlock icon={Wrench} label="Bakımı Yapan" value={task.maintained_by} iconCls="text-amber-600" iconBg="bg-amber-50" />
            )}
            {task.responsible_person && (
              <InfoBlock icon={UserCog} label="Sorumlu Kişi" value={task.responsible_person} iconCls="text-violet-600" iconBg="bg-violet-50" />
            )}
          </div>
        </Section>
      )}

      {/* ─── Yapılan İşlem ─── */}
      {task.performed_work && (
        <Section icon={ClipboardCheck} title="Yapılan İşlem">
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg px-3.5 py-3 break-words whitespace-pre-wrap">
            {task.performed_work}
          </p>
        </Section>
      )}

      {/* ─── Notlar ─── */}
      {task.notes && (
        <Section icon={StickyNote} title="Notlar">
          <p className="text-sm text-slate-600 leading-relaxed bg-amber-50/40 border border-amber-100/60 rounded-lg px-3.5 py-3 italic break-words whitespace-pre-wrap">
            {task.notes}
          </p>
        </Section>
      )}

      {/* ─── Ek dosyalar ─── */}
      {task.attachments && task.attachments.length > 0 && (
        <Section icon={Paperclip} title={`Ek Dosyalar (${task.attachments.length})`}>
          <ul className="space-y-1.5">
            {task.attachments.map(a => {
              const Icon = fileIcon(a.mime_type);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => downloadAttachment(a)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg text-xs text-slate-700 hover:text-amber-800 transition-all group"
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
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}

/* ──────────── Yardımcı bileşenler ──────────── */

function Section({ icon: Icon, title, accent = 'slate', children }) {
  const accentCls = {
    slate:  'text-slate-400',
    orange: 'text-orange-500',
  }[accent] || 'text-slate-400';

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
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
