require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'please_set_env_JWT_SECRET';

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true
}));

// DB pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'smart_kos_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Rate limiter for login (prevent brute force)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: "Terlalu banyak percobaan login. Coba lagi nanti." }
});

// Helper: standardized error handler
function handleError(res, err) {
  console.error(err);
  return res.status(500).json({ error: 'Internal Server Error' });
}

// Auth middleware
async function authMiddleware(req, res, next) {
  try {
    const h = req.headers.authorization;
    if (!h) return res.status(401).json({ error: 'Authorization header missing' });
    const token = h.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token missing' });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Role checker middleware factory
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden: insufficient role' });
    next();
  };
}

/* ---------- AUTH: register (optional) & login ---------- */

/**
 * Note: In original app, users created when creating penghuni.
 * Here we add a simple /auth/register for testing/dev (hashing included).
 */
app.post('/auth/register', [
  body('username').isString().isLength({ min: 3 }),
  body('password').isString().isLength({ min: 6 }),
  body('role').optional().isIn(['pemilik','penghuni'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password, role = 'penghuni' } = req.body;

  try {
    // check exists
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length > 0) return res.status(409).json({ error: 'Username sudah terpakai' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashed, role]);
    return res.status(201).json({ message: 'User dibuat', userId: result.insertId });
  } catch (err) {
    return handleError(res, err);
  }
});

app.post('/auth/login', loginLimiter, [
  body('username').isString(),
  body('password').isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT id, username, password, role FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Username atau password salah' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Username atau password salah' });

    // generate JWT
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    return handleError(res, err);
  }
});

/* ---------- DASHBOARD ---------- */
// Protected: needs token
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    const stats = {};

    if (role === 'pemilik') {
      const [[r1]] = await pool.query('SELECT COALESCE(SUM(jumlah),0) as total FROM pembayaran WHERE status = "lunas"');
      stats.pendapatan = r1.total || 0;

      const [[r2]] = await pool.query('SELECT COALESCE(SUM(jumlah),0) as total FROM pengeluaran');
      stats.pengeluaran = r2.total || 0;

      const [[r3]] = await pool.query('SELECT COUNT(*) as total FROM kamar WHERE status = "terisi"');
      stats.terisi = r3.total || 0;

      return res.json(stats);
    } else {

      // penghuni
      const [[penghuniRow]] = await pool.query('SELECT id FROM penghuni WHERE id_user = ?', [user_id]);
      if (!penghuniRow || !penghuniRow.id) return res.json({ tagihan_saya: 0, kamar_saya: 'Belum Ada Kamar' });

      const id_penghuni = penghuniRow.id;
      const [[r1]] = await pool.query('SELECT COALESCE(SUM(jumlah),0) as total FROM pembayaran WHERE id_penghuni = ? AND status = "belum"', [id_penghuni]);
      stats.tagihan_saya = r1.total || 0;

      const [r2] = await pool.query('SELECT k.nomor_kamar FROM kamar k JOIN penghuni p ON p.id_kamar = k.id WHERE p.id = ?', [id_penghuni]);
      stats.kamar_saya = (r2.length > 0) ? r2[0].nomor_kamar : '-';

      return res.json(stats);
    }

  } catch (err) {
    return handleError(res, err);
  }
  
});
/* ---------- LIST TAGIHAN BELUM LUNAS ---------- */
app.get('/api/dashboard/belum-lunas', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "pemilik") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [rows] = await pool.query(`
      SELECT 
        p.id as id_penghuni,
        p.nama,
        p.tanggal_masuk,
        k.harga,
        (
            SELECT status 
            FROM pembayaran 
            WHERE id_penghuni = p.id 
            ORDER BY id DESC 
            LIMIT 1
        ) AS status_terakhir
      FROM penghuni p
      LEFT JOIN kamar k ON p.id_kamar = k.id
    `);

    const list = rows
      .filter(r => r.status_terakhir !== "lunas") // ❗ hanya yang belum lunas
      .map(r => {
        const t = new Date(r.tanggal_masuk);
        t.setMonth(t.getMonth() + 1);

        return {
          nama: r.nama,
          tenggat: t.toISOString().split("T")[0],
          nominal: r.harga || 0
        };
      });

    return res.json(list);

  } catch (err) {
    return handleError(res, err);
  }
});


