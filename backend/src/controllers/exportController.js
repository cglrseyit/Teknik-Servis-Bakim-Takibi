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
         AND (
           NOT $2
           OR t.scheduled_date IN (
             SELECT scheduled_date
             FROM maintenance_tasks
             WHERE equipment_id = ANY($1)
               AND status IN ('completed','skipped')
             GROUP BY scheduled_date
             HAVING COUNT(DISTINCT equipment_id) = $3
           )
         )
       ORDER BY COALESCE(t.completed_at, t.scheduled_date) DESC`,
      [targetIds, isGroup, isGroup ? targetIds.length : 0]
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bellis Deluxe Hotel · Teknik Servis';
    wb.created = new Date();
    const ws = wb.addWorksheet('Bakım Geçmişi', {
      views: [{ state: 'frozen', ySplit: 2, showGridLines: true }],
      properties: { defaultRowHeight: 18 },
    });

    // Sıra | Ekipman | Görev Başlığı | Arıza Sebebi | Tedarikçi | Bakımı Yapan | Sorumlu | Yapılan İşlem | Planlanan | Yapılma | Notlar | Ek Dosyalar
    const widths = [5, 20, 22, 22, 15, 15, 15, 24, 14, 11, 18, 18];
    const totalCols = widths.length;
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    ws.getRow(1).height = 62; // 82px

    // Logo
    try {
      const imgId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 175, height: 65 }, editAs: 'oneCell' });
    } catch (e) { console.warn('Logo eklenemedi:', e.message); }

    // Satır 1: A'dan son kolona kadar birleşik
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell('A1');
    titleCell.value = `${eq.name.toUpperCase()} Bakım Geçmişi Raporu`;
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: COLORS.textDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(1, totalCols).border = { right: { style: 'medium', color: { argb: 'FFB0B0B0' } } };

    // Satır 2: tablo başlıkları (spacer kaldırıldı)
    const headers = ['Sıra', 'Ekipman', 'Görev Başlığı', 'Arıza Sebebi', 'Tedarikçi', 'Bakımı Yapan', 'Sorumlu Kişi', 'Yapılan İşlem', 'Planlanan', 'Yapılma', 'Notlar', 'Ek Dosyalar'];
    const headerRow = ws.getRow(2);
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
      const titleCellValue = t.is_one_time
        ? `[Tek Seferlik] ${t.title || ''}`
        : (t.title || '');
      const row = ws.addRow([
        idx + 1,
        displayName,                  // Ekipman
        titleCellValue,               // Görev Başlığı
        t.is_one_time ? (t.title || '') : '',  // Arıza Sebebi (sadece tek seferlik için)
        eq.supplier || '',            // Tedarikçi
        t.maintained_by || '',        // Bakımı Yapan
        t.responsible_person || '',   // Sorumlu Kişi
        t.performed_work || '',       // Yapılan İşlem
        fmtMonth(t.scheduled_date),   // Planlanan → "Mayıs 2026"
        fmtDate(t.completed_at),      // Yapılma
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
      // Tek seferlik: görev başlığı hücresini bold + turuncu yap
      if (t.is_one_time) {
        const titleCell = row.getCell(3);
        titleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFC2410C' } }; // orange-700
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

    // Footer — tablo içinde, kenarlıklı
    const fRow = ws.addRow(Array(totalCols).fill(''));
    fRow.height = 22;
    ws.mergeCells(fRow.number, 1, fRow.number, totalCols);
    ws.getCell(fRow.number, 1).value = `Bellis Deluxe Hotel · Teknik Servis Sistemi · Toplam ${displayTasks.length} kayıt`;
    ws.getCell(fRow.number, 1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.textLight } };
    ws.getCell(fRow.number, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(fRow.number, c).border = {
        bottom: borderAccent,
        left:  c === 1          ? borderThin  : undefined,
        right: c === totalCols  ? borderRight : undefined,
      };
    }

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

async function equipmentList(req, res) {
  const { search, status } = req.query;
  const conditions = ['e.parent_id IS NULL'];
  const params = [];
  if (status) { params.push(status); conditions.push(`e.status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.name ILIKE $${params.length} OR e.serial_number ILIKE $${params.length}
      OR EXISTS (SELECT 1 FROM equipment u WHERE u.parent_id = e.id
        AND (u.name ILIKE $${params.length} OR u.serial_number ILIKE $${params.length})))`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;

  try {
    const { rows: equipment } = await pool.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM equipment u WHERE u.parent_id = e.id)::int AS unit_count,
              (SELECT p.frequency_type FROM maintenance_plans p
               WHERE p.equipment_id = e.id AND p.is_active = true AND p.is_one_time = false
               ORDER BY p.created_at DESC LIMIT 1) AS maintenance_frequency
       FROM equipment e ${where} ORDER BY e.name`,
      params
    );

    const EQUIP_STATUS = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };
    const PERIOD = { monthly: 'Aylık', quarterly: '3 Aylık', semiannual: '6 Aylık', biannual: '6 Aylık', yearly: 'Yıllık', custom: 'Özel' };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bellis Deluxe Hotel · Teknik Servis';
    wb.created = new Date();
    const ws = wb.addWorksheet('Ekipmanlar', {
      views: [{ state: 'frozen', ySplit: 2, showGridLines: true }],
      properties: { defaultRowHeight: 18 },
    });

    // Col 1: logo alanı (5+28=33) | Ekipman Adı | Tedarikçi | Adet | Seri No | Bakım Periyodu | Durum
    const widths = [33, 20, 8, 18, 18, 14];
    const totalCols = widths.length;
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    ws.getRow(1).height = 62; // 82px

    try {
      const imgId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 175, height: 65 }, editAs: 'oneCell' });
    } catch (e) { console.warn('Logo eklenemedi:', e.message); }

    // Satır 1: A'dan son kolona kadar birleşik
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell('A1');
    titleCell.value = 'EKİPMAN LİSTESİ';
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: COLORS.textDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(1, totalCols).border = { right: { style: 'medium', color: { argb: 'FFB0B0B0' } } };

    const borderThin   = { style: 'thin',   color: { argb: COLORS.border } };
    const borderAccent = { style: 'thin',   color: { argb: COLORS.primary } };
    const borderRight  = { style: 'medium', color: { argb: 'FFB0B0B0' } };

    // Satır 2: tablo başlıkları (Sıra kolonu kaldırıldı)
    const headers = ['Ekipman Adı', 'Tedarikçi', 'Adet', 'Seri No', 'Bakım Periyodu', 'Durum'];
    const headerRow = ws.getRow(2);
    headers.forEach((h, i) => {
      const isLast = i === headers.length - 1;
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: COLORS.primaryDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } };
      cell.alignment = { horizontal: i === 2 ? 'center' : 'left', vertical: 'middle' };
      cell.border = { top: borderAccent, bottom: borderAccent, left: borderThin, right: isLast ? borderRight : borderThin };
    });
    headerRow.height = 26;

    equipment.forEach((eq, idx) => {
      const adet = eq.unit_count > 0 ? eq.unit_count : 1;
      const period = PERIOD[eq.maintenance_frequency] || PERIOD[eq.maintenance_period] || '';
      const row = ws.addRow([
        eq.name || '',
        eq.supplier || '',
        adet,
        eq.serial_number || '',
        period,
        EQUIP_STATUS[eq.status] || eq.status || '',
      ]);
      row.height = 22;
      row.eachCell((cell, colNum) => {
        const isLast = colNum === totalCols;
        cell.alignment = { vertical: 'middle', wrapText: false, horizontal: colNum === 3 ? 'center' : 'left' };
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
        cell.border = { top: borderThin, bottom: borderThin, left: borderThin, right: isLast ? borderRight : borderThin };
      });
      if (idx % 2 === 1) {
        row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoft } }; });
      }
    });

    if (equipment.length === 0) {
      const emptyRow = ws.addRow(Array(totalCols).fill(''));
      emptyRow.getCell(2).value = 'Ekipman bulunamadı';
      emptyRow.height = 40;
      ws.mergeCells(emptyRow.number, 1, emptyRow.number, totalCols);
      emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      emptyRow.getCell(1).font = { italic: true, color: { argb: COLORS.textLight }, size: 11 };
    }

    // Footer — tablo içinde, kenarlıklı
    const fRow = ws.addRow(Array(totalCols).fill(''));
    fRow.height = 22;
    ws.mergeCells(fRow.number, 1, fRow.number, totalCols);
    ws.getCell(fRow.number, 1).value = `Bellis Deluxe Hotel · Teknik Servis Sistemi · Toplam ${equipment.length} ekipman`;
    ws.getCell(fRow.number, 1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.textLight } };
    ws.getCell(fRow.number, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(fRow.number, c).border = {
        bottom: borderAccent,
        left:  c === 1          ? borderThin  : undefined,
        right: c === totalCols  ? borderRight : undefined,
      };
    }

    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } };

    const filename = `ekipman-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Excel oluşturulamadı' });
  }
}

async function inventoryList(req, res) {
  const { category, location, status, search } = req.query;
  const conditions = [];
  const params = [];

  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (location) { params.push(location); conditions.push(`location = $${params.length}`); }
  if (status)   { params.push(status);   conditions.push(`status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR inventory_no ILIKE $${params.length} OR serial_number ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows: items } = await pool.query(
      `SELECT * FROM inventory_items ${where} ORDER BY category, name`,
      params
    );

    const STATUS_LABELS_EQ = { active: 'Aktif', passive: 'Pasif', maintenance: 'Bakımda', broken: 'Arızalı' };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bellis Deluxe Hotel · Teknik Servis';
    wb.created = new Date();
    const ws = wb.addWorksheet('Envanter', {
      views: [{ state: 'frozen', ySplit: 2, showGridLines: true }],
      properties: { defaultRowHeight: 18 },
    });

    const headers = ['Adı', 'Kategori', 'Lokasyon', 'Marka', 'Tedarikçi', 'Durum', 'Adet', 'Güç', 'Birim', 'Yıllık Gün', 'Ömür (yıl)', 'Notlar'];
    const totalCols = headers.length;
    // Genişlikler veri eklendikten sonra otomatik hesaplanacak; başlangıçta minimum ver
    headers.forEach((_, i) => { ws.getColumn(i + 1).width = 10; });

    ws.getRow(1).height = 62;

    try {
      const imgId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 175, height: 65 }, editAs: 'oneCell' });
    } catch (e) { console.warn('Logo eklenemedi:', e.message); }

    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell('A1');
    titleCell.value = 'ENVANTER LİSTESİ';
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: COLORS.textDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(1, totalCols).border = { right: { style: 'medium', color: { argb: 'FFB0B0B0' } } };

    const borderThin   = { style: 'thin',   color: { argb: COLORS.border } };
    const borderAccent = { style: 'thin',   color: { argb: COLORS.primary } };
    const borderRight  = { style: 'medium', color: { argb: 'FFB0B0B0' } };

    const headerRow = ws.getRow(2);
    headers.forEach((h, i) => {
      const isLast = i === headers.length - 1;
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: COLORS.primaryDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = { top: borderAccent, bottom: borderAccent, left: borderThin, right: isLast ? borderRight : borderThin };
    });
    headerRow.height = 32;

    items.forEach((it, idx) => {
      const row = ws.addRow([
        it.name || '',
        it.category || '',
        it.location || '',
        it.brand || '',
        it.supplier || '',
        STATUS_LABELS_EQ[it.status] || it.status || '',
        it.quantity != null ? it.quantity : '',
        it.power != null ? it.power : '',
        it.power_unit || '',
        it.annual_days != null ? it.annual_days : '',
        it.lifespan_years != null ? it.lifespan_years : '',
        it.notes || '',
      ]);
      row.height = 26;
      row.eachCell((cell, colNum) => {
        const isLast = colNum === totalCols;
        cell.alignment = { vertical: 'middle', wrapText: false, horizontal: 'left' };
        cell.font = { name: 'Calibri', size: 12, color: { argb: COLORS.textDark } };
        cell.border = { top: borderThin, bottom: borderThin, left: borderThin, right: isLast ? borderRight : borderThin };
      });
      if (idx % 2 === 1) {
        row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoft } }; });
      }
    });

    // Auto-fit: her sütun için başlık + tüm veri hücrelerinin max karakter uzunluğunu al
    for (let col = 1; col <= totalCols; col++) {
      let maxLen = headers[col - 1].length;
      ws.getColumn(col).eachCell({ includeEmpty: false }, cell => {
        const v = cell.value != null ? String(cell.value) : '';
        if (v.length > maxLen) maxLen = v.length;
      });
      ws.getColumn(col).width = Math.min(Math.max(maxLen + 4, 10), 60);
    }

    if (items.length === 0) {
      const emptyRow = ws.addRow(Array(totalCols).fill(''));
      emptyRow.getCell(2).value = 'Envanter kalemi bulunamadı';
      emptyRow.height = 40;
      ws.mergeCells(emptyRow.number, 1, emptyRow.number, totalCols);
      emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      emptyRow.getCell(1).font = { italic: true, color: { argb: COLORS.textLight }, size: 11 };
    }

    const fRow = ws.addRow(Array(totalCols).fill(''));
    fRow.height = 22;
    ws.mergeCells(fRow.number, 1, fRow.number, totalCols);
    ws.getCell(fRow.number, 1).value = `Bellis Deluxe Hotel · Teknik Servis Sistemi · Toplam ${items.length} kayıt`;
    ws.getCell(fRow.number, 1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.textLight } };
    ws.getCell(fRow.number, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(fRow.number, c).border = {
        bottom: borderAccent,
        left:  c === 1          ? borderThin  : undefined,
        right: c === totalCols  ? borderRight : undefined,
      };
    }

    ws.pageSetup = {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };

    const filename = `envanter-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Inventory export error:', err.message);
    res.status(500).json({ error: 'Excel oluşturulamadı' });
  }
}

module.exports = { equipmentHistory, equipmentList, inventoryList };
