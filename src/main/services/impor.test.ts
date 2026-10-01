import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { initDb, closeDb } from '../db/index.js';
import { ImporService } from './impor.js';
import { SiswaService } from './siswa.js';
import { AkademikService } from './akademik.js';

describe('ImporService (CAP-04)', () => {
  let testDbPath: string;
  let tmpDir: string;
  let imporSvc: ImporService;
  let siswaSvc: SiswaService;
  let akademikSvc: AkademikService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-impor-test-'));
    testDbPath = path.join(tmpDir, 'test_impor.sqlite');
    initDb({
      dbPath: testDbPath,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    });
    imporSvc = new ImporService();
    siswaSvc = new SiswaService();
    akademikSvc = new AkademikService();

    akademikSvc.tahunAjaranSimpan({
      nama: '2025/2026',
      mulai: '2025-07-01',
      selesai: '2026-06-30',
      aktif: true,
    });
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

  async function createExcelFile(
    filename: string,
    rows: Array<{ nama: string; nis?: string; kelas?: string; alamat?: string }>
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Siswa');

    sheet.addRow(['No', 'Nama Siswa', 'NIS', 'Kelas', 'Alamat']);
    rows.forEach((r, idx) => {
      sheet.addRow([idx + 1, r.nama, r.nis || '', r.kelas || '', r.alamat || '']);
    });

    const filePath = path.join(tmpDir, filename);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  it('memvalidasi berkas excel dengan baris valid', async () => {
    const filePath = await createExcelFile('siswa_valid.xlsx', [
      { nama: 'Budi Darma', nis: '1001', kelas: '7A', alamat: 'Solo' },
      { nama: 'Siti Aminah', nis: '1002', kelas: '7B', alamat: 'Semarang' },
    ]);

    const res = await imporSvc.pratinjau(filePath);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.total_baris).toBe(2);
      expect(res.data.valid_count).toBe(2);
      expect(res.data.invalid_count).toBe(0);
    }
  });

  it('mendeteksi baris bermasalah (nama kosong & NIS duplikat)', async () => {
    // Daftarkan dulu satu siswa di DB dengan NIS 1001
    siswaSvc.simpan({ nama: 'Siswa Awal', nis: '1001', status: 'aktif' });

    const filePath = await createExcelFile('siswa_invalid.xlsx', [
      { nama: '', nis: '2001', kelas: '7A' }, // Nama kosong
      { nama: 'Siswa Duplikat DB', nis: '1001', kelas: '7A' }, // NIS sudah ada di DB
      { nama: 'Siswa Duplikat File 1', nis: '3001', kelas: '7B' },
      { nama: 'Siswa Duplikat File 2', nis: '3001', kelas: '7B' }, // NIS duplikat di file
      { nama: 'Siswa Sah', nis: '4001', kelas: '7C' },
    ]);

    const res = await imporSvc.pratinjau(filePath);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.total_baris).toBe(5);
      expect(res.data.invalid_count).toBe(3); // baris 1 (nama kosong), baris 2 (nis db), baris 4 (nis file)
      expect(res.data.valid_count).toBe(2);
    }
  });

  it('menerapkan impor secara atomik jika semua baris valid', async () => {
    const filePath = await createExcelFile('siswa_atomic.xlsx', [
      { nama: 'Zainab', nis: '5001', kelas: '7A' },
      { nama: 'Umar', nis: '5002', kelas: '7A' },
    ]);

    const importRes = await imporSvc.terapkan(filePath);
    expect(importRes.ok).toBe(true);
    if (importRes.ok) {
      expect(importRes.data.jumlah_diimpor).toBe(2);
    }

    const cari = siswaSvc.cari('Zainab');
    expect(cari.ok).toBe(true);
    if (cari.ok) {
      expect(cari.data.length).toBe(1);
      expect(cari.data[0].nomor).toMatch(/^T-\d{6}$/);
    }
  });
});
