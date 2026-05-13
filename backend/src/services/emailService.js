const { Resend } = require('resend');

let client = null;
let configWarningLogged = false;

function getClient() {
  if (client) return client;
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) {
    if (!configWarningLogged) {
      console.warn('[email] RESEND_API_KEY eksik — e-posta gönderimi devre dışı');
      configWarningLogged = true;
    }
    return null;
  }
  client = new Resend(RESEND_API_KEY);
  return client;
}

function fmtMonth(d) {
  return new Date(d).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDigestHtml({ userName, overdue, upcoming }) {
  const tableRow = (t, isOverdue) => {
    const monthLabel = fmtMonth(t.scheduled_date);
    const badge = isOverdue
      ? `<span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">GECİKMİŞ</span>`
      : `<span style="background:#fef3c7;color:#b45309;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">BU AY</span>`;
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          <div style="font-weight:600;color:#1e293b;font-size:14px;">${escapeHtml(t.title)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:2px;">${escapeHtml(t.equipment_name || '')}${t.location ? ' · ' + escapeHtml(t.location) : ''}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:13px;white-space:nowrap;">${monthLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;">${badge}</td>
      </tr>`;
  };

  const overdueRows = overdue.map(t => tableRow(t, true)).join('');
  const upcomingRows = upcoming.map(t => tableRow(t, false)).join('');
  const total = overdue.length + upcoming.length;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf7f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f0;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(184,146,74,0.08);">
        <tr><td style="background:linear-gradient(135deg,#d97706,#b45309);padding:24px 28px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Aylık Bakım Hatırlatması</h1>
          <p style="margin:4px 0 0;color:#fef3c7;font-size:13px;">Bellis Deluxe Hotel · Teknik Servis</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 8px;color:#1e293b;font-size:15px;">Merhaba <strong>${escapeHtml(userName)}</strong>,</p>
          <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.5;">
            Bu ay yapılması gereken <strong>${total}</strong> bakım göreviniz var.
            ${overdue.length > 0 ? `<span style="color:#b91c1c;font-weight:600;">${overdue.length} tanesi geçmiş aylardan kalan gecikmiş görev.</span>` : ''}
          </p>

          ${overdue.length > 0 ? `
            <div style="margin-bottom:24px;">
              <h2 style="margin:0 0 10px;color:#b91c1c;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Gecikmiş Görevler</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fecaca;border-radius:10px;overflow:hidden;">
                ${overdueRows}
              </table>
            </div>
          ` : ''}

          ${upcoming.length > 0 ? `
            <div>
              <h2 style="margin:0 0 10px;color:#b45309;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Bu Ay Yapılacak Görevler</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fde68a;border-radius:10px;overflow:hidden;">
                ${upcomingRows}
              </table>
            </div>
          ` : ''}

          ${process.env.CLIENT_URL ? `
            <div style="margin-top:28px;text-align:center;">
              <a href="${process.env.CLIENT_URL}/dashboard" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:10px;font-size:14px;font-weight:600;">Panele Git</a>
            </div>
          ` : ''}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#faf7f0;border-top:1px solid #fde68a;">
          <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">
            Bu e-posta Bellis Deluxe Hotel Teknik Servis sisteminden otomatik gönderildi.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendDigestEmail({ to, userName, overdue, upcoming }) {
  const c = getClient();
  if (!c) return false;
  if (overdue.length === 0 && upcoming.length === 0) return false;

  const total = overdue.length + upcoming.length;
  const subject = overdue.length > 0
    ? `[Bellis] ${overdue.length} gecikmiş, ${upcoming.length} bu ay yapılacak bakım`
    : `[Bellis] Bu ay ${total} bakım göreviniz var`;

  try {
    const from = process.env.SMTP_FROM || 'Bellis Teknik Servis <onboarding@resend.dev>';
    const { error } = await c.emails.send({
      from,
      to: [to],
      subject,
      html: buildDigestHtml({ userName, overdue, upcoming }),
    });
    if (error) {
      console.error(`[email] ${to} adresine gönderim başarısız:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] ${to} adresine gönderim başarısız:`, err.message);
    return false;
  }
}

module.exports = { sendDigestEmail, buildDigestHtml };