/* ---------- PEMBAYARAN ---------- */
app.get('/api/pembayaran', authMiddleware, async (req, res) => {
  try {
    const { role, id: user_id } = req.user;
    if (role === 'pemilik') {
      const [rows] = await pool.query(
        `SELECT pembayaran.*, penghuni.nama as nama_penghuni
         FROM pembayaran
         JOIN penghuni ON pembayaran.id_penghuni = penghuni.id`);
      return res.json(rows);
    } else {
      const [[penghuniRow]] = await pool.query('SELECT id FROM penghuni WHERE id_user = ?', [user_id]);
      if (!penghuniRow || !penghuniRow.id) return res.json([]);
      const idPenghuni = penghuniRow.id;
      const [rows] = await pool.query(
        `SELECT pembayaran.*, penghuni.nama as nama_penghuni
         FROM pembayaran
         JOIN penghuni ON pembayaran.id_penghuni = penghuni.id
         WHERE pembayaran.id_penghuni = ?`, [idPenghuni]);
      return res.json(rows);
    }
  } catch (err) {
    return handleError(res, err);
  }
});

app.delete('/api/pembayaran/:id', authMiddleware, requireRole('pemilik'), async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM pembayaran WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pembayaran tidak ditemukan" });
    }

    return res.json({ message: "Pembayaran dihapus" });
  } catch (err) {
    return handleError(res, err);
  }
});

app.post('/api/pembayaran', authMiddleware, [
  body('id_penghuni').isInt(),
  body('bulan').isString(),
  body('tanggal_bayar').isString().optional({ nullable: true }),
  body('jumlah').isNumeric(),
  body('status').isIn(['lunas','belum'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id_penghuni, bulan, tanggal_bayar = null, jumlah, status } = req.body;
  try {
    await pool.query('INSERT INTO pembayaran (id_penghuni, bulan, tanggal_bayar, jumlah, status) VALUES (?,?,?,?,?)',
      [id_penghuni, bulan, tanggal_bayar, jumlah, status]);
    return res.status(201).json({ message: 'Pembayaran dicatat' });
  } catch (err) {
    return handleError(res, err);
  }
});

/* ---------- PENGHUNI (CREATE uses transaction!!) ---------- */
app.get('/api/penghuni', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT penghuni.*, kamar.nomor_kamar FROM penghuni LEFT JOIN kamar ON penghuni.id_kamar = kamar.id');
    return res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
});

app.get('/api/penghuni/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
      const [[row]] = await pool.query(`SELECT * FROM penghuni WHERE id = ?`, [id]);
      if (!row) return res.status(404).json({ error: "Penghuni tidak ditemukan" });
      return res.json(row);
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
});




app.post('/api/penghuni', authMiddleware, requireRole('pemilik'), [
  body('nama').isString().notEmpty(),
  body('username').isString().notEmpty(),
  body('password').isString().isLength({ min: 6 }),
  body('no_hp').optional().isString(),
  body('alamat').optional().isString(),
  body('tanggal_masuk').optional().isString(),
  body('id_kamar').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nama, username, password, no_hp, alamat, tanggal_masuk, id_kamar } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Cek username kembar
    const [exist] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exist.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }

    // Insert user baru (login penghuni)
    const [userRes] = await conn.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, "penghuni")',
      [username, hashed]
    );
    const userId = userRes.insertId;

    // Insert data penghuni
    await conn.query(
      'INSERT INTO penghuni (id_user, nama, no_hp, alamat, password, tanggal_masuk, id_kamar) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, nama, no_hp, alamat, password, tanggal_masuk, id_kamar]
    );
    
    // Update kamar jika dipilih
    if (id_kamar) {
      await conn.query('UPDATE kamar SET status = "terisi" WHERE id = ?', [id_kamar]);
    }

    await conn.commit();
    return res.status(201).json({ message: 'Penghuni berhasil dibuat' });
  } catch (err) {
    await conn.rollback();
    return handleError(res, err);
  } finally {
    conn.release();
  }
});

