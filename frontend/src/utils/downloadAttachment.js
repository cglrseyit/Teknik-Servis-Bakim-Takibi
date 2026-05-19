import api from '../api/axios';

export default async function downloadAttachment(att) {
  try {
    const r = await api.get(`/attachments/${att.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}
