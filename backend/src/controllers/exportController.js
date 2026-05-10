const ExcelJS = require('exceljs');
const pool = require('../config/db');

const STATUS_LABELS = {
  pending: 'Bekliyor',
  in_progress: 'Devam Ediyor',
  overdue: 'Gecikmiş',
  postponed: 'Ertelendi',
  completed: 'Gerçekleşti',
  skipped: 'Atlandı',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function safeFilename(s) {
  return String(s || 'ekipman').replace(/[^\p{L}\p{N}\s\-_]/gu, '').replace(/\s+/g, '_').slice(0, 80);
}

async function equipmentHistory(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz ID' });

  try {
    const { rows: eqRows } = await pool.query(`SELECT * FROM equipment WHERE id = $1`, [id]);
    if (!eqRows[0]) return res.status(404).json({ error: 'Ekipman bulunamadı' });
    const eq = eqRows[0];

    const { rows: tasks } = await pool.query(
      `SELECT t.*,
              u.name AS completed_by_name,
              COALESCE(
                (SELECT string_agg(a.filename, ', ' ORDER BY a.uploaded_at)
                 FROM task_attachments a WHERE a.task_id = t.id),
                ''
              ) AS attachment_names
       FROM maintenance_tasks t
       LEFT JOIN users u ON u.id = t.completed_by
       WHERE t.equipment_id = $1
         AND t.status IN ('completed', 'skipped')
       ORDER BY COALESCE(t.completed_at, t.scheduled_date) DESC`,
      [id]
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bellis Teknik Servis';
    wb.created = new Date();
    const ws = wb.addWorksheet('Bakım Geçmişi', { views: [{ state: 'frozen', ySplit: 4 }] });

    // Başlık bilgileri
    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = `${eq.name} — Bakım Geçmişi`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(1).height = 22;

    ws.mergeCells('A2:I2');
    const meta = [];
    if (eq.brand) meta.push(`Marka: ${eq.brand}`);
    if (eq.category) meta.push(`Kategori: ${eq.category}`);
    if (eq.supplier) meta.push(`Tedarikçi: ${eq.supplier}`);
    meta.push(`Çıktı Tarihi: ${fmtDate(new Date())}`);
    ws.getCell('A2').value = meta.join('  ·  ');
    ws.getCell('A2').font = { color: { argb: 'FF6B7280' }, size: 10 };
    ws.getRow(2).height = 18;

    ws.getRow(3).height = 6; // boşluk

    // Tablo başlıkları
    const headers = [
      'Sıra', 'Görev Başlığı', 'Planlanan Tarih', 'Yapılma Tarihi', 'Durum',
      'Bakımı Yapan', 'Sorumlu Kişi', 'Yapılan İşlem', 'Notlar', 'Müdür Onayı', 'Ek Dosyalar',
    ];
    const headerRow = ws.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFB45309' } } };
    });
    headerRow.height = 24;

    // Kolon genişlikleri
    const widths = [6, 30, 16, 16, 14, 22, 22, 40, 30, 14, 30];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // Veri satırları
    tasks.forEach((t, idx) => {
      const row = ws.addRow([
        idx + 1,
        t.title || '',
        fmtDate(t.scheduled_date),
        fmtDate(t.completed_at),
        STATUS_LABELS[t.status] || t.status,
        t.maintained_by || '',
        t.responsible_person || '',
        t.performed_work || '',
        t.notes || '',
        t.approved_by_manager ? 'Evet' : '',
        t.attachment_names || '',
      ]);
      row.alignment = { vertical: 'top', wrapText: true };
      row.eachCell(cell => {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    if (tasks.length === 0) {
      const row = ws.addRow(['', 'Henüz tamamlanmış bakım kaydı yok', '', '', '', '', '', '', '', '', '']);
      row.font = { italic: true, color: { argb: 'FF9CA3AF' } };
    }

    const filename = `${safeFilename(eq.name)}-bakim-gecmisi-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Excel oluşturulamadı' });
  }
}

module.exports = { equipmentHistory };