app.put('/api/penghuni/:id', authMiddleware, requireRole('pemilik'), [
  body('nama').optional().isString(),
  body('no_hp').optional().isString(),
  body('alamat').optional().isString(),
  body('tanggal_masuk').optional().isString(),
  body('id_kamar').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = req.params.id;
  const { nama, no_hp, alamat, tanggal_masuk, id_kamar } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Cek data lama (kamar lama)
    const [[p]] = await conn.query("SELECT id_kamar FROM penghuni WHERE id = ?", [id]);
    if (!p) {
      await conn.rollback();
      return res.status(404).json({ error: "Penghuni tidak ditemukan" });
    }

    const oldKamar = p.id_kamar;

    // Update data penghuni
    await conn.query(`
      UPDATE penghuni
      SET nama=?, no_hp=?, alamat=?, tanggal_masuk=?, id_kamar=?
      WHERE id=?
    `, [nama, no_hp, alamat, tanggal_masuk, id_kamar, id]);

    // Update status kamar jika pindah kamar
    if (oldKamar && oldKamar !== id_kamar) {
        await conn.query("UPDATE kamar SET status='kosong' WHERE id=?", [oldKamar]);
    }

    if (id_kamar) {
        await conn.query("UPDATE kamar SET status='terisi' WHERE id=?", [id_kamar]);
    }

    await conn.commit();
    return res.json({ message: "Data penghuni diupdate" });

  } catch (err) {
    await conn.rollback();
    return handleError(res, err);
  } finally {
    conn.release();
  }
});


app.delete('/api/penghuni/:id', authMiddleware, requireRole('pemilik'), async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // get penghuni to find id_kamar and id_user
    const [[p]] = await conn.query('SELECT id_kamar, id_user FROM penghuni WHERE id = ?', [id]);
    if (!p) {
      await conn.rollback();
      return res.status(404).json({ error: 'Penghuni tidak ditemukan' });
    }

    const id_kamar = p.id_kamar;
    const id_user = p.id_user;

    await conn.query('DELETE FROM penghuni WHERE id = ?', [id]);
    // delete user account too (optional)
    await conn.query('DELETE FROM users WHERE id = ?', [id_user]);
    if (id_kamar) {
      await conn.query('UPDATE kamar SET status = "kosong" WHERE id = ?', [id_kamar]);
    }

    await conn.commit();
    return res.json({ message: 'Penghuni dihapus' });
  } catch (err) {
    await conn.rollback();
    return handleError(res, err);
  } finally {
    conn.release();
  }
});

/* ---------- KAMAR & PENGELUARAN ---------- */
app.get('/api/kamar', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
    SELECT k.id, k.nomor_kamar, k.harga, k.status,
       p.nama AS nama_penghuni,
       p.password
    FROM kamar k
    LEFT JOIN penghuni p ON p.id_kamar = k.id


    `);
    res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
});


app.post('/api/kamar', authMiddleware, requireRole('pemilik'), [
  body('nomor_kamar').isString().notEmpty(),
  body('harga').isNumeric(),
  body('status').optional().isIn(['terisi','kosong'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { nomor_kamar, harga, status = 'kosong' } = req.body;
  try {
    await pool.query('INSERT INTO kamar (nomor_kamar, harga, status) VALUES (?,?,?)', [nomor_kamar, harga, status]);
    return res.status(201).json({ message: 'Kamar dibuat' });
  } catch (err) {
    return handleError(res, err);
  }
});

app.put('/api/kamar/:id', authMiddleware, requireRole('pemilik'), async (req, res) => {
  const { id } = req.params;
  const { nomor_kamar, harga, status } = req.body;

  try {
      await pool.query(
          `UPDATE kamar SET nomor_kamar=?, harga=?, status=? WHERE id=?`,
          [nomor_kamar, harga, status, id]
      );
      res.json({ message: "Kamar diupdate" });
  } catch (err) {
      handleError(res, err);
  }
});


app.delete('/api/kamar/:id', authMiddleware, requireRole('pemilik'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM kamar WHERE id = ?', [id]);
    return res.json({ message: 'Kamar dihapus' });
  } catch (err) {
    return handleError(res, err);
  }
});

app.get('/api/pengeluaran', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pengeluaran');
    return res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
});

app.delete('/api/pengeluaran/:id', authMiddleware, requireRole('pemilik'), async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM pengeluaran WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pengeluaran tidak ditemukan" });
    }

    return res.json({ message: "Pengeluaran dihapus" });

  } catch (err) {
    return handleError(res, err);
  }
});

app.post('/api/pengeluaran', authMiddleware, requireRole('pemilik'), [
  body('kategori').isString().notEmpty(),
  body('jumlah').isNumeric(),
  body('tanggal').isString().optional({ nullable: true }),
  body('keterangan').isString().optional({ nullable: true })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { kategori, jumlah, tanggal = null, keterangan = null } = req.body;
  try {
    await pool.query('INSERT INTO pengeluaran (kategori, jumlah, tanggal, keterangan) VALUES (?,?,?,?)', [kategori, jumlah, tanggal, keterangan]);
    return res.status(201).json({ message: 'Pengeluaran dicatat' });
  } catch (err) {
    return handleError(res, err);
  }
});

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
