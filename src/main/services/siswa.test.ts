import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb } from '../db/index.js';
import { SiswaService } from './siswa.js';
import { AkademikService } from './akademik.js';
import { LedgerService } from './ledger.js';

describe('SiswaService (CAP-03)', () => {
  let testDbPath: string;
  let siswaSvc: SiswaService;
  let akademikSvc: AkademikService;
  let ledgerSvc: LedgerService;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-siswa-test-'));
    testDbPath = path.join(tmpDir, 'test_siswa.sqlite');
    initDb({
      dbPath: testDbPath,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    });
    siswaSvc = new SiswaService();
    akademikSvc = new AkademikService();
    ledgerSvc = new LedgerService();

    // Setup tahun ajaran aktif & kelas
    const taRes = akademikSvc.tahunAjaranSimpan({
      nama: '2025/2026',
      mulai: '2025-07-01',
      selesai: '2026-06-30',
      aktif: true,
    });
    if (taRes.ok) {
      akademikSvc.kelasSimpan({
        tahun_ajaran_id: taRes.data.id,
        nama: '7A',
        tingkat: 7,
        urutan: 1,
      });
      akademikSvc.kelasSimpan({
        tahun_ajaran_id: taRes.data.id,
        nama: '7B',
        tingkat: 7,
        urutan: 2,
      });
    }
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

  it('membuat siswa baru dengan nomor rekening otomatis unik berurutan', () => {
    const s1 = siswaSvc.simpan({ nama: 'Ahmad Faiz', status: 'aktif' });
    expect(s1.ok).toBe(true);
    if (s1.ok) {
      expect(s1.data.nomor).toBe('T-000001');
      expect(s1.data.nama).toBe('Ahmad Faiz');
      expect(s1.data.status).toBe('aktif');
      expect(s1.data.saldo).toBe(0);
    }

    const s2 = siswaSvc.simpan({ nama: 'Budi Santoso', status: 'aktif' });
    expect(s2.ok).toBe(true);
    if (s2.ok) {
      expect(s2.data.nomor).toBe('T-000002');
    }
  });

  it('menyimpan penempatan kelas siswa pada tahun ajaran aktif', () => {
    const kelasList = akademikSvc.kelasDaftar();
    expect(kelasList.ok).toBe(true);
    if (!kelasList.ok) return;

    const kelas7A = kelasList.data.find((k) => k.nama === '7A')!;

    const s = siswaSvc.simpan({
      nama: 'Citra Dewi',
      status: 'aktif',
      kelas_id: kelas7A.id,
    });

    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.data.kelas_id).toBe(kelas7A.id);
      expect(s.data.kelas_nama).toBe('7A');
    }
  });

  it('dapat memperbarui data diri dan kelas siswa', () => {
    const s = siswaSvc.simpan({ nama: 'Doni', status: 'aktif' });
    if (!s.ok) return;

    const kelasList = akademikSvc.kelasDaftar();
    if (!kelasList.ok) return;
    const kelas7B = kelasList.data.find((k) => k.nama === '7B')!;

    const updated = siswaSvc.simpan({
      id: s.data.id,
      nama: 'Doni Pratama',
      nis: '12345',
      alamat: 'Jl. Merdeka No. 10',
      status: 'lulus',
      kelas_id: kelas7B.id,
    });

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.nama).toBe('Doni Pratama');
      expect(updated.data.nis).toBe('12345');
      expect(updated.data.alamat).toBe('Jl. Merdeka No. 10');
      expect(updated.data.status).toBe('lulus');
      expect(updated.data.kelas_id).toBe(kelas7B.id);
      expect(updated.data.kelas_nama).toBe('7B');
      // Nomor rekening tidak berubah
      expect(updated.data.nomor).toBe(s.data.nomor);
    }
  });

  it('dapat mencari siswa berdasarkan nama, nomor rekening, atau NIS', () => {
    siswaSvc.simpan({ nama: 'Eka Saputra', nis: '9901', status: 'aktif' });
    siswaSvc.simpan({ nama: 'Fajar Nugraha', nis: '9902', status: 'aktif' });

    const cariNama = siswaSvc.cari('Eka');
    expect(cariNama.ok).toBe(true);
    if (cariNama.ok) {
      expect(cariNama.data.length).toBe(1);
      expect(cariNama.data[0].nama).toBe('Eka Saputra');
    }

    const cariNis = siswaSvc.cari('9902');
    expect(cariNis.ok).toBe(true);
    if (cariNis.ok) {
      expect(cariNis.data.length).toBe(1);
      expect(cariNis.data[0].nama).toBe('Fajar Nugraha');
    }
  });

  it('menolak penghapusan siswa yang memiliki riwayat transaksi (CAP-03)', () => {
    const s = siswaSvc.simpan({ nama: 'Gilang Ramadhan', status: 'aktif' });
    if (!s.ok) return;

    // Tambahkan setoran
    ledgerSvc.setor({ siswa_id: s.data.id, nominal: 50000 });

    // Coba hapus siswa
    const hapusRes = siswaSvc.hapus(s.data.id);
    expect(hapusRes.ok).toBe(false);
    if (!hapusRes.ok) {
      expect(hapusRes.kode).toBe('SISWA_SUDAH_PUNYA_TRANSAKSI');
    }

    // Siswa masih ada
    const detail = siswaSvc.detail(s.data.id);
    expect(detail.ok).toBe(true);
  });

  it('mengizinkan penghapusan siswa yang belum memiliki transaksi', () => {
    const s = siswaSvc.simpan({ nama: 'Hendra Tanpa Transaksi', status: 'aktif' });
    if (!s.ok) return;

    const hapusRes = siswaSvc.hapus(s.data.id);
    expect(hapusRes.ok).toBe(true);

    const detail = siswaSvc.detail(s.data.id);
    expect(detail.ok).toBe(false);
    if (!detail.ok) {
      expect(detail.kode).toBe('SISWA_TIDAK_DITEMUKAN');
    }
  });
});
