const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../config/db');
const { logAction } = require('../services/auditLogger');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Desteklenmeyen dosya türü'));
    }
    cb(null, true);
  },
});

async function uploadAttachments(req, res) {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) return res.status(400).json({ error: 'Geçersiz görev ID' });

  try {
    const { rows: taskRows } = await pool.query('SELECT id FROM maintenance_tasks WHERE id = $1', [taskId]);
    if (!taskRows[0]) {
      req.files?.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ error: 'Görev bulunamadı' });
    }

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'Dosya gerekli' });

    const inserted = [];
    for (const f of files) {
      // multer dosya adını latin-1 olarak parse ediyor; UTF-8'e geri çevir (Türkçe harfler için)
      const originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const { rows } = await pool.query(
        `INSERT INTO task_attachments (task_id, filename, stored_filename, mime_type, size_bytes, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, filename, mime_type, size_bytes, uploaded_at`,
        [taskId, originalname, f.filename, f.mimetype, f.size, req.user.id]
      );
      inserted.push(rows[0]);
    }
    await logAction(req.user.id, 'attachment_uploaded', 'task', taskId, `${files.length} dosya`);
    res.status(201).json(inserted);
  } catch (err) {
    console.error('Attachment upload error:', err.message);
    req.files?.forEach(f => fs.unlink(f.path, () => {}));
    res.status(500).json({ error: 'Yükleme başarısız' });
  }
}

async function listAttachments(req, res) {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) return res.status(400).json({ error: 'Geçersiz görev ID' });
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.filename, a.mime_type, a.size_bytes, a.uploaded_at, u.name AS uploaded_by_name
       FROM task_attachments a
       LEFT JOIN users u ON u.id = a.uploaded_by
       WHERE a.task_id = $1
       ORDER BY a.uploaded_at DESC`,
      [taskId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Attachment list error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function downloadAttachment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  try {
    const { rows } = await pool.query(
      `SELECT filename, stored_filename, mime_type FROM task_attachments WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Dosya bulunamadı' });
    const a = rows[0];
    const filePath = path.join(UPLOADS_DIR, a.stored_filename);
    if (!filePath.startsWith(path.resolve(UPLOADS_DIR))) {
      return res.status(400).json({ error: 'Geçersiz yol' });
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Disk üzerinde bulunamadı' });
    res.setHeader('Content-Type', a.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(a.filename)}`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Attachment download error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function deleteAttachment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  try {
    const { rows } = await pool.query(
      `SELECT task_id, filename, stored_filename FROM task_attachments WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    const a = rows[0];
    await pool.query('DELETE FROM task_attachments WHERE id = $1', [id]);
    const filePath = path.join(UPLOADS_DIR, a.stored_filename);
    fs.unlink(filePath, () => {});
    await logAction(req.user.id, 'attachment_deleted', 'task', a.task_id, a.filename);
    res.json({ message: 'Silindi' });
  } catch (err) {
    console.error('Attachment delete error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Dosya 10MB sınırını aşıyor' });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'En fazla 10 dosya yüklenebilir' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
}

module.exports = { upload, uploadAttachments, listAttachments, downloadAttachment, deleteAttachment, multerErrorHandler };
