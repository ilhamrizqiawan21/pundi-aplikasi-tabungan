import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb, getDb } from './index.js';

describe('Database & Migrations', () => {
  let testDbPath: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-test-'));
    testDbPath = path.join(tmpDir, 'test_pundi.sqlite');
    initDb({
      dbPath: testDbPath,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    });
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore
      }
    }
  });

  it('berhasil menerapkan migrasi 0001_awal dan memuat tabel-tabel utama', () => {
    const db = getDb();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('tahun_ajaran');
    expect(tableNames).toContain('kelas');
    expect(tableNames).toContain('siswa');
    expect(tableNames).toContain('penempatan');
    expect(tableNames).toContain('transaksi');
    expect(tableNames).toContain('profil_sekolah');
    expect(tableNames).toContain('pengaturan');
    expect(tableNames).toContain('audit_log');
    expect(tableNames).toContain('sekuens');
    expect(tableNames).toContain('schema_migrations');
  });

  it('menolak operasi UPDATE dan DELETE pada tabel transaksi (Anti-ubah ERD §4.2)', () => {
    const db = getDb();

    // Buat siswa uji
    db.prepare(`
      INSERT INTO siswa (nomor, nama, status, dibuat_pada)
      VALUES ('T-000001', 'Siswa Uji', 'aktif', datetime('now'))
    `).run();

    // Buat transaksi uji
    db.prepare(`
      INSERT INTO transaksi (nomor_bukti, siswa_id, tanggal, jenis, nilai, saldo_setelah, dibuat_pada)
      VALUES ('TRX-TEST-001', 1, '2026-10-01', 'setoran', 50000, 50000, datetime('now'))
    `).run();

    // Coba UPDATE -> Harus dilempar error oleh Trigger
    expect(() => {
      db.prepare(`UPDATE transaksi SET nilai = 100000 WHERE id = 1`).run();
    }).toThrow(/transaksi_tidak_boleh_diubah/);

    // Coba DELETE -> Harus dilempar error oleh Trigger
    expect(() => {
      db.prepare(`DELETE FROM transaksi WHERE id = 1`).run();
    }).toThrow(/transaksi_tidak_boleh_dihapus/);
  });
});
