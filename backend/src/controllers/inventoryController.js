const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { logAction } = require('../services/auditLogger');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');

async function getAll(req, res) {
  const { category, location, status, search } = req.query;
  const conditions = [];
  const params = [];

  if (category) { params.push(category); conditions.push(`i.category = $${params.length}`); }
  if (location) { params.push(location); conditions.push(`i.location = $${params.length}`); }
  if (status)   { params.push(status);   conditions.push(`i.status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(i.name ILIKE $${params.length} OR i.inventory_no ILIKE $${params.length} OR i.serial_number ILIKE $${params.length} OR i.brand ILIKE $${params.length} OR i.model ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              (SELECT json_build_object('id', a.id, 'mime_type', a.mime_type)
               FROM inventory_attachments a
               WHERE a.inventory_id = i.id
               ORDER BY a.is_primary DESC, a.uploaded_at ASC
               LIMIT 1) AS primary_attachment,
              (SELECT COUNT(*) FROM inventory_attachments a WHERE a.inventory_id = i.id)::int AS attachment_count
       FROM inventory_items i
       ${where}
       ORDER BY i.name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('inventory.getAll error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getOne(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  try {
    const { rows } = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });

    const { rows: atts } = await pool.query(
      `SELECT id, filename, mime_type, size_bytes, is_primary, uploaded_at
       FROM inventory_attachments
       WHERE inventory_id = $1
       ORDER BY is_primary DESC, uploaded_at ASC`,
      [id]
    );

    const { rows: history } = await pool.query(
      `SELECT h.id, h.field, h.old_value, h.new_value, h.changed_at,
              u.name AS changed_by_name
       FROM inventory_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.inventory_id = $1
       ORDER BY h.changed_at DESC`,
      [id]
    );
    res.json({ ...rows[0], attachments: atts, history });
  } catch (err) {
    console.error('inventory.getOne error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Sayıyı parse et: '' / null / geçersiz → null, virgül ondalık → nokta
function numOrNull(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

async function create(req, res) {
  const {
    inventory_no, name, category, location, brand, model, serial_number,
    supplier, install_date, warranty_end, status, notes,
    quantity, power, power_unit, annual_days, lifespan_years,
  } = req.body;
  const files = req.files || [];

  function cleanup() { files.forEach(f => fs.unlink(f.path, () => {})); }

  if (!name?.trim()) {
    cleanup();
    return res.status(400).json({ error: 'Adı zorunlu' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory_items
         (inventory_no, name, category, location, brand, model, serial_number,
          supplier, install_date, warranty_end, status, notes, created_by,
          quantity, power, power_unit, annual_days, lifespan_years)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        inventory_no?.trim() || null,
        name.trim(),
        category?.trim() || null,
        location?.trim() || null,
        brand?.trim() || null,
        model?.trim() || null,
        serial_number?.trim() || null,
        supplier?.trim() || null,
        install_date || null,
        warranty_end || null,
        status || 'active',
        notes?.trim() || null,
        req.user.id,
        numOrNull(quantity) ?? 1,
        numOrNull(power),
        power_unit?.trim() || null,
        numOrNull(annual_days),
        numOrNull(lifespan_years),
      ]
    );
    const item = rows[0];

    // Fotoları kaydet — ilki kapak
    for (let idx = 0; idx < files.length; idx++) {
      const f = files[idx];
      const originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
      await pool.query(
        `INSERT INTO inventory_attachments
           (inventory_id, filename, stored_filename, mime_type, size_bytes, is_primary, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [item.id, originalname, f.filename, f.mimetype, f.size, idx === 0, req.user.id]
      );
    }

    await logAction(req.user.id, 'inventory_created', 'inventory', item.id, item.name);
    res.status(201).json(item);
  } catch (err) {
    cleanup();
    console.error('inventory.create error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Bu demirbaş numarası zaten kullanılıyor' });
    }
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  const {
    inventory_no, name, category, location, brand, model, serial_number,
    supplier, install_date, warranty_end, status, notes,
    quantity, power, power_unit, annual_days, lifespan_years,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Adı zorunlu' });

  try {
    // Değişim takibi için önceki durum/lokasyonu al
    const { rows: prevRows } = await pool.query(
      'SELECT status, location FROM inventory_items WHERE id = $1', [id]
    );
    if (!prevRows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    const prev = prevRows[0];

    const newStatus = status || 'active';
    const newLocation = location?.trim() || null;

    const { rows } = await pool.query(
      `UPDATE inventory_items SET
         inventory_no=$1, name=$2, category=$3, location=$4, brand=$5, model=$6,
         serial_number=$7, supplier=$8, install_date=$9, warranty_end=$10,
         status=$11, notes=$12, updated_at=NOW(),
         quantity=$14, power=$15, power_unit=$16, annual_days=$17, lifespan_years=$18
       WHERE id=$13 RETURNING *`,
      [
        inventory_no?.trim() || null,
        name.trim(),
        category?.trim() || null,
        newLocation,
        brand?.trim() || null,
        model?.trim() || null,
        serial_number?.trim() || null,
        supplier?.trim() || null,
        install_date || null,
        warranty_end || null,
        newStatus,
        notes?.trim() || null,
        id,
        numOrNull(quantity) ?? 1,
        numOrNull(power),
        power_unit?.trim() || null,
        numOrNull(annual_days),
        numOrNull(lifespan_years),
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });

    // Durum / lokasyon değiştiyse hareket geçmişine yaz
    const changes = [];
    if (prev.status !== newStatus) changes.push(['status', prev.status, newStatus]);
    if ((prev.location || null) !== newLocation) changes.push(['location', prev.location, newLocation]);
    for (const [field, oldVal, newVal] of changes) {
      await pool.query(
        `INSERT INTO inventory_history (inventory_id, field, old_value, new_value, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, field, oldVal, newVal, req.user.id]
      );
    }

    await logAction(req.user.id, 'inventory_updated', 'inventory', rows[0].id, rows[0].name);
    res.json(rows[0]);
  } catch (err) {
    console.error('inventory.update error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Bu demirbaş numarası zaten kullanılıyor' });
    }
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  try {
    // Önce ekleri ve disk dosyalarını al
    const { rows: atts } = await pool.query(
      'SELECT stored_filename FROM inventory_attachments WHERE inventory_id = $1', [id]
    );
    const { rows } = await pool.query(
      'DELETE FROM inventory_items WHERE id = $1 RETURNING name', [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    // Disk cleanup
    for (const a of atts) {
      fs.unlink(path.join(UPLOADS_DIR, a.stored_filename), () => {});
    }
    await logAction(req.user.id, 'inventory_deleted', 'inventory', id, rows[0].name);
    res.json({ message: 'Silindi' });
  } catch (err) {
    console.error('inventory.remove error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function categorySummary(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(category, 'Diğer') AS category,
              COUNT(*)::int AS count
       FROM inventory_items
       GROUP BY COALESCE(category, 'Diğer')
       ORDER BY count DESC, category ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('inventory.categorySummary error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function locationSummary(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(location, 'Belirsiz') AS location,
              COUNT(*)::int AS count,
              json_agg(json_build_object('id', id, 'name', name, 'category', category, 'inventory_no', inventory_no) ORDER BY name) AS items
       FROM inventory_items
       GROUP BY COALESCE(location, 'Belirsiz')
       ORDER BY location ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('inventory.locationSummary error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function uploadAttachments(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  const files = req.files || [];

  function cleanup() { files.forEach(f => fs.unlink(f.path, () => {})); }

  if (files.length === 0) {
    return res.status(400).json({ error: 'Dosya gerekli' });
  }

  try {
    const { rows: chk } = await pool.query('SELECT id FROM inventory_items WHERE id = $1', [id]);
    if (!chk[0]) {
      cleanup();
      return res.status(404).json({ error: 'Envanter kalemi bulunamadı' });
    }

    // Mevcut kayıt var mı? Yoksa ilk yüklenen kapak olur
    const { rows: existing } = await pool.query(
      'SELECT COUNT(*)::int AS c FROM inventory_attachments WHERE inventory_id = $1', [id]
    );
    const hasExisting = existing[0].c > 0;

    const inserted = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const isPrimary = !hasExisting && i === 0;
      const { rows } = await pool.query(
        `INSERT INTO inventory_attachments
           (inventory_id, filename, stored_filename, mime_type, size_bytes, is_primary, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, filename, mime_type, size_bytes, is_primary, uploaded_at`,
        [id, originalname, f.filename, f.mimetype, f.size, isPrimary, req.user.id]
      );
      inserted.push(rows[0]);
    }
    res.status(201).json(inserted);
  } catch (err) {
    cleanup();
    console.error('inventory.uploadAttachments error:', err);
    res.status(500).json({ error: 'Yükleme başarısız' });
  }
}

async function setPrimaryAttachment(req, res) {
  const id = Number(req.params.id);
  const attId = Number(req.params.attId);
  if (!Number.isInteger(id) || !Number.isInteger(attId)) return res.status(400).json({ error: 'Geçersiz ID' });
  try {
    // Tümünü false yap
    await pool.query('UPDATE inventory_attachments SET is_primary = false WHERE inventory_id = $1', [id]);
    // Hedefi true yap
    const { rows } = await pool.query(
      'UPDATE inventory_attachments SET is_primary = true WHERE id = $1 AND inventory_id = $2 RETURNING *',
      [attId, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Foto bulunamadı' });
    res.json({ message: 'Kapak güncellendi' });
  } catch (err) {
    console.error('inventory.setPrimaryAttachment error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function deleteAttachment(req, res) {
  const attId = Number(req.params.id);
  if (!Number.isInteger(attId)) return res.status(400).json({ error: 'Geçersiz ID' });
  try {
    const { rows } = await pool.query(
      'SELECT inventory_id, stored_filename, is_primary FROM inventory_attachments WHERE id = $1',
      [attId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    await pool.query('DELETE FROM inventory_attachments WHERE id = $1', [attId]);
    fs.unlink(path.join(UPLOADS_DIR, rows[0].stored_filename), () => {});

    // Silinen kapaksa, kalan ilk fotoyu kapak yap
    if (rows[0].is_primary) {
      await pool.query(
        `UPDATE inventory_attachments SET is_primary = true
         WHERE id = (SELECT id FROM inventory_attachments WHERE inventory_id = $1 ORDER BY uploaded_at ASC LIMIT 1)`,
        [rows[0].inventory_id]
      );
    }
    res.json({ message: 'Silindi' });
  } catch (err) {
    console.error('inventory.deleteAttachment error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function downloadAttachment(req, res) {
  const attId = Number(req.params.id);
  if (!Number.isInteger(attId)) return res.status(400).json({ error: 'Geçersiz ID' });
  try {
    const { rows } = await pool.query(
      'SELECT filename, stored_filename, mime_type FROM inventory_attachments WHERE id = $1',
      [attId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    const a = rows[0];
    const filePath = path.join(UPLOADS_DIR, a.stored_filename);
    if (!filePath.startsWith(path.resolve(UPLOADS_DIR))) {
      return res.status(400).json({ error: 'Geçersiz yol' });
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Disk üzerinde bulunamadı' });
    res.setHeader('Content-Type', a.mime_type);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(a.filename)}`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('inventory.downloadAttachment error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

/* ──────────── Excel toplu içe aktarma ──────────── */

// Başlık eşleştirme alias'ları (hem EYS dosyası hem bizim export şablonu)
const FIELD_ALIASES = {
  name:          ['EKİPMAN ADI', 'EKIPMAN ADI', 'ADI', 'AD'],
  location:      ['EKİPMANIN KONUMU', 'EKIPMANIN KONUMU', 'LOKASYON', 'KONUM'],
  brand:         ['MARKA'],
  model:         ['MODEL'],
  quantity:      ['ADET'],
  power:         ['GÜÇ', 'GUC'],
  power_unit:    ['BİRİM', 'BIRIM'],
  annual_days:   ['YILLIK ORTALAMA KULLANILAN GÜN SAYISI', 'YILLIK ORTALAMA KULLANILAN GUN SAYISI', 'YILLIK GÜN', 'YILLIK ORT GÜN'],
  lifespan_years:['EKİPMAN ÖMRÜ', 'EKIPMAN OMRU', 'ÖMÜR', 'OMUR'],
  inventory_no:  ['DEMİRBAŞ NO', 'DEMIRBAS NO', 'DEMİRBAŞ NUMARASI'],
  category:      ['KATEGORİ', 'KATEGORI'],
  serial_number: ['SERİ NO', 'SERI NO', 'SERİ NUMARASI', 'SERİ NUMARASI'],
  supplier:      ['TEDARİKÇİ', 'TEDARIKCI'],
  install_date:  ['KURULUM', 'KURULUM TARİHİ'],
  warranty_end:  ['GARANTİ BİTİŞ', 'GARANTI BITIS'],
  status:        ['DURUM'],
  notes:         ['NOTLAR', 'NOT'],
};

const STATUS_MAP = { 'AKTİF': 'active', 'AKTIF': 'active', 'PASİF': 'passive', 'PASIF': 'passive', 'BAKIMDA': 'maintenance', 'ARIZALI': 'broken', 'ARİZALİ': 'broken' };

function normHeader(s) {
  return String(s || '').toLocaleUpperCase('tr-TR').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    return '';
  }
  return String(v);
}

function parseImportDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                 // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);        // dd.MM.yyyy / dd/MM/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

async function importExcel(req, res) {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Dosya gerekli' });
  const isPreview = req.query.preview === '1';
  const cleanup = () => fs.unlink(file.path, () => {});

  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file.path);
    const ws = wb.worksheets[0];
    if (!ws) { cleanup(); return res.status(400).json({ error: 'Sayfa bulunamadı' }); }

    // Başlık satırını bul (ilk 20 satırda 'EKİPMAN ADI'/'ADI' içeren)
    let headerRowNum = 0;
    const colMap = {};
    for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const found = {};
      for (let c = 1; c <= ws.columnCount; c++) {
        const norm = normHeader(cellText(row.getCell(c).value));
        if (!norm) continue;
        for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
          if (found[field] === undefined && aliases.includes(norm)) found[field] = c;
        }
      }
      if (found.name !== undefined) { headerRowNum = r; Object.assign(colMap, found); break; }
    }

    if (!headerRowNum) {
      cleanup();
      return res.status(400).json({ error: 'Ekipman adı (başlık) sütunu bulunamadı. Excel başlıklarını kontrol edin.' });
    }

    const get = (row, field) => colMap[field] ? cellText(row.getCell(colMap[field]).value).trim() : '';

    const records = [];
    let skipped = 0;
    const errors = [];

    for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = get(row, 'name');
      if (!name) { skipped++; continue; }

      const statusRaw = normHeader(get(row, 'status'));
      records.push({
        _row: r,
        inventory_no:  get(row, 'inventory_no') || null,
        name,
        category:      get(row, 'category') || null,
        location:      get(row, 'location') || null,
        brand:         get(row, 'brand') || null,
        model:         get(row, 'model') || null,
        serial_number: get(row, 'serial_number') || null,
        supplier:      get(row, 'supplier') || null,
        install_date:  parseImportDate(get(row, 'install_date')),
        warranty_end:  parseImportDate(get(row, 'warranty_end')),
        status:        STATUS_MAP[statusRaw] || 'active',
        notes:         get(row, 'notes') || null,
        quantity:      numOrNull(get(row, 'quantity')) ?? 1,
        power:         numOrNull(get(row, 'power')),
        power_unit:    get(row, 'power_unit') || null,
        annual_days:   numOrNull(get(row, 'annual_days')),
        lifespan_years:numOrNull(get(row, 'lifespan_years')),
      });
    }

    if (isPreview) {
      cleanup();
      return res.json({
        total: records.length + skipped,
        willCreate: records.length,
        skipped,
        mappedColumns: Object.keys(colMap),
        sample: records.slice(0, 5).map(r => ({
          name: r.name, location: r.location, brand: r.brand,
          quantity: r.quantity, power: r.power, power_unit: r.power_unit,
        })),
        errors,
      });
    }

    let created = 0;
    for (const rec of records) {
      try {
        await pool.query(
          `INSERT INTO inventory_items
             (inventory_no, name, category, location, brand, model, serial_number,
              supplier, install_date, warranty_end, status, notes, created_by,
              quantity, power, power_unit, annual_days, lifespan_years)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            rec.inventory_no, rec.name, rec.category, rec.location, rec.brand, rec.model,
            rec.serial_number, rec.supplier, rec.install_date, rec.warranty_end, rec.status,
            rec.notes, req.user.id, rec.quantity, rec.power, rec.power_unit, rec.annual_days,
            rec.lifespan_years,
          ]
        );
        created++;
      } catch (e) {
        errors.push({ row: rec._row, reason: e.code === '23505' ? 'Demirbaş no zaten var' : (e.message || 'hata') });
      }
    }

    cleanup();
    await logAction(req.user.id, 'inventory_imported', 'inventory', null, `${created} kayıt içe aktarıldı`);
    res.json({ created, skipped, errors });
  } catch (err) {
    cleanup();
    console.error('inventory.importExcel error:', err);
    res.status(500).json({ error: 'Excel okunamadı veya işlenemedi' });
  }
}

async function bulkCategory(req, res) {
  const { ids, category } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'ids dizisi gerekli' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE inventory_items SET category = $1, updated_at = NOW() WHERE id = ANY($2::int[])`,
      [category || null, ids]
    );
    await logAction(req.user.id, 'inventory_bulk_category', 'inventory', null,
      `${rowCount} kayıt → ${category || '(boş)'}`);
    res.json({ updated: rowCount });
  } catch (err) {
    console.error('bulkCategory:', err);
    res.status(500).json({ error: 'Güncelleme başarısız' });
  }
}

module.exports = {
  getAll, getOne, create, update, remove,
  categorySummary, locationSummary,
  uploadAttachments, setPrimaryAttachment, deleteAttachment, downloadAttachment,
  importExcel, bulkCategory,
};
