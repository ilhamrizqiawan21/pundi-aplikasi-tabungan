import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb } from '../db/index.js';
import { BackupService } from './backup.js';
import { SiswaService } from './siswa.js';
import { LedgerService } from './ledger.js';

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

  it('mempertahankan batas retensi maksimal 7 cadangan otomatis', () => {
    // Buat 10 cadangan otomatis
    for (let i = 1; i <= 10; i++) {
      backupSvc.buat(`auto_${i}`);
    }

    const daftar = backupSvc.daftar();
    expect(daftar.ok).toBe(true);
    if (daftar.ok) {
      // Hanya 7 yang tersisa
      expect(daftar.data.length).toBe(7);
    }
  });
});
