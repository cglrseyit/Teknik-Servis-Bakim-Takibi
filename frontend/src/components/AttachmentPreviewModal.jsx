import { useEffect, useState } from 'react';
import { X, Download, FileText, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import api from '../api/axios';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
  const [scale, setScale] = useState(1);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    if (!attachment) return;
    setLoading(true);
    setError(false);
    setBlobUrl(null);
    setScale(1);
    setPageNum(1);
    setNumPages(0);

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

  function zoomIn()  { setScale(s => Math.min(s + 0.25, 4)); }
  function zoomOut() { setScale(s => Math.max(s - 0.25, 0.25)); }
  function resetZoom() { setScale(1); }

  if (!attachment) return null;

  const showImage = isImage(attachment.mime_type);
  const showPdf = isPdf(attachment.mime_type);
  const canPreview = showImage || showPdf;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 flex-shrink-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{attachment.filename}</p>

          {/* Toolbar (sadece preview yapılabiliyorsa) */}
          {canPreview && !loading && !error && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {showPdf && numPages > 1 && (
                <>
                  <button
                    onClick={() => setPageNum(p => Math.max(p - 1, 1))}
                    disabled={pageNum <= 1}
                    className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Önceki sayfa"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-medium text-slate-700 px-2 min-w-[60px] text-center">
                    {pageNum} / {numPages}
                  </span>
                  <button
                    onClick={() => setPageNum(p => Math.min(p + 1, numPages))}
                    disabled={pageNum >= numPages}
                    className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Sonraki sayfa"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span className="w-px h-5 bg-slate-300 mx-1" />
                </>
              )}
              <button
                onClick={zoomOut}
                disabled={scale <= 0.25}
                className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-30"
                title="Uzaklaştır"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-medium text-slate-700 px-2 min-w-[44px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                disabled={scale >= 4}
                className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-30"
                title="Yakınlaştır"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={resetZoom}
                className="p-1.5 rounded text-slate-600 hover:bg-white"
                title="Sıfırla"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          )}

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
        <div className="flex-1 overflow-auto bg-slate-100 flex items-start justify-center p-6">
          {loading && <p className="text-slate-500 text-sm py-20">Yükleniyor...</p>}
          {error && <p className="text-red-500 text-sm py-20">Dosya yüklenemedi</p>}
          {!loading && !error && blobUrl && (
            <>
              {showImage && (
                <img
                  src={blobUrl}
                  alt={attachment.filename}
                  style={{ width: `${scale * 100}%`, maxWidth: scale > 1 ? 'none' : '100%', height: 'auto' }}
                  className="shadow-2xl rounded"
                />
              )}
              {showPdf && (
                <Document
                  file={blobUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  onLoadError={() => setError(true)}
                  loading={<p className="text-slate-500 text-sm py-20">PDF yükleniyor...</p>}
                  error={<p className="text-red-500 text-sm py-20">PDF açılamadı</p>}
                >
                  <Page
                    pageNumber={pageNum}
                    scale={scale}
                    className="shadow-2xl"
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              )}
              {!canPreview && (
                <div className="text-center p-10 bg-white rounded-xl">
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
