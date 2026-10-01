import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DbConfig {
  dbPath: string;
  migrationsDir?: string;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Basis data belum diinisialisasi.');
  }
  return dbInstance;
}

export function initDb(config: DbConfig): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Pastikan folder database ada
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(config.dbPath);

  // Aturan Integritas ERD §4
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');

  // Jalankan migrasi
  runMigrations(db, config.migrationsDir);

  dbInstance = db;
  return db;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Skema cadangan embedded jika folder migrations tidak disertakan langsung dalam package
const INITIAL_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS tahun_ajaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL UNIQUE,
  mulai TEXT NOT NULL,
  selesai TEXT NOT NULL,
  aktif INTEGER NOT NULL DEFAULT 0 CHECK (aktif IN (0, 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tahun_ajaran_aktif_unik ON tahun_ajaran (aktif) WHERE aktif = 1;

CREATE TABLE IF NOT EXISTS kelas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_ajaran_id INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  nama TEXT NOT NULL,
  tingkat INTEGER NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tahun_ajaran_id, nama)
);

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

CREATE TABLE IF NOT EXISTS penempatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE RESTRICT,
  kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE RESTRICT,
  tahun_ajaran_id INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  UNIQUE (siswa_id, tahun_ajaran_id)
);
CREATE INDEX IF NOT EXISTS idx_penempatan_kelas ON penempatan (kelas_id);

CREATE TABLE IF NOT EXISTS impor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL,
  nama_berkas TEXT NOT NULL,
  jumlah_baris INTEGER NOT NULL,
  dibuat_pada TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT NOT NULL,
  aksi TEXT NOT NULL,
  entitas TEXT NOT NULL,
  entitas_id INTEGER,
  ringkasan TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sekuens (
  nama TEXT PRIMARY KEY,
  nilai INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sekuens (nama, nilai) VALUES
  ('nomor_siswa', 0),
  ('nomor_bukti_transaksi', 0);
`;

function runMigrations(db: Database.Database, migrationsDir?: string): void {
  // Buat tabel schema_migrations jika belum ada
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const candidateDirs = [
    migrationsDir,
    path.join(__dirname, '../../../migrations'),
    path.join(__dirname, '../../migrations'),
    path.join(__dirname, '../migrations'),
    path.join(process.cwd(), 'migrations'),
  ].filter(Boolean) as string[];

  let resolvedDir: string | null = null;
  for (const d of candidateDirs) {
    if (fs.existsSync(d)) {
      resolvedDir = d;
      break;
    }
  }

  let migrationFiles: string[] = [];
  if (resolvedDir && fs.existsSync(resolvedDir)) {
    migrationFiles = fs
      .readdirSync(resolvedDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  }

  const appliedRows = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  if (migrationFiles.length > 0 && resolvedDir) {
    for (const file of migrationFiles) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;
      const version = parseInt(match[1], 10);
      const name = match[2];

      if (!appliedVersions.has(version)) {
        const sqlContent = fs.readFileSync(path.join(resolvedDir, file), 'utf-8');
        const applyTx = db.transaction(() => {
          db.exec(sqlContent);
          db.prepare(
            'INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime(\'now\'))'
          ).run(version, name);
        });
        applyTx();
      }
    }
  } else {
    // Jalankan migrasi 1 dari embedded template jika belum diterapkan
    if (!appliedVersions.has(1)) {
      const applyTx = db.transaction(() => {
        db.exec(INITIAL_MIGRATION_SQL);
        db.prepare(
          'INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (1, \'0001_awal\', datetime(\'now\'))'
        ).run();
      });
      applyTx();
    }
  }
}
