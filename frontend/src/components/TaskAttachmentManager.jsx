import { useRef, useState } from 'react';
import { Paperclip, FileText, Image as ImageIcon, File, Upload, X, Loader2 } from 'lucide-react';
import api from '../api/axios';
import downloadAttachment from '../utils/downloadAttachment';
import { useToast } from '../context/ToastContext';

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';

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

/**
 * Belge listele + ekle + sil. Geçmiş bakım kayıtları için.
 * - taskId: maintenance_tasks.id
 * - attachments: mevcut listenin görsel kaynağı (parent state)
 * - canEdit: ekle/sil butonları görünsün mü
 * - onChange(nextList): yükleme/silme sonrası yeni listeyi parent'a bildir
 * - variant: 'compact' (kart içi, az boşluk) | 'panel' (slide panel detay, daha rahat)
 */
export default function TaskAttachmentManager({
  taskId,
  attachments = [],
  canEdit = false,
  onChange,
  variant = 'panel',
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function handleFilesPicked(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    setUploading(true);
    try {
      const fd = new FormData();
      picked.forEach(f => fd.append('files', f));
      const { data } = await api.post(`/tasks/${taskId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange?.([...(attachments || []), ...data]);
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
      onChange?.((attachments || []).filter(a => a.id !== att.id));
      toast?.success('Belge silindi');
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  }

  if (!canEdit && (attachments?.length || 0) === 0) return null;

  const isCompact = variant === 'compact';

  return (
    <div className={isCompact ? 'border-t border-slate-100 pt-3 mt-3' : ''}>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
        <Paperclip size={11} />
        Ek Dosyalar{attachments.length > 0 ? ` (${attachments.length})` : ''}
      </p>

      {attachments.length > 0 ? (
        <ul className={isCompact ? 'space-y-1' : 'space-y-1.5'}>
          {attachments.map(a => {
            const Icon = fileIcon(a.mime_type);
            const isDeleting = deletingId === a.id;

            if (isCompact) {
              return (
                <li key={a.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => downloadAttachment(a)}
                    className="flex-1 flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-50 hover:bg-amber-50 rounded text-xs text-slate-700 hover:text-amber-700 transition-colors"
                    title="İndir"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Icon size={11} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate text-left">{a.filename}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtSize(a.size_bytes)}</span>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      disabled={isDeleting}
                      className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                      title="Belgeyi sil"
                    >
                      {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                    </button>
                  )}
                </li>
              );
            }

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
        canEdit && <p className="text-xs text-slate-400 italic mb-2">Henüz belge eklenmemiş.</p>
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
            className={`${attachments.length > 0 ? 'mt-2' : ''} w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50/60 rounded-lg text-xs font-medium text-amber-700 transition-colors disabled:opacity-60`}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Yükleniyor…' : 'Belge ekle'}
          </button>
        </>
      )}
    </div>
  );
}
