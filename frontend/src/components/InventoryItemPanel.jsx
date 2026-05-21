import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Tag, MapPin, Wrench, FileBadge, Calendar, ShieldCheck,
  Building2, StickyNote, Pencil, Image as ImageIcon, Hash,
  History, ArrowRight, Zap, Gauge, CalendarDays, Hourglass, Layers,
} from 'lucide-react';
import api from '../api/axios';
import AuthImage from './AuthImage';

const STATUS_CONFIG = {
  active:      { label: 'Aktif',      cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  passive:     { label: 'Pasif',      cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  maintenance: { label: 'Bakımda',    cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  broken:      { label: 'Arızalı',    cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const FIELD_LABELS = { status: 'Durum', location: 'Lokasyon' };

function displayValue(field, value) {
  if (value == null || value === '') return field === 'location' ? 'Belirsiz' : '—';
  if (field === 'status') return STATUS_CONFIG[value]?.label || value;
  return value;
}

export default function InventoryItemPanel({ itemId, canEdit }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    api.get(`/inventory/${itemId}`)
      .then(r => setItem(r.data))
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [itemId]);

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Yükleniyor…</div>;
  }
  if (!item) {
    return <div className="text-sm text-slate-400 py-8 text-center">Kayıt bulunamadı</div>;
  }

  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
  const atts = item.attachments || [];

  return (
    <div className="bg-gradient-to-br from-amber-50/70 via-amber-50/30 to-white border border-amber-100 rounded-2xl p-5 space-y-5">

      {/* Hero */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {item.inventory_no && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                <Hash size={10} />
                {item.inventory_no}
              </span>
            )}
            {item.category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                <Tag size={10} />
                {item.category}
              </span>
            )}
            {item.quantity > 1 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                <Layers size={10} />
                {item.quantity} adet
              </span>
            )}
          </div>
          <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.cls}`}>
            {status.label}
          </span>
        </div>
        <h2 className="text-lg font-bold text-slate-800 leading-snug break-words mb-1">{item.name}</h2>
        {(item.brand || item.model) && (
          <p className="text-sm text-slate-500">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
        )}
      </div>

      {/* Galeri */}
      {atts.length > 0 && (
        <SectionDivider icon={ImageIcon} title={`Fotolar (${atts.length})`}>
          <div className="grid grid-cols-3 gap-2">
            {atts.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setLightbox(a)}
                className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-amber-400 transition-colors"
              >
                <AuthImage
                  apiPath={`/inventory/attachments/${a.id}/download`}
                  alt={a.filename}
                  className="w-full h-full object-cover"
                />
                {a.is_primary && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white">
                    KAPAK
                  </span>
                )}
              </button>
            ))}
          </div>
        </SectionDivider>
      )}

      {/* Lokasyon & Tedarikçi */}
      {(item.location || item.supplier) && (
        <SectionDivider icon={MapPin} title="Lokasyon & Tedarikçi">
          <div className="grid grid-cols-1 gap-2">
            {item.location && <InfoBlock icon={MapPin} label="Lokasyon" value={item.location} iconCls="text-rose-600" iconBg="bg-rose-50" />}
            {item.supplier && <InfoBlock icon={Building2} label="Tedarikçi" value={item.supplier} iconCls="text-violet-600" iconBg="bg-violet-50" />}
          </div>
        </SectionDivider>
      )}

      {/* Teknik bilgiler */}
      {(item.brand || item.model || item.serial_number) && (
        <SectionDivider icon={Wrench} title="Teknik Bilgiler">
          <div className="grid grid-cols-1 gap-2">
            {item.brand && <InfoBlock icon={Tag} label="Marka" value={item.brand} iconCls="text-amber-600" iconBg="bg-amber-50" />}
            {item.model && <InfoBlock icon={FileBadge} label="Model" value={item.model} iconCls="text-slate-600" iconBg="bg-slate-100" />}
            {item.serial_number && <InfoBlock icon={Hash} label="Seri Numarası" value={item.serial_number} iconCls="text-blue-600" iconBg="bg-blue-50" />}
          </div>
        </SectionDivider>
      )}

      {/* Tarihler */}
      {(item.install_date || item.warranty_end) && (
        <SectionDivider icon={Calendar} title="Tarih Bilgileri">
          <div className="grid grid-cols-2 gap-3">
            {item.install_date && <DateCard icon={Calendar}     label="Kurulum"      value={fmtDate(item.install_date)} tone="slate" />}
            {item.warranty_end  && <DateCard icon={ShieldCheck} label="Garanti Bitiş" value={fmtDate(item.warranty_end)}  tone="emerald" />}
          </div>
        </SectionDivider>
      )}

      {/* Notlar */}
      {item.notes && (
        <SectionDivider icon={StickyNote} title="Notlar">
          <p className="text-sm text-slate-600 leading-relaxed bg-white/70 border border-amber-100/60 rounded-lg px-3.5 py-3 italic break-words whitespace-pre-wrap shadow-sm">
            {item.notes}
          </p>
        </SectionDivider>
      )}

      {/* Enerji / Kullanım */}
      {(item.power != null || item.power_unit || item.annual_days != null || item.lifespan_years != null) && (
        <SectionDivider icon={Zap} title="Enerji / Kullanım">
          <div className="grid grid-cols-1 gap-2">
            {item.power != null && (
              <InfoBlock icon={Gauge} label="Güç" value={`${item.power}${item.power_unit ? ' ' + item.power_unit : ''}`} iconCls="text-amber-600" iconBg="bg-amber-50" />
            )}
            {item.annual_days != null && (
              <InfoBlock icon={CalendarDays} label="Yıllık Ort. Kullanılan Gün" value={`${item.annual_days} gün`} iconCls="text-emerald-600" iconBg="bg-emerald-50" />
            )}
            {item.lifespan_years != null && (
              <InfoBlock icon={Hourglass} label="Ekipman Ömrü" value={`${item.lifespan_years} yıl`} iconCls="text-violet-600" iconBg="bg-violet-50" />
            )}
          </div>
        </SectionDivider>
      )}

      {/* Hareket Geçmişi */}
      {item.history?.length > 0 && (
        <SectionDivider icon={History} title={`Hareket Geçmişi (${item.history.length})`}>
          <ol className="space-y-2.5">
            {item.history.map(h => (
              <li key={h.id} className="flex gap-2.5">
                <div className="flex flex-col items-center pt-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${h.field === 'status' ? 'bg-amber-500' : 'bg-rose-400'}`} />
                  <span className="flex-1 w-px bg-slate-200 mt-1" />
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    {h.field === 'status'
                      ? <Wrench size={11} className="text-amber-500" />
                      : <MapPin size={11} className="text-rose-400" />}
                    {FIELD_LABELS[h.field] || h.field} değişti
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-700 flex-wrap">
                    <span className="text-slate-400 line-through">{displayValue(h.field, h.old_value)}</span>
                    <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-slate-800">{displayValue(h.field, h.new_value)}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {fmtDateTime(h.changed_at)}{h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </SectionDivider>
      )}

      {/* Düzenle butonu */}
      {canEdit && (
        <div className="pt-4 border-t border-amber-100/70">
          <Link
            to={`/inventory/${item.id}/edit`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Pencil size={14} />
            Düzenle
          </Link>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <div onClick={e => e.stopPropagation()} className="max-w-full max-h-full flex items-center justify-center">
            <AuthImage
              apiPath={`/inventory/attachments/${lightbox.id}/download`}
              alt={lightbox.filename}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionDivider({ icon: Icon, title, children }) {
  return (
    <div className="pt-4 border-t border-amber-100/70">
      <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
        <Icon size={12} className="text-slate-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DateCard({ icon: Icon, label, value, tone }) {
  const tones = {
    slate:   { bg: 'bg-slate-50',      border: 'border-slate-100',    iconCls: 'text-slate-400',   valueCls: 'text-slate-800' },
    emerald: { bg: 'bg-emerald-50/60', border: 'border-emerald-100',  iconCls: 'text-emerald-500', valueCls: 'text-emerald-700' },
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
