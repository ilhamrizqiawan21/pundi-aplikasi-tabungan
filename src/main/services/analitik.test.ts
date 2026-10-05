import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { initDb, closeDb } from '../db/index.js';
import { AkademikService } from './akademik.js';
import { SiswaService } from './siswa.js';
import { LedgerService } from './ledger.js';
import { LaporanService } from './laporan.js';
import { AuditService } from './audit.js';
import { generateRekapBulananHtml, labelBulan } from '../print/laporan.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import type { ProfilSekolah } from '../../shared/types.js';

const profil: ProfilSekolah = {
  id: 1,
  nama: 'SMP <i>Fiktif</i>',
  alamat: null,
  kota: null,
  bendahara: null,
  kepala: null,
  logo_rel_path: null,
  diubah_pada: '2026-01-01T00:00:00.000Z',
};

// CAP-22 (rekap bulanan, siswa pasif) dan riwayat aktivitas
describe('analitik dan riwayat aktivitas', () => {
  let tmpDir: string;
  const ledger = new LedgerService();
  const laporan = new LaporanService();
  let ani: number;
  let budi: number;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-analitik-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });
    const ta = new AkademikService().tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
    if (!ta.ok) throw new Error(ta.pesan);
    const k = new AkademikService().kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
    if (!k.ok) throw new Error(k.pesan);
    const siswa = new SiswaService();
    const a = siswa.simpan({ nama: 'Ani Fiktif', status: 'aktif', kelas_id: k.data.id });
    const b = siswa.simpan({ nama: 'Budi Fiktif', status: 'aktif', kelas_id: k.data.id });
    if (!a.ok || !b.ok) throw new Error('siswa gagal dibuat');
    ani = a.data.id;
    budi = b.data.id;
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rekap bulanan: total per bulan, bulan kosong bernilai 0, saldo berjalan memuat saldo awal periode', () => {
    ledger.setor({ siswa_id: ani, nominal: 50000, tanggal: '2026-01-10' }); // sebelum periode
    ledger.setor({ siswa_id: ani, nominal: 20000, tanggal: '2026-02-03' });
    ledger.tarik({ siswa_id: ani, nominal: 5000, tanggal: '2026-02-20' });
    ledger.setor({ siswa_id: budi, nominal: 10000, tanggal: '2026-04-01' }); // Maret kosong

    const r = laporan.rekapBulanan({ dari: '2026-02-01', sampai: '2026-04-30' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.saldo_awal).toBe(50000);
    expect(r.data.baris.map((b) => b.bulan)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(r.data.baris[0]).toMatchObject({ setoran: 20000, penarikan: 5000, jumlah_transaksi: 2, saldo_akhir: 65000 });
    expect(r.data.baris[1]).toMatchObject({ setoran: 0, penarikan: 0, jumlah_transaksi: 0, saldo_akhir: 65000 });
    expect(r.data.baris[2]).toMatchObject({ setoran: 10000, saldo_akhir: 75000 });
    // Saldo akhir bulan terakhir sama dengan jumlah saldo seluruh siswa (konsisten dengan CAP-17)
    const rekap = laporan.rekapSiswa({});
    expect(rekap.ok && rekap.data.reduce((t, s) => t + s.saldo_akhir, 0)).toBe(75000);
  });

  it('rekap bulanan menolak rentang terbalik dan lebih dari 60 bulan', () => {
    expect(laporan.rekapBulanan({ dari: '2026-05-01', sampai: '2026-04-30' }).ok).toBe(false);
    expect(laporan.rekapBulanan({ dari: '2020-01-01', sampai: '2026-12-31' }).ok).toBe(false);
    expect(laporan.rekapBulanan({ dari: '2025-12-01', sampai: '2026-02-28' }).ok).toBe(true);
  });

  it('saldo awal migrasi tidak dihitung sebagai setoran, tetapi masuk saldo akhir', () => {
    const sa = ledger.saldoAwal({ siswa_id: ani, nominal: 30000, tanggal: '2026-03-05' });
    expect(sa.ok).toBe(true);
    const r = laporan.rekapBulanan({ dari: '2026-03-01', sampai: '2026-03-31' });
    expect(r.ok && r.data.baris[0]).toMatchObject({ setoran: 0, jumlah_transaksi: 0, saldo_akhir: 30000 });
  });

  it('siswa pasif: hanya siswa aktif bersaldo yang lama tidak bertransaksi', () => {
    ledger.setor({ siswa_id: ani, nominal: 40000, tanggal: '2026-01-05' }); // sekitar 9 bulan lalu
    ledger.setor({ siswa_id: budi, nominal: 7000, tanggal: hariIniLokal() }); // baru
    const r = laporan.siswaPasif(3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.map((s) => s.siswa_id)).toEqual([ani]);
    expect(r.data[0]).toMatchObject({ saldo: 40000, transaksi_terakhir: '2026-01-05' });

    // Saldo nol tidak dianggap mengendap
    ledger.tarik({ siswa_id: ani, nominal: 40000, tanggal: '2026-01-06' });
    const lagi = laporan.siswaPasif(3);
    expect(lagi.ok && lagi.data).toEqual([]);
  });

  it('ekspor Excel rekap bulanan dapat dibaca kembali dengan total yang sama', async () => {
    ledger.setor({ siswa_id: ani, nominal: 20000, tanggal: '2026-02-03' });
    ledger.tarik({ siswa_id: ani, nominal: 5000, tanggal: '2026-02-20' });
    const berkas = path.join(tmpDir, 'rekap.xlsx');
    const r = await laporan.eksporRekapBulanan(berkas, { dari: '2026-02-01', sampai: '2026-03-31' });
    expect(r.ok).toBe(true);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(berkas);
    const sheet = wb.getWorksheet('Rekap Bulanan')!;
    const total = sheet.getRow(sheet.rowCount);
    expect(total.getCell(1).value).toBe('Total');
    expect(total.getCell(2).value).toBe(20000);
    expect(total.getCell(3).value).toBe(5000);
    expect(sheet.getRow(3).getCell(1).value).toBe('2026-02');
  });

  it('HTML rekap bulanan meng-escape nama sekolah dan memakai nama bulan Indonesia', () => {
    const data = { saldo_awal: 0, baris: [{ bulan: '2026-03', setoran: 1000, penarikan: 0, biaya_adm: 0, jumlah_transaksi: 1, saldo_akhir: 1000 }] };
    const html = generateRekapBulananHtml(profil, data, '2026-03-01', '2026-03-31');
    expect(html).not.toContain('<i>Fiktif</i>');
    expect(html).toContain('Maret 2026');
    expect(labelBulan('2026-12')).toBe('Desember 2026');
  });

  it('riwayat aktivitas: terbaru dulu dan dapat dilanjutkan dengan sebelumId', () => {
    for (let i = 1; i <= 5; i++) ledger.setor({ siswa_id: ani, nominal: i * 1000, tanggal: '2026-03-01' });
    const audit = new AuditService();
    const halaman1 = audit.daftar({ limit: 3 });
    expect(halaman1.ok).toBe(true);
    if (!halaman1.ok) return;
    expect(halaman1.data).toHaveLength(3);
    const ids = halaman1.data.map((a) => a.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    const halaman2 = audit.daftar({ limit: 3, sebelumId: ids[ids.length - 1] });
    expect(halaman2.ok && halaman2.data.every((a) => a.id < ids[ids.length - 1])).toBe(true);
    // Ringkasan tidak memuat nominal maupun nama (NFR-02)
    const semua = audit.daftar({ limit: 200 });
    expect(semua.ok && semua.data.every((a) => !/Fiktif|\d{4,}/.test(a.ringkasan))).toBe(true);
  });
});
