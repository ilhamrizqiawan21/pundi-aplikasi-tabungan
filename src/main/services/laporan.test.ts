import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { initDb, closeDb, getDb } from '../db/index.js';
import { AkademikService } from './akademik.js';
import { SiswaService } from './siswa.js';
import { LedgerService } from './ledger.js';
import { LaporanService } from './laporan.js';

describe('LaporanService.transaksi (CAP-11)', () => {
  let tmpDir: string;
  const laporan = new LaporanService();
  let ani: number;
  let budi: number;
  let kelas7A: number;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-laporan-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });
    const ta = new AkademikService().tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
    if (!ta.ok) throw new Error(ta.pesan);
    const k = new AkademikService().kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
    if (!k.ok) throw new Error(k.pesan);
    kelas7A = k.data.id;

    const siswa = new SiswaService();
    const a = siswa.simpan({ nama: 'Ani Fiktif', status: 'aktif', kelas_id: kelas7A });
    const b = siswa.simpan({ nama: 'Budi Fiktif', status: 'aktif' });
    if (!a.ok || !b.ok) throw new Error('siswa gagal dibuat');
    ani = a.data.id;
    budi = b.data.id;

    const ledger = new LedgerService();
    ledger.setor({ siswa_id: ani, nominal: 100000, tanggal: '2026-03-01' });
    ledger.setor({ siswa_id: budi, nominal: 40000, tanggal: '2026-03-02' });
    ledger.tarik({ siswa_id: ani, nominal: 30000, tanggal: '2026-03-02', keterangan: 'Beli buku' });
    ledger.setor({ siswa_id: ani, nominal: 5000, tanggal: '2026-03-05' });
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('memuat transaksi pada rentang tanggal (inklusif) berurutan, dengan total masuk dan keluar', () => {
    const r = laporan.transaksi({ dari: '2026-03-02', sampai: '2026-03-05' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.baris.map((b) => [b.tanggal, b.siswa_nama, b.nilai])).toEqual([
      ['2026-03-02', 'Budi Fiktif', 40000],
      ['2026-03-02', 'Ani Fiktif', -30000],
      ['2026-03-05', 'Ani Fiktif', 5000],
    ]);
    expect(r.data).toMatchObject({ jumlah: 3, total_masuk: 45000, total_keluar: 30000, terpotong: false });
  });

  it('menyaring menurut jenis dan kelas', () => {
    const tarik = laporan.transaksi({ dari: '2026-03-01', sampai: '2026-03-31', jenis: 'penarikan' });
    expect(tarik.ok && tarik.data.baris.map((b) => b.keterangan)).toEqual(['Beli buku']);

    const kelas = laporan.transaksi({ dari: '2026-03-01', sampai: '2026-03-31', kelasId: kelas7A });
    expect(kelas.ok && new Set(kelas.data.baris.map((b) => b.siswa_nama))).toEqual(new Set(['Ani Fiktif']));
    expect(kelas.ok && kelas.data.baris[0].kelas_nama).toBe('7A');
  });

  it('total selalu mencakup semua baris walau tampilan dipotong, dan selaras dengan buku besar', () => {
    const r = laporan.transaksi({ dari: '2026-03-01', sampai: '2026-03-31' }, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.baris).toHaveLength(2);
    expect(r.data).toMatchObject({ jumlah: 4, terpotong: true, total_masuk: 145000, total_keluar: 30000 });

    const jumlah = getDb().prepare('SELECT SUM(nilai) AS s FROM transaksi').get() as { s: number };
    expect(r.data.total_masuk - r.data.total_keluar).toBe(jumlah.s);
  });

  it('rentang tanpa transaksi mengembalikan hasil kosong, bukan galat', () => {
    const r = laporan.transaksi({ dari: '2030-01-01', sampai: '2030-01-31' });
    expect(r.ok && r.data).toEqual({ baris: [], jumlah: 0, total_masuk: 0, total_keluar: 0, terpotong: false });
  });

  it('mengekspor ke Excel: semua baris, nilai berupa angka, dan total di bawahnya', async () => {
    const target = path.join(tmpDir, 'transaksi.xlsx');
    const r = await laporan.eksporTransaksi(target, { dari: '2026-03-01', sampai: '2026-03-31' });
    expect(r.ok).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(target);
    const sheet = wb.getWorksheet('Transaksi')!;
    expect(sheet.getRow(1).getCell(1).value).toBe('Tanggal');
    const nilai = [2, 3, 4, 5].map((i) => sheet.getRow(i).getCell(7).value);
    expect(nilai.every((v) => typeof v === 'number')).toBe(true);
    expect(nilai).toEqual([100000, 40000, -30000, 5000]);
    expect(sheet.getRow(7).getCell(4).value).toBe('Total masuk');
    expect(sheet.getRow(7).getCell(7).value).toBe(145000);
    expect(sheet.getRow(9).getCell(7).value).toBe(115000); // selisih bersih
  });

  it('mengekspor rekap siswa ke Excel dengan saldo akhir', async () => {
    const target = path.join(tmpDir, 'rekap.xlsx');
    const r = await laporan.eksporRekapSiswa(target, {});
    expect(r.ok).toBe(true);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(target);
    const sheet = wb.getWorksheet('Rekap Tabungan Siswa')!;
    const baris = [2, 3].map((i) => [sheet.getRow(i).getCell(3).value, sheet.getRow(i).getCell(8).value]);
    expect(baris).toEqual(expect.arrayContaining([['Ani Fiktif', 75000], ['Budi Fiktif', 40000]]));
  });
});
