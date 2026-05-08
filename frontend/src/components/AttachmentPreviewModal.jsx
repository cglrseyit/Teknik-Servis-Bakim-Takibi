import { useEffect, useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import api from '../api/axios';

function isImage(mime) {
  return mime?.startsWith('image/');
}
function isPdf(mime) {
  return mime === 'application/pdf';
}

export default function AttachmentPreviewModal({ attachment, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!attachment) return;
    setLoading(true);
    setError(false);
    setBlobUrl(null);

    let revokeUrl = null;
    api.get(`/attachments/${attachment.id}/download`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(r.data);
        revokeUrl = url;
        setBlobUrl(url);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [attachment]);

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (!attachment) return null;

  const canPreview = isImage(attachment.mime_type) || isPdf(attachment.mime_type);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200">
          <p className="text-sm font-semibold text-slate-800 truncate">{attachment.filename}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              disabled={!blobUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <Download size={13} />
              İndir
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-50 flex items-center justify-center">
          {loading && <p className="text-slate-400 text-sm py-20">Yükleniyor...</p>}
          {error && <p className="text-red-500 text-sm py-20">Dosya yüklenemedi</p>}
          {!loading && !error && blobUrl && (
            <>
              {isImage(attachment.mime_type) && (
                <img src={blobUrl} alt={attachment.filename} className="max-w-full max-h-[80vh] object-contain" />
              )}
              {isPdf(attachment.mime_type) && (
                <iframe src={blobUrl} title={attachment.filename} className="w-full h-[80vh] border-0" />
              )}
              {!canPreview && (
                <div className="text-center p-10">
                  <FileText size={48} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 font-medium mb-1">Bu dosya türü tarayıcıda görüntülenemez</p>
                  <p className="text-xs text-slate-400">İndirip bilgisayarınızda açabilirsiniz</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
