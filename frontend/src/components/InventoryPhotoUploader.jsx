import { useRef, useState } from 'react';
import { Upload, X, Star, StarOff, Image as ImageIcon } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

/**
 * Foto yükleyici — hem yeni form (henüz ID yok) hem edit modunda çalışır.
 * - inventoryId null ise: dosyalar local state'te tutulur, parent submit'te FormData'ya ekler
 * - inventoryId varsa: direkt sunucuya yüklenir / silinir, ve onChange ile parent yenilenir
 */
export default function InventoryPhotoUploader({
  inventoryId = null,
  existing = [],
  pending = [],
  onPendingChange,
  onExistingChange,
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragDepth, setDragDepth] = useState(0); // nested element'lerden dolayı counter

  function acceptFiles(files) {
    if (!files || !files.length) return;
    // Sadece resim dosyalarını al
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length === 0) {
      toast?.error('Lütfen sadece resim dosyası yükle');
      return;
    }
    if (imgs.length < files.length) {
      toast?.error(`${files.length - imgs.length} resim olmayan dosya atlandı`);
    }
    if (inventoryId) {
      uploadDirect(imgs);
    } else {
      onPendingChange?.([...pending, ...imgs]);
    }
  }

  function handleFiles(e) {
    acceptFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(d => d + 1);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(d => Math.max(0, d - 1));
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    // dropEffect olmazsa bazı browser'larda drop tetiklenmez
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(0);
    const files = Array.from(e.dataTransfer?.files || []);
    acceptFiles(files);
  }

  const isDragging = dragDepth > 0;

  async function uploadDirect(files) {
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const { data } = await api.post(`/inventory/${inventoryId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onExistingChange?.([...existing, ...data]);
      toast?.success(`${files.length} foto yüklendi`);
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Foto yüklenemedi');
    } finally {
      setUploading(false);
    }
  }

  async function setPrimary(attId) {
    if (!inventoryId) return;
    try {
      await api.put(`/inventory/${inventoryId}/attachments/${attId}/primary`);
      onExistingChange?.(existing.map(a => ({ ...a, is_primary: a.id === attId })));
      toast?.success('Kapak güncellendi');
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Hata');
    }
  }

  async function deleteAtt(attId) {
    if (!inventoryId) return;
    if (!window.confirm('Bu foto silinsin mi?')) return;
    try {
      await api.delete(`/inventory/attachments/${attId}`);
      const remaining = existing.filter(a => a.id !== attId);
      // Kapak silindiyse backend ilk fotoyu kapak yapıyor — UI'da yansıt
      const deletedWasPrimary = existing.find(a => a.id === attId)?.is_primary;
      if (deletedWasPrimary && remaining.length > 0) {
        remaining[0] = { ...remaining[0], is_primary: true };
      }
      onExistingChange?.(remaining);
      toast?.success('Silindi');
    } catch (err) {
      toast?.error(err.response?.data?.error || 'Silinemedi');
    }
  }

  function removePending(idx) {
    onPendingChange?.(pending.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {/* Yükleme alanı — drag & drop + tıkla */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all select-none ${
          isDragging
            ? 'border-amber-500 bg-amber-100/60 ring-4 ring-amber-200/50 scale-[1.01]'
            : uploading
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
              : 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/30'
        }`}
      >
        <Upload size={22} className={isDragging ? 'text-amber-600' : 'text-amber-500'} strokeWidth={isDragging ? 2.4 : 2} />
        <span className={`text-sm font-medium pointer-events-none ${isDragging ? 'text-amber-700' : 'text-slate-600'}`}>
          {uploading
            ? 'Yükleniyor…'
            : isDragging
              ? 'Bırak, ben hallederim'
              : 'Foto sürükle bırak veya tıkla'}
        </span>
        <span className="text-xs text-slate-400 pointer-events-none">JPG, PNG · maks 10 MB / dosya · 10 dosyaya kadar</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {/* Mevcut fotolar (edit modu) */}
      {existing.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Yüklenmiş Fotolar ({existing.length})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {existing.map(a => (
              <div key={a.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
                <img
                  src={`/api/inventory/attachments/${a.id}/download`}
                  alt={a.filename}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                {a.is_primary && (
                  <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white">
                    <Star size={9} fill="white" />
                    KAPAK
                  </span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  {!a.is_primary && (
                    <button
                      type="button"
                      onClick={() => setPrimary(a.id)}
                      className="p-1.5 rounded-md bg-white/90 hover:bg-amber-50 text-amber-600"
                      title="Kapak yap"
                    >
                      <StarOff size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteAtt(a.id)}
                    className="p-1.5 rounded-md bg-white/90 hover:bg-red-50 text-red-600"
                    title="Sil"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bekleyen fotolar (yeni form) */}
      {pending.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Yüklenecek Fotolar ({pending.length})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {pending.map((f, i) => {
              const url = URL.createObjectURL(f);
              return (
                <div key={i} className="relative group rounded-lg overflow-hidden border border-amber-200 bg-amber-50/30 aspect-square">
                  <img src={url} alt={f.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white">
                      <Star size={9} fill="white" />
                      KAPAK
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="absolute top-1 right-1 p-1 rounded-md bg-white/90 hover:bg-red-50 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Listeden çıkar"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {existing.length === 0 && pending.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-400">
          <ImageIcon size={12} />
          Henüz foto yok
        </div>
      )}
    </div>
  );
}
