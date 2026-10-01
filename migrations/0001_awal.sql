-- Migrasi Awal Pundi 0001 (ERD §2 & §3)

-- 1. Tahun Ajaran
CREATE TABLE IF NOT EXISTS tahun_ajaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL UNIQUE,
  mulai TEXT NOT NULL,
  selesai TEXT NOT NULL,
  aktif INTEGER NOT NULL DEFAULT 0 CHECK (aktif IN (0, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tahun_ajaran_aktif_unik ON tahun_ajaran (aktif) WHERE aktif = 1;

-- 2. Kelas
CREATE TABLE IF NOT EXISTS kelas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_ajaran_id INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  nama TEXT NOT NULL,
  tingkat INTEGER NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tahun_ajaran_id, nama)
);

-- 3. Siswa
CREATE TABLE IF NOT EXISTS siswa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor TEXT NOT NULL UNIQUE,
  nis TEXT UNIQUE,
  nama TEXT NOT NULL,
  alamat TEXT,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'lulus', 'keluar')),
  dibuat_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_siswa_nama ON siswa (nama);
CREATE INDEX IF NOT EXISTS idx_siswa_status ON siswa (status);

-- 4. Penempatan Siswa
CREATE TABLE IF NOT EXISTS penempatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE RESTRICT,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE RESTRICT,
  tahun_ajaran_id INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  UNIQUE (siswa_id, tahun_ajaran_id)
);

CREATE INDEX IF NOT EXISTS idx_penempatan_kelas ON penempatan (kelas_id);

-- 5. Impor
CREATE TABLE IF NOT EXISTS impor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL,
  nama_berkas TEXT NOT NULL,
  jumlah_baris INTEGER NOT NULL,
  dibuat_pada TEXT NOT NULL
);

-- 6. Transaksi (Buku Besar Tambah-Saja)
CREATE TABLE IF NOT EXISTS transaksi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_bukti TEXT NOT NULL UNIQUE,
  siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE RESTRICT,
  kelas_id INTEGER REFERENCES kelas(id) ON DELETE RESTRICT,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('setoran', 'penarikan', 'biaya_adm', 'pembalik', 'saldo_awal')),
  nilai INTEGER NOT NULL CHECK (nilai <> 0),
  saldo_setelah INTEGER NOT NULL CHECK (saldo_setelah >= 0),
  keterangan TEXT,
  membalik_id INTEGER UNIQUE REFERENCES transaksi(id),
  impor_id INTEGER REFERENCES impor(id),
  dibuat_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaksi_siswa_id ON transaksi (siswa_id, id);
CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON transaksi (tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_kelas_tanggal ON transaksi (kelas_id, tanggal);

-- Trigger anti-ubah & anti-hapus transaksi (ERD §4.2)
CREATE TRIGGER IF NOT EXISTS trg_transaksi_no_update
BEFORE UPDATE ON transaksi
BEGIN
  SELECT RAISE(ABORT, 'transaksi_tidak_boleh_diubah');
END;

CREATE TRIGGER IF NOT EXISTS trg_transaksi_no_delete
BEFORE DELETE ON transaksi
BEGIN
  SELECT RAISE(ABORT, 'transaksi_tidak_boleh_dihapus');
END;

-- 7. Profil Sekolah
CREATE TABLE IF NOT EXISTS profil_sekolah (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nama TEXT NOT NULL,
  alamat TEXT,
  kota TEXT,
  bendahara TEXT,
  kepala TEXT,
  logo_rel_path TEXT,
  diubah_pada TEXT NOT NULL
);

INSERT OR IGNORE INTO profil_sekolah (id, nama, alamat, kota, bendahara, kepala, logo_rel_path, diubah_pada)
VALUES (1, 'Madrasah / Sekolah', NULL, NULL, NULL, NULL, NULL, datetime('now'));

-- 8. Pengaturan Kunci-Nilai
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai_json TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

INSERT OR IGNORE INTO pengaturan (kunci, nilai_json, diubah_pada) VALUES
  ('tema', '"putih"', datetime('now')),
  ('folder_backup', '""', datetime('now')),
  ('backup_otomatis', 'true', datetime('now')),
  ('ukuran_struk', '"80"', datetime('now')),
  ('pin_hash', 'null', datetime('now'));

-- 9. Audit Log (Tanpa nominal/nama siswa)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT NOT NULL,
  aksi TEXT NOT NULL,
  entitas TEXT NOT NULL,
  entitas_id INTEGER,
  ringkasan TEXT NOT NULL
);

-- 10. Penghitung Sekuensial Nomor Unik
CREATE TABLE IF NOT EXISTS sekuens (
  nama TEXT PRIMARY KEY,
  nilai INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO sekuens (nama, nilai) VALUES
  ('nomor_siswa', 0),
  ('nomor_bukti_transaksi', 0);

-- 11. Migrasi Skema
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (1, '0001_awal', datetime('now'));
