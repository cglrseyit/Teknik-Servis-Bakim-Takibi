const path = require('path');
const ExcelJS = require('exceljs');
const pool = require('../config/db');

const LOGO_PATH = path.join(__dirname, '../assets/bellis-logo.png');

const STATUS_LABELS = {
  pending: 'Bekliyor',
  in_progress: 'Devam Ediyor',
  overdue: 'Gecikmiş',
  postponed: 'Ertelendi',
  completed: 'Gerçekleşti',
  skipped: 'Atlandı',
};

// Renk paleti — amber/sarı tonları
const COLORS = {
  primary:    'FFD97706',  // amber-600
  primaryDark:'FFB45309',  // amber-700
  accent:     'FFFEF3C7',  // amber-100
  accentSoft: 'FFFFFBEB',  // amber-50
  border:     'FFE5E7EB',  // gray-200
  textDark:   'FF1F2937',  // gray-800
  textMid:    'FF4B5563',  // gray-600
  textLight:  'FF9CA3AF',  // gray-400
  white:      'FFFFFFFF',
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
    wb.creator = 'Bellis Deluxe Hotel · Teknik Servis';
    wb.created = new Date();
    const ws = wb.addWorksheet('Bakım Geçmişi', {
      views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
      properties: { defaultRowHeight: 18 },
    });

    // Kolon genişlikleri (dikey A4'e sığacak)
    const widths = [5, 22, 11, 11, 12, 15, 15, 24, 18, 7, 18];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // Logo ekle — sol üst
    try {
      const imgId = wb.addImage({
        filename: LOGO_PATH,
        extension: 'png',
      });
      ws.addImage(imgId, {
        tl: { col: 0.1, row: 0.2 },
        ext: { width: 140, height: 50 },
        editAs: 'oneCell',
      });
    } catch (e) {
      console.warn('Logo eklenemedi:', e.message);
    }

    // Satır 1-3: Üst başlık alanı (logo yüksekliği ~60px, satır başına ~20px)
    ws.getRow(1).height = 20;
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 20;

    // Başlık metni — logo'nun sağında, sağa hizalı
    ws.mergeCells('C1:K1');
    const titleCell = ws.getCell('C1');
    titleCell.value = eq.name;
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: COLORS.textDark } };
    titleCell.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells('C2:K2');
    const subtitleCell = ws.getCell('C2');
    subtitleCell.value = 'Bakım Geçmişi Raporu';
    subtitleCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.primary } };
    subtitleCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Satır 4: ince ayraç (amber çizgi)
    ws.getRow(4).height = 4;
    for (let c = 1; c <= 11; c++) {
      ws.getCell(4, c).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary },
      };
    }

    // Satır 5: meta bilgiler
    ws.getRow(5).height = 22;
    const metaItems = [];
    if (eq.brand)    metaItems.push(['Marka', eq.brand]);
    if (eq.category) metaItems.push(['Kategori', eq.category]);
    if (eq.supplier) metaItems.push(['Tedarikçi', eq.supplier]);
    metaItems.push(['Çıktı Tarihi', fmtDate(new Date())]);

    let col = 1;
    metaItems.forEach(([label, value], i) => {
      const labelCell = ws.getCell(5, col);
      labelCell.value = label.toUpperCase();
      labelCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: COLORS.textLight } };
      labelCell.alignment = { horizontal: 'left', vertical: 'bottom' };

      const valueCell = ws.getCell(6, col);
      valueCell.value = value;
      valueCell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.textDark } };
      valueCell.alignment = { horizontal: 'left', vertical: 'top' };

      // 5. ve 6. satırı birleştir
      ws.mergeCells(5, col, 5, col + 1);
      ws.mergeCells(6, col, 6, col + 1);
      col += 2;
    });
    ws.getRow(6).height = 20;

    // Satır 7: tablo başlıkları
    const headers = [
      'Sıra', 'Görev Başlığı', 'Planlanan', 'Yapılma', 'Durum',
      'Bakımı Yapan', 'Sorumlu Kişi', 'Yapılan İşlem', 'Notlar', 'Onay', 'Ek Dosyalar',
    ];
    const headerRow = ws.getRow(7);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: COLORS.primaryDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = {
        top:    { style: 'thin', color: { argb: COLORS.primary } },
        bottom: { style: 'thin', color: { argb: COLORS.primary } },
      };
    });
    headerRow.height = 26;

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
        t.approved_by_manager ? '✓' : '',
        t.attachment_names || '',
      ]);
      row.height = 28;
      row.eachCell((cell, colNum) => {
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: colNum === 1 || colNum === 10 ? 'center' : 'left' };
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
        cell.border = {
          bottom: { style: 'hair', color: { argb: COLORS.border } },
        };
        // Sıra ve durum kolonlarını soft amber yap
        if (colNum === 1) {
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textLight } };
        }
        if (colNum === 5) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.primaryDark } };
        }
        if (colNum === 10 && t.approved_by_manager) {
          cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.primary } };
        }
      });
      // Zebra effect
      if (idx % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoft } };
        });
      }
    });

    if (tasks.length === 0) {
      const row = ws.addRow(['', 'Henüz tamamlanmış bakım kaydı yok', '', '', '', '', '', '', '', '', '']);
      row.height = 40;
      row.eachCell(cell => {
        cell.font = { italic: true, color: { argb: COLORS.textLight }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      ws.mergeCells(row.number, 1, row.number, 11);
    }

    // Sayfa altı: footer notu
    const footerRow = ws.addRow([]);
    footerRow.height = 30;
    const footerCell = ws.getCell(footerRow.number + 1, 1);
    ws.mergeCells(footerRow.number + 1, 1, footerRow.number + 1, 11);
    footerCell.value = `Bellis Deluxe Hotel · Teknik Servis Sistemi · Toplam ${tasks.length} kayıt`;
    footerCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.textLight } };
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Print ayarları — A4 dikey
    ws.pageSetup = {
      orientation: 'portrait',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };

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
