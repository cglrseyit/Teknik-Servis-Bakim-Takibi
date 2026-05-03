const nodemailer = require('nodemailer');

let transporter = null;
let configWarningLogged = false;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!configWarningLogged) {
      console.warn('[email] SMTP yapılandırması eksik — e-posta gönderimi devre dışı');
      configWarningLogged = true;
    }
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildDigestHtml({ userName, overdue, upcoming }) {
  const tableRow = (t, isOverdue) => {
    const dateLabel = fmtDate(t.scheduled_date);
    const badge = isOverdue
      ? `<span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">GECİKMİŞ</span>`
      : t.days_left === 0
        ? `<span style="background:#fef3c7;color:#b45309;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">BUGÜN</span>`
        : `<span style="background:#dbeafe;color:#1e40af;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">${t.days_left} GÜN</span>`;
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
          <div style="font-weight:600;color:#1e293b;font-size:14px;">${escapeHtml(t.title)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:2px;">${escapeHtml(t.equipment_name || '')}${t.location ? ' · ' + escapeHtml(t.location) : ''}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:13px;white-space:nowrap;">${dateLabel}</td>
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
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Bakım Hatırlatması</h1>
          <p style="margin:4px 0 0;color:#fef3c7;font-size:13px;">Bellis Deluxe Hotel · Teknik Servis</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 8px;color:#1e293b;font-size:15px;">Merhaba <strong>${escapeHtml(userName)}</strong>,</p>
          <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.5;">
            Bugün dikkatinize sunulan <strong>${total}</strong> bakım göreviniz var.
            ${overdue.length > 0 ? `<span style="color:#b91c1c;font-weight:600;">${overdue.length} tanesi gecikmiş.</span>` : ''}
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
              <h2 style="margin:0 0 10px;color:#b45309;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Yaklaşan Görevler</h2>
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

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendDigestEmail({ to, userName, overdue, upcoming }) {
  const t = getTransporter();
  if (!t) return false;
  if (overdue.length === 0 && upcoming.length === 0) return false;

  const total = overdue.length + upcoming.length;
  const subject = overdue.length > 0
    ? `[Bellis] ${overdue.length} gecikmiş, ${upcoming.length} yaklaşan bakım`
    : `[Bellis] ${total} bakım göreviniz yaklaşıyor`;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: buildDigestHtml({ userName, overdue, upcoming }),
    });
    return true;
  } catch (err) {
    console.error(`[email] ${to} adresine gönderim başarısız:`, err.message);
    return false;
  }
}

module.exports = { sendDigestEmail };
