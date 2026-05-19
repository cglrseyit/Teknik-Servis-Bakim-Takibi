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
    res.json({ ...rows[0], attachments: atts });
  } catch (err) {
    console.error('inventory.getOne error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function create(req, res) {
  const {
    inventory_no, name, category, location, brand, model, serial_number,
    supplier, install_date, warranty_end, status, notes,
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
          supplier, install_date, warranty_end, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Adı zorunlu' });

  try {
    const { rows } = await pool.query(
      `UPDATE inventory_items SET
         inventory_no=$1, name=$2, category=$3, location=$4, brand=$5, model=$6,
         serial_number=$7, supplier=$8, install_date=$9, warranty_end=$10,
         status=$11, notes=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
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
        id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
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

module.exports = {
  getAll, getOne, create, update, remove,
  categorySummary, locationSummary,
  uploadAttachments, setPrimaryAttachment, deleteAttachment, downloadAttachment,
};
