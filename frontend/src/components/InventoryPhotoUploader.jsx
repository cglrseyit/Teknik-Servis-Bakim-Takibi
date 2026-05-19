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

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (inventoryId) {
      // Edit modu — direkt yükle
      uploadDirect(files);
    } else {
      // Yeni form — local state
      onPendingChange?.([...pending, ...files]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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
      {/* Yükleme alanı */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-amber-200 hover:border-amber-400 hover:bg-amber-50/30 rounded-xl transition-colors disabled:opacity-50"
      >
        <Upload size={20} className="text-amber-500" />
        <span className="text-sm font-medium text-slate-600">
          {uploading ? 'Yükleniyor…' : 'Foto seç veya buraya tıkla'}
        </span>
        <span className="text-xs text-slate-400">JPG, PNG · maks 10 MB / dosya</span>
      </button>
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
