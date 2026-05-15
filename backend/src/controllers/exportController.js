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

function fmtMonth(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
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

    // Child birimler var mı?
    const { rows: children } = await pool.query(
      `SELECT id, name FROM equipment WHERE parent_id = $1 ORDER BY name`,
      [id]
    );
    const isGroup   = children.length > 0;
    const targetIds = isGroup ? children.map(c => c.id) : [id];
    const childMap  = Object.fromEntries(children.map(c => [c.id, c.name]));

    // Grup adı: "Klima Santrali (3 ADET)"
    const displayName = isGroup ? `${eq.name} (${children.length} ADET)` : eq.name;

    const { rows: tasks } = await pool.query(
      `SELECT t.*,
              e.name AS unit_name,
              u.name AS completed_by_name,
              COALESCE(
                (SELECT string_agg(a.filename, ', ' ORDER BY a.uploaded_at)
                 FROM task_attachments a WHERE a.task_id = t.id),
                ''
              ) AS attachment_names
       FROM maintenance_tasks t
       LEFT JOIN equipment e ON e.id = t.equipment_id
       LEFT JOIN users u ON u.id = t.completed_by
       WHERE t.equipment_id = ANY($1)
         AND t.status IN ('completed', 'skipped')
       ORDER BY COALESCE(t.completed_at, t.scheduled_date) DESC`,
      [targetIds]
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bellis Deluxe Hotel · Teknik Servis';
    wb.created = new Date();
    const ws = wb.addWorksheet('Bakım Geçmişi', {
      views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
      properties: { defaultRowHeight: 18 },
    });

    // Sıra | Ekipman | Görev Başlığı | Tedarikçi | Planlanan | Yapılma | Bakımı Yapan | Sorumlu | Yapılan İşlem | Notlar | Ek Dosyalar
    const widths = [5, 20, 22, 15, 14, 11, 15, 15, 24, 18, 18];
    const totalCols = widths.length;
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

    // Başlık metni — logo'nun sağında, ortalı
    ws.mergeCells(1, 3, 1, totalCols);
    const titleCell = ws.getCell('C1');
    titleCell.value = displayName;
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: COLORS.textDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(2, 3, 2, totalCols);
    const subtitleCell = ws.getCell('C2');
    subtitleCell.value = 'Bakım Geçmişi Raporu';
    subtitleCell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.primary } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Satır 4: ince ayraç (amber çizgi)
    ws.getRow(4).height = 4;
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(4, c).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary },
      };
    }

    // Satır 5: meta bilgiler
    ws.getRow(5).height = 22;
    const metaItems = [];
    if (eq.brand)    metaItems.push(['Marka', eq.brand]);
    if (eq.category) metaItems.push(['Kategori', eq.category]);
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
    const headers = ['Sıra', 'Ekipman', 'Görev Başlığı', 'Tedarikçi', 'Planlanan', 'Yapılma', 'Bakımı Yapan', 'Sorumlu Kişi', 'Yapılan İşlem', 'Notlar', 'Ek Dosyalar'];
    const headerRow = ws.getRow(7);
    const borderThin   = { style: 'thin',   color: { argb: COLORS.border } };
    const borderAccent = { style: 'thin',   color: { argb: COLORS.primary } };
    const borderRight  = { style: 'medium', color: { argb: 'FFB0B0B0' } }; // tablonun sağ bitişi
    headers.forEach((h, i) => {
      const isLast = i === headers.length - 1;
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: COLORS.primaryDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = {
        top: borderAccent, bottom: borderAccent,
        left: borderThin, right: isLast ? borderRight : borderThin,
      };
    });
    headerRow.height = 26;

    // Grup ise aynı scheduled_date'teki görevleri tek satıra indir
    let displayTasks = tasks;
    if (isGroup) {
      const byPeriod = new Map();
      for (const t of tasks) {
        const key = t.scheduled_date
          ? new Date(t.scheduled_date).toISOString().split('T')[0]
          : `no-date-${t.id}`;
        if (!byPeriod.has(key)) {
          byPeriod.set(key, { ...t });
        } else {
          const existing = byPeriod.get(key);
          if (t.attachment_names) {
            existing.attachment_names = [existing.attachment_names, t.attachment_names]
              .filter(Boolean).join(', ');
          }
        }
      }
      displayTasks = Array.from(byPeriod.values());
    }

    // Veri satırları
    displayTasks.forEach((t, idx) => {
      const row = ws.addRow([
        idx + 1,
        displayName,                  // Ekipman
        t.title || '',                // Görev Başlığı
        eq.supplier || '',            // Tedarikçi
        fmtMonth(t.scheduled_date),   // Planlanan → "Mayıs 2026"
        fmtDate(t.completed_at),      // Yapılma
        t.maintained_by || '',
        t.responsible_person || '',
        t.performed_work || '',
        t.notes || '',
        t.attachment_names || '',
      ]);
      row.height = 28;
      row.eachCell((cell, colNum) => {
        const isLast = colNum === totalCols;
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: colNum === 1 ? 'center' : 'left' };
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
        cell.border = {
          top: borderThin, bottom: borderThin,
          left: borderThin, right: isLast ? borderRight : borderThin,
        };
        if (colNum === 1) cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textLight } };
      });
      if (idx % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoft } };
        });
      }
    });

    if (tasks.length === 0) {
      const emptyRow = ws.addRow(Array(totalCols).fill(''));
      emptyRow.height = 40;
      emptyRow.eachCell(cell => {
        cell.font = { italic: true, color: { argb: COLORS.textLight }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      ws.mergeCells(emptyRow.number, 1, emptyRow.number, totalCols);
    }

    // Sayfa altı: footer notu
    const footerRow = ws.addRow([]);
    footerRow.height = 30;
    const footerCell = ws.getCell(footerRow.number + 1, 1);
    ws.mergeCells(footerRow.number + 1, 1, footerRow.number + 1, totalCols);
    footerCell.value = `Bellis Deluxe Hotel · Teknik Servis Sistemi · Toplam ${displayTasks.length} kayıt`;
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
