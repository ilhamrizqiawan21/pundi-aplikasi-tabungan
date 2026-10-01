import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { initDb, closeDb, getDb } from '../db/index.js';
import { ImporService, tebakPemetaan, tingkatDariNama } from './impor.js';
import { IntegritasService } from './integritas.js';
import { LaporanService } from './laporan.js';
import { hariIniLokal } from '../../shared/tanggal.js';
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

  // ---------- CAP-14: pemetaan kolom dan saldo awal ----------
  describe('pemetaan kolom dan saldo awal (CAP-14)', () => {
    async function buatLembar(nama: string, baris: unknown[][], isi?: (sheet: ExcelJS.Worksheet) => void): Promise<string> {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Data');
      baris.forEach((b) => sheet.addRow(b));
      isi?.(sheet);
      const jalur = path.join(tmpDir, nama);
      await wb.xlsx.writeFile(jalur);
      return jalur;
    }
    const jumlahSiswa = () => (getDb().prepare('SELECT COUNT(*) AS n FROM siswa').get() as { n: number }).n;
    const jumlahTrx = () => (getDb().prepare('SELECT COUNT(*) AS n FROM transaksi').get() as { n: number }).n;

    it('menebak kolom dari judul tanpa tertipu kata yang mirip (Jenis Kelamin, Nama Ibu)', () => {
      expect(tebakPemetaan(['No', 'Jenis Kelamin', 'Nama Ibu', 'Nama Siswa', 'NISN', 'Rombel', 'Saldo (Rp)', 'Alamat Rumah'])).toEqual({
        nama: 3,
        nis: 4,
        kelas: 5,
        alamat: 7,
        saldo: 6,
      });
      // Satu kolom tidak dipakai dua isian: "Nama Kelas" milik kelas, bukan nama siswa
      expect(tebakPemetaan(['Nama Kelas', 'Nama'])).toMatchObject({ nama: 1, kelas: 0 });
      expect(tebakPemetaan(['A', 'B', 'C'])).toEqual({ nama: -1, nis: -1, kelas: -1, alamat: -1, saldo: -1 });
    });

    it('menebak tingkat kelas dari nama: angka, romawi, atau 1', () => {
      expect(['7A', '8 B', 'VII A', 'VIIIB', 'xii IPA', 'IX', 'Alpha', '21A'].map(tingkatDariNama)).toEqual([7, 8, 7, 8, 12, 9, 1, 1]);
    });

    it('menemukan judul walau ada baris judul laporan di atasnya, dan menyertakan contoh baris', async () => {
      const f = await buatLembar('judul.xlsx', [
        ['DAFTAR TABUNGAN SISWA'],
        [],
        ['No', 'Nama Siswa', 'Saldo'],
        [1, 'Ani Fiktif', 50000],
        [2, 'Budi Fiktif', 25000],
      ]);
      const r = await imporSvc.pratinjau(f);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.baris_header).toBe(3);
      expect(r.data.pemetaan).toMatchObject({ nama: 1, saldo: 2 });
      expect(r.data.contoh[0]).toEqual(['1', 'Ani Fiktif', '50000']);
      expect(r.data).toMatchObject({ total_baris: 2, valid_count: 2, total_saldo: 75000, jumlah_dengan_saldo: 2 });
    });

    it('judul tidak dikenali: meminta pemilihan kolom, lalu bekerja dengan pemetaan manual', async () => {
      const f = await buatLembar('aneh.xlsx', [
        ['Kolom X', 'Kolom Y'],
        ['Citra Fiktif', 10000],
      ]);
      const r1 = await imporSvc.pratinjau(f);
      expect(r1.ok && r1.data.peringatan[0]).toContain('nama siswa');
      expect(r1.ok && r1.data.baris).toEqual([]);
      expect((await imporSvc.terapkan(f)).ok).toBe(false);

      const opsi = { pemetaan: { nama: 0, nis: -1, kelas: -1, alamat: -1, saldo: 1 } };
      const r2 = await imporSvc.pratinjau(f, opsi);
      expect(r2.ok && r2.data).toMatchObject({ valid_count: 1, total_saldo: 10000 });
      expect((await imporSvc.terapkan(f, opsi)).ok).toBe(true);
    });

    it('membaca saldo berbagai bentuk (angka, teks Rp, strip, rumus) dan menolak pecahan serta negatif', async () => {
      const f = await buatLembar(
        'saldo.xlsx',
        [
          ['Nama', 'Saldo'],
          ['Ani', 1250000],
          ['Budi', 'Rp 75.000'],
          ['Citra', '-'],
          ['Dewi', null],
          ['Eko', null], // diisi rumus
          ['Fani', '1.250,50'],
          ['Gina', -5000],
          ['Hadi', 'seribu'],
        ],
        (sheet) => {
          sheet.getCell('B6').value = { formula: '25000*2', result: 50000 };
        }
      );
      const r = await imporSvc.pratinjau(f);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const per = Object.fromEntries(r.data.baris.map((b) => [b.nama, b]));
      expect(per.Ani.saldo).toBe(1250000);
      expect(per.Budi.saldo).toBe(75000);
      expect(per.Citra.saldo).toBeNull();
      expect(per.Dewi.saldo).toBeNull();
      expect(per.Eko.saldo).toBe(50000);
      for (const n of ['Fani', 'Gina', 'Hadi']) {
        expect(per[n].valid).toBe(false);
        expect(per[n].alasan_galat).toMatch(/^Saldo:/);
      }
      expect(r.data).toMatchObject({ valid_count: 5, invalid_count: 3, total_saldo: 1250000 + 75000 + 50000 });
    });

    it('menerapkan: siswa dan saldo awal tercatat sebagai transaksi saldo_awal, saldo seimbang, kas harian tidak terpengaruh', async () => {
      const f = await buatLembar('terapkan.xlsx', [
        ['Nama Siswa', 'NIS', 'Kelas', 'Saldo'],
        ['Ani Fiktif', '1001', '7A', 100000],
        ['Budi Fiktif', '1002', 'VIII B', 'Rp 40.000'],
        ['Citra Fiktif', '1003', '7A', null],
      ]);
      const pr = await imporSvc.pratinjau(f);
      expect(pr.ok && pr.data.kelas_baru.sort()).toEqual(['7A', 'VIII B']);

      const r = await imporSvc.terapkan(f, { tanggal_saldo_awal: '2026-03-01' });
      expect(r.ok && r.data).toEqual({ jumlah_diimpor: 3, jumlah_saldo_awal: 2, total_saldo: 140000 });

      const trx = getDb().prepare('SELECT jenis, nilai, saldo_setelah, tanggal, impor_id, kelas_id FROM transaksi ORDER BY id').all() as Array<{
        jenis: string; nilai: number; saldo_setelah: number; tanggal: string; impor_id: number | null; kelas_id: number | null;
      }>;
      expect(trx.map((t) => [t.jenis, t.nilai, t.saldo_setelah, t.tanggal])).toEqual([
        ['saldo_awal', 100000, 100000, '2026-03-01'],
        ['saldo_awal', 40000, 40000, '2026-03-01'],
      ]);
      expect(trx.every((t) => t.impor_id !== null && t.kelas_id !== null)).toBe(true);

      const kelas = getDb().prepare('SELECT nama, tingkat FROM kelas ORDER BY nama').all();
      expect(kelas).toEqual([{ nama: '7A', tingkat: 7 }, { nama: 'VIII B', tingkat: 8 }]);

      const periksa = new IntegritasService().periksa();
      expect(periksa.ok && periksa.data.apakah_seimbang).toBe(true);
      const kas = new LaporanService().kasHarian('2026-03-01');
      expect(kas.ok && kas.data).toMatchObject({ total_setoran: 0, jumlah_transaksi: 0, saldo_seluruh_siswa: 140000 });

      // Impor ulang berkas yang sama: NIS sudah ada, tidak menggandakan siswa
      const ulang = await imporSvc.terapkan(f);
      expect(ulang.ok).toBe(false);
      expect(jumlahSiswa()).toBe(3);
    });

    it('angka kontrol yang tidak cocok membatalkan seluruh impor; yang cocok meloloskannya', async () => {
      const f = await buatLembar('kontrol.xlsx', [
        ['Nama', 'Saldo'],
        ['Ani Fiktif', 100000],
        ['Budi Fiktif', 50000],
      ]);
      const salahJumlah = await imporSvc.terapkan(f, { kontrol: { jumlah_siswa: 3 } });
      expect(salahJumlah.ok).toBe(false);
      const salahSaldo = await imporSvc.terapkan(f, { kontrol: { jumlah_siswa: 2, total_saldo: 149999 } });
      expect(salahSaldo.ok === false && salahSaldo.pesan).toContain('Rp 150.000');
      expect(jumlahSiswa()).toBe(0);
      expect(jumlahTrx()).toBe(0);

      const cocok = await imporSvc.terapkan(f, { kontrol: { jumlah_siswa: 2, total_saldo: 150000 } });
      expect(cocok.ok).toBe(true);
      expect(jumlahTrx()).toBe(2);
    });

    it('satu baris bermasalah membatalkan semuanya, tanpa siswa, saldo, atau kelas yang tertinggal', async () => {
      const f = await buatLembar('sebagian.xlsx', [
        ['Nama', 'Kelas', 'Saldo'],
        ['Ani Fiktif', '9Z', 100000],
        ['Budi Fiktif', '9Z', '1.250,50'],
      ]);
      const r = await imporSvc.terapkan(f);
      expect(r.ok).toBe(false);
      expect(jumlahSiswa()).toBe(0);
      expect(jumlahTrx()).toBe(0);
      expect((getDb().prepare("SELECT COUNT(*) AS n FROM kelas WHERE nama = '9Z'").get() as { n: number }).n).toBe(0);
    });

    it('membaca CSV berpemisah titik koma dengan BOM, seperti ekspor Excel berbahasa Indonesia', async () => {
      const csv = path.join(tmpDir, 'siswa.csv');
      fs.writeFileSync(csv, '\uFEFFNama Siswa;NIS;Kelas;Saldo Akhir\r\nAni Fiktif;007;7A;50.000\r\nBudi Fiktif;1E3;7A;Rp 25.000\r\n', 'utf-8');
      const r = await imporSvc.pratinjau(csv);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.pemetaan).toEqual({ nama: 0, nis: 1, kelas: 2, alamat: -1, saldo: 3 });
      expect(r.data).toMatchObject({ valid_count: 2, total_saldo: 75000 });
      // Sel CSV tetap teks: "50.000" bukan 50, NIS "007" tidak menjadi 7, "1E3" tidak menjadi 1000
      expect(r.data.baris.map((b) => b.nis)).toEqual(['007', '1E3']);
    });

    it('memberi catatan untuk nama yang sama dengan siswa lama tanpa NIS, dan tanggal saldo bawaan adalah hari ini', async () => {
      siswaSvc.simpan({ nama: 'Ani Fiktif', status: 'aktif' });
      const f = await buatLembar('sama.xlsx', [
        ['Nama', 'Saldo'],
        ['Ani Fiktif', 1000],
      ]);
      const pr = await imporSvc.pratinjau(f);
      expect(pr.ok && pr.data.baris[0].catatan).toContain('Nama sama');
      expect(pr.ok && pr.data.peringatan.some((p) => p.includes('bernama sama'))).toBe(true);

      await imporSvc.terapkan(f);
      const t = getDb().prepare('SELECT tanggal FROM transaksi').get() as { tanggal: string };
      expect(t.tanggal).toBe(hariIniLokal());
    });
  });
});
