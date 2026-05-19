import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import api from '../api/axios';

/**
 * <img> alternatifi — kimlik doğrulamalı endpoint'ten resmi blob olarak çeker,
 * object URL'e çevirip gösterir. axios interceptor JWT'yi otomatik ekliyor.
 *
 * Cache: aynı apiPath için sonuçları globalde tutar; aynı thumbnail birden fazla yerde
 * görünürse her seferinde yeniden indirilmez.
 */
const cache = new Map(); // apiPath -> { url, refCount }

export default function AuthImage({ apiPath, alt = '', className = '', fallback = null }) {
  const [url, setUrl] = useState(() => cache.get(apiPath)?.url || null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!apiPath) return;
    let cancelled = false;

    // Cache hit
    const hit = cache.get(apiPath);
    if (hit) {
      hit.refCount++;
      setUrl(hit.url);
      return () => {
        const e = cache.get(apiPath);
        if (e) {
          e.refCount--;
          if (e.refCount <= 0) {
            URL.revokeObjectURL(e.url);
            cache.delete(apiPath);
          }
        }
      };
    }

    setUrl(null);
    setErr(false);
    api.get(apiPath, { responseType: 'blob' })
      .then(r => {
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(r.data);
        cache.set(apiPath, { url: blobUrl, refCount: 1 });
        setUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });

    return () => {
      cancelled = true;
      const e = cache.get(apiPath);
      if (e) {
        e.refCount--;
        if (e.refCount <= 0) {
          URL.revokeObjectURL(e.url);
          cache.delete(apiPath);
        }
      }
    };
  }, [apiPath]);

  if (err) {
    return fallback ?? (
      <div className={`${className} flex items-center justify-center bg-slate-100 text-slate-300`}>
        <ImageOff size={16} />
      </div>
    );
  }

  if (!url) {
    return <div className={`${className} bg-slate-100 animate-pulse`} />;
  }

  return <img src={url} alt={alt} className={className} />;
}
