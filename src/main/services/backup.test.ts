import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { initDb, closeDb, getDb } from '../db/index.js';
import { BackupService } from './backup.js';
import { SiswaService } from './siswa.js';
import { LedgerService } from './ledger.js';
import { IntegritasService } from './integritas.js';

describe('BackupService (CAP-13)', () => {
  let tmpDir: string;
  let testDbPath: string;
  let backupDir: string;
  let backupSvc: BackupService;
  let siswaSvc: SiswaService;
  let ledgerSvc: LedgerService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-backup-test-'));
    testDbPath = path.join(tmpDir, 'test_pundi.sqlite');
    backupDir = path.join(tmpDir, 'backups');

    initDb({
      dbPath: testDbPath,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    });

    backupSvc = new BackupService(backupDir);
    siswaSvc = new SiswaService();
    ledgerSvc = new LedgerService();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('berhasil membuat cadangan dengan VACUUM INTO dan mencatat audit log', () => {
    // Tambah data awal
    const s = siswaSvc.simpan({ nama: 'Siswa Uji Backup', status: 'aktif' });
    if (s.ok) {
      ledgerSvc.setor({ siswa_id: s.data.id, nominal: 75000 });
    }

    const res = backupSvc.buat('manual_test');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.berkas).toContain('manual_test');
      expect(res.data.ukuran_bytes).toBeGreaterThan(0);
    }

    const daftar = backupSvc.daftar();
    expect(daftar.ok).toBe(true);
    if (daftar.ok) {
      expect(daftar.data.length).toBe(1);
    }
  });

  it('membatasi cadangan otomatis menjadi 7 dan tidak pernah menghapus cadangan manual', () => {
    const manual = backupSvc.buat('penting', 'manual');
    expect(manual.ok).toBe(true);
    for (let i = 1; i <= 10; i++) {
      backupSvc.buat(`n${i}`, 'otomatis');
    }

    const daftar = backupSvc.daftar();
    expect(daftar.ok).toBe(true);
    if (daftar.ok) {
      expect(daftar.data.filter((d) => d.jenis === 'otomatis').length).toBe(7);
      expect(daftar.data.filter((d) => d.jenis === 'manual').length).toBe(1);
    }
  });

  describe('restore', () => {
    const saldo = (siswaId: number) =>
      (
        getDb()
          .prepare('SELECT saldo_setelah AS s FROM transaksi WHERE siswa_id = ? ORDER BY id DESC LIMIT 1')
          .get(siswaId) as { s: number }
      ).s;

    function siapkanSiswaDenganCadangan() {
      const s = siswaSvc.simpan({ nama: 'Siswa Uji Pulih', status: 'aktif' });
      if (!s.ok) throw new Error('siswa gagal dibuat');
      ledgerSvc.setor({ siswa_id: s.data.id, nominal: 100000 });
      const b = backupSvc.buat('snapshot');
      if (!b.ok) throw new Error('cadangan gagal dibuat');
      return { siswaId: s.data.id, jalur: path.join(backupDir, b.data.berkas) };
    }

    /** Menyalin cadangan lalu mengubahnya lewat fungsi `ubah` (di luar jalur ledger, hanya untuk menyiapkan berkas rusak). */
    function cadanganRusak(jalur: string, ubah: (db: Database.Database) => void): string {
      const hasil = path.join(tmpDir, 'rusak.sqlite');
      fs.copyFileSync(jalur, hasil);
      const db = new Database(hasil);
      try {
        ubah(db);
      } finally {
        db.close();
      }
      return hasil;
    }

    it('mengembalikan data ke keadaan cadangan, membuat cadangan pengaman, dan basis data tetap bisa dipakai', () => {
      const { siswaId, jalur } = siapkanSiswaDenganCadangan();
      ledgerSvc.setor({ siswa_id: siswaId, nominal: 50000 });
      expect(saldo(siswaId)).toBe(150000);

      const res = backupSvc.restore(jalur);
      expect(res.ok).toBe(true);

      expect(saldo(siswaId)).toBe(100000);
      const periksa = new IntegritasService().periksa();
      expect(periksa.ok && periksa.data.apakah_seimbang).toBe(true);

      const daftar = backupSvc.daftar();
      expect(daftar.ok && daftar.data.some((d) => d.jenis === 'pre-restore')).toBe(true);

      // Penulisan setelah restore tetap berjalan
      expect(ledgerSvc.setor({ siswa_id: siswaId, nominal: 25000 }).ok).toBe(true);
      expect(saldo(siswaId)).toBe(125000);
      expect(fs.existsSync(`${testDbPath}.restore`)).toBe(false);
    });

    it('cadangan pengaman berisi data sebelum dipulihkan', () => {
      const { siswaId, jalur } = siapkanSiswaDenganCadangan();
      ledgerSvc.setor({ siswa_id: siswaId, nominal: 50000 });
      expect(backupSvc.restore(jalur).ok).toBe(true);

      const daftar = backupSvc.daftar();
      const pengaman = daftar.ok ? daftar.data.find((d) => d.jenis === 'pre-restore') : undefined;
      expect(pengaman).toBeDefined();
      const cand = new Database(pengaman!.jalur, { readonly: true });
      try {
        const row = cand
          .prepare('SELECT saldo_setelah AS s FROM transaksi WHERE siswa_id = ? ORDER BY id DESC LIMIT 1')
          .get(siswaId) as { s: number };
        expect(row.s).toBe(150000);
      } finally {
        cand.close();
      }
    });

    it('menolak berkas yang bukan basis data tanpa mengubah data aktif', () => {
      const { siswaId } = siapkanSiswaDenganCadangan();
      const palsu = path.join(tmpDir, 'bukan.sqlite');
      fs.writeFileSync(palsu, 'ini bukan basis data');

      const res = backupSvc.restore(palsu);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.kode).toBe('FILE_TIDAK_VALID');
      expect(saldo(siswaId)).toBe(100000);
      expect(fs.existsSync(`${testDbPath}.restore`)).toBe(false);
    });

    it('menolak basis data SQLite lain yang bukan cadangan Pundi', () => {
      const { siswaId } = siapkanSiswaDenganCadangan();
      const lain = path.join(tmpDir, 'lain.sqlite');
      const db = new Database(lain);
      db.exec('CREATE TABLE barang (id INTEGER PRIMARY KEY)');
      db.close();

      const res = backupSvc.restore(lain);
      expect(res.ok).toBe(false);
      expect(saldo(siswaId)).toBe(100000);
    });

    it('menolak cadangan tanpa pemicu anti-ubah transaksi', () => {
      const { siswaId, jalur } = siapkanSiswaDenganCadangan();
      const tanpaPemicu = cadanganRusak(jalur, (db) => {
        db.exec('DROP TRIGGER trg_transaksi_no_update; DROP TRIGGER trg_transaksi_no_delete;');
      });

      const res = backupSvc.restore(tanpaPemicu);
      expect(res.ok).toBe(false);
      expect(saldo(siswaId)).toBe(100000);
    });

    it('menolak cadangan yang saldonya tidak cocok dengan riwayat (CAP-17)', () => {
      const { siswaId, jalur } = siapkanSiswaDenganCadangan();
      const dimanipulasi = cadanganRusak(jalur, (db) => {
        db.exec('DROP TRIGGER trg_transaksi_no_update;');
        db.exec('UPDATE transaksi SET saldo_setelah = saldo_setelah + 1');
        db.exec(
          `CREATE TRIGGER trg_transaksi_no_update BEFORE UPDATE ON transaksi
           BEGIN SELECT RAISE(ABORT, 'transaksi_tidak_boleh_diubah'); END;`
        );
      });

      const res = backupSvc.restore(dimanipulasi);
      expect(res.ok).toBe(false);
      expect(saldo(siswaId)).toBe(100000);
    });
  });
});
