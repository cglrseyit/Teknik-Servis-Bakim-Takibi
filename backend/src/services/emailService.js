const nodemailer = require('nodemailer');

let transport = null;
let configWarningLogged = false;

// Resend kullanılıyorsa SMTP yerine HTTP API (port 443) üzerinden gönderilir.
// Railway gibi outbound SMTP portlarını (25/465/587) engelleyen ortamlarda
// SMTP "connection timeout" verir; HTTP API bu engelden etkilenmez.
// Kendi sunucumuza + Exchange'e geçince SMTP_HOST değişir, aşağıdaki SMTP yolu devreye girer.
function isResendApi() {
  return /resend/i.test(process.env.SMTP_HOST || '') && !!process.env.SMTP_PASS;
}

function getTransport() {
  if (transport) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!configWarningLogged) {
      console.warn('[email] SMTP_HOST/SMTP_USER/SMTP_PASS eksik — e-posta gönderimi devre dışı');
      configWarningLogged = true;
    }
    return null;
  }
  const port = parseInt(SMTP_PORT, 10) || 587;
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
  });
  return transport;
}

async function sendViaResendApi({ from, to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SMTP_PASS}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.message || body.name || detail;
    } catch { /* yanıt JSON değilse status kodu yeterli */ }
    throw new Error(detail);
  }
}

async function sendMail({ to, subject, html }) {
  const from = process.env.SMTP_FROM || `Bellis Teknik Servis <${process.env.SMTP_USER}>`;
  try {
    if (isResendApi()) {
      await sendViaResendApi({ from, to, subject, html });
      return { ok: true };
    }
    const t = getTransport();
    if (!t) return { ok: false, error: 'SMTP yapılandırılmamış' };
    await t.sendMail({ from, to, subject, html });
    return { ok: true };
  } catch (err) {
    console.error(`[email] ${to} adresine gönderim başarısız:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Bakım planlarında belirli gün yok — bakım o ay içinde yapılır. Sadece ay + yıl göster.
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
  // Tek satırlık kompakt görev satırı — çok sayıda görevde mail kısa kalsın
  const taskRow = (t) => {
    // "(2 birim)" veya "(1/3 bekliyor)" gibi parantez içi bold
    const equipRaw = escapeHtml(t.equipment_name || '');
    const equipHtml = equipRaw.replace(
      /(\(\d[^)]*\))/g,
      '<strong style="color:#475569;font-weight:700;">$1</strong>'
    );
    const locationPart = t.location ? ' &middot; ' + escapeHtml(t.location) : '';
    return `
      <tr>
        <td style="padding:6px 14px;border-bottom:1px solid #f3eedf;font-size:13px;line-height:1.4;">
          <strong style="color:#1e293b;font-weight:600;">${escapeHtml(t.title)}</strong><span style="color:#94a3b8;"> &middot; ${equipHtml}${locationPart}</span>
        </td>
        <td style="padding:6px 14px;border-bottom:1px solid #f3eedf;color:#64748b;font-size:12px;white-space:nowrap;text-align:right;">${fmtMonth(t.scheduled_date)}</td>
      </tr>`;
  };

  const section = (label, color, border, items) => items.length === 0 ? '' : `
          <p style="margin:0 0 6px;color:${color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${label} (${items.length})</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${border};border-radius:8px;overflow:hidden;margin-bottom:18px;">
            ${items.map(taskRow).join('')}
          </table>`;

  const total = overdue.length + upcoming.length;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf7f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f0;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(184,146,74,0.08);">
        <tr><td style="background:linear-gradient(135deg,#d97706,#b45309);padding:18px 24px;">
          <h1 style="margin:0;color:#ffffff;font-size:17px;font-weight:700;">Aylık Bakım Hatırlatması</h1>
          <p style="margin:3px 0 0;color:#fef3c7;font-size:12px;">Bellis Deluxe Hotel &middot; Teknik Servis</p>
        </td></tr>
        <tr><td style="padding:18px 24px;">
          <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.5;">
            Merhaba <strong style="color:#1e293b;">${escapeHtml(userName)}</strong>, bu ay <strong style="color:#1e293b;">${total}</strong> bakım göreviniz var${overdue.length > 0 ? `, <strong style="color:#b91c1c;">${overdue.length} tanesi gecikmiş</strong>` : ''}.
          </p>

          ${section('Gecikmiş Görevler', '#b91c1c', '#fecaca', overdue)}
          ${section('Bu Ay Yapılacak', '#b45309', '#fde68a', upcoming)}

          ${process.env.CLIENT_URL ? `
            <div style="margin-top:4px;text-align:center;">
              <a href="${process.env.CLIENT_URL}/dashboard" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:9px 22px;border-radius:8px;font-size:13px;font-weight:600;">Panele Git</a>
            </div>
          ` : ''}
        </td></tr>
        <tr><td style="padding:14px 24px;background:#faf7f0;border-top:1px solid #fde68a;">
          <p style="margin:0;color:#94a3b8;font-size:10px;text-align:center;">
            Bu e-posta Bellis Deluxe Hotel Teknik Servis sisteminden otomatik gönderildi.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendDigestEmail({ to, userName, overdue, upcoming }) {
  if (overdue.length === 0 && upcoming.length === 0) return false;

  const total = overdue.length + upcoming.length;
  const subject = overdue.length > 0
    ? `[Bellis] ${overdue.length} gecikmiş, ${upcoming.length} bu ay yapılacak bakım`
    : `[Bellis] Bu ay ${total} bakım göreviniz var`;

  const result = await sendMail({
    to,
    subject,
    html: buildDigestHtml({ userName, overdue, upcoming }),
  });
  return result.ok;
}

module.exports = { sendDigestEmail, buildDigestHtml, sendMail };
