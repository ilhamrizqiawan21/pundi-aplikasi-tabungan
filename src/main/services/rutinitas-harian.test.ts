import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb, getDb } from '../db/index.js';
import { AkademikService } from './akademik.js';
import { SiswaService } from './siswa.js';
import { LedgerService } from './ledger.js';
import { LaporanService } from './laporan.js';
import { IntegritasService } from './integritas.js';
import { BackupService } from './backup.js';
import Database from 'better-sqlite3';
import { generateSlipSaldoHtml, generateTutupKasHtml } from '../print/laporan.js';
import type { ProfilSekolah } from '../../shared/types.js';

const profil: ProfilSekolah = {
  id: 1,
  nama: 'SMP <b>Fiktif</b>',
  alamat: null,
  kota: null,
  bendahara: null,
  kepala: null,
  logo_rel_path: null,
  diubah_pada: '2026-01-01T00:00:00.000Z',
};

// Alur harian bendahara: setoran massal per kelas (CAP-19), slip saldo (CAP-18), tutup kas (CAP-20)
describe('rutinitas harian bendahara', () => {
  let tmpDir: string;
  const ledger = new LedgerService();
  const laporan = new LaporanService();
  let kelasId: number;
  let ids: number[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-harian-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });
    const ta = new AkademikService().tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
    if (!ta.ok) throw new Error(ta.pesan);
    const k = new AkademikService().kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
    if (!k.ok) throw new Error(k.pesan);
    kelasId = k.data.id;
    const siswa = new SiswaService();
    ids = ['Ani Fiktif', 'Budi Fiktif', 'Citra Fiktif'].map((nama) => {
      const r = siswa.simpan({ nama, status: 'aktif', kelas_id: kelasId });
      if (!r.ok) throw new Error(r.pesan);
      return r.data.id;
    });
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const jumlahTransaksi = () => (getDb().prepare('SELECT COUNT(*) AS n FROM transaksi').get() as { n: number }).n;

  it('setoran massal menyimpan semua baris, saldo benar, dan nol selisih (CAP-17)', () => {
    const r = ledger.setorMassal({
      tanggal: '2026-03-02',
      baris: [
        { siswa_id: ids[0], nominal: 10000 },
        { siswa_id: ids[1], nominal: 25000 },
        { siswa_id: ids[2], nominal: 5000 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ jumlah: 3, total: 40000 });
    expect(new Set(r.data.transaksi_ids).size).toBe(3);

    const saldo = laporan.rekapSiswa({ kelasId });
    expect(saldo.ok && saldo.data.map((s) => s.saldo_akhir).sort((a, b) => a - b)).toEqual([5000, 10000, 25000]);
    const cek = new IntegritasService().periksa();
    expect(cek.ok && cek.data.selisih).toEqual([]);
  });

  it('satu baris gagal membatalkan seluruh setoran massal, termasuk nomor bukti', () => {
    ledger.setor({ siswa_id: ids[0], nominal: 1000, tanggal: '2026-03-01' });
    const sebelum = jumlahTransaksi();
    const urutanSebelum = (getDb().prepare("SELECT nilai FROM sekuens WHERE nama = 'nomor_bukti_transaksi'").get() as { nilai: number }).nilai;

    const r = ledger.setorMassal({
      tanggal: '2026-03-02',
      baris: [
        { siswa_id: ids[1], nominal: 20000 },
        { siswa_id: 999999, nominal: 5000 }, // siswa tidak ada
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.pesan).toContain('Baris ke-2');
    expect(jumlahTransaksi()).toBe(sebelum);
    const urutanSesudah = (getDb().prepare("SELECT nilai FROM sekuens WHERE nama = 'nomor_bukti_transaksi'").get() as { nilai: number }).nilai;
    expect(urutanSesudah).toBe(urutanSebelum);
  });

  it('siswa non-aktif menolak seluruh setoran massal', () => {
    getDb().prepare("UPDATE siswa SET status = 'lulus' WHERE id = ?").run(ids[2]);
    const r = ledger.setorMassal({
      baris: [
        { siswa_id: ids[0], nominal: 1000 },
        { siswa_id: ids[2], nominal: 1000 },
      ],
    });
    expect(r.ok).toBe(false);
    expect(jumlahTransaksi()).toBe(0);
  });

  it('slip saldo memuat saldo dan paling banyak 5 transaksi terakhir, urut lama ke baru', () => {
    for (let i = 1; i <= 7; i++) ledger.setor({ siswa_id: ids[0], nominal: i * 1000, tanggal: `2026-03-0${i}` });
    const r = laporan.slipSaldo({ kelasId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(3);
    const ani = r.data.find((s) => s.siswa_id === ids[0])!;
    expect(ani.saldo).toBe(28000);
    expect(ani.transaksi.map((t) => t.nilai)).toEqual([3000, 4000, 5000, 6000, 7000]);
    expect(r.data.find((s) => s.siswa_id === ids[1])!.transaksi).toEqual([]);
  });

  it('slip untuk satu siswa hanya memuat siswa itu', () => {
    const r = laporan.slipSaldo({ kelasId, siswaId: ids[1] });
    expect(r.ok && r.data.map((s) => s.siswa_id)).toEqual([ids[1]]);
  });

  it('HTML slip dan berita acara meng-escape data (NFR-01)', () => {
    const slip = generateSlipSaldoHtml(
      profil,
      [{ siswa_id: 1, nomor: 'A-1', nama: '<img src=x onerror=alert(1)>', kelas_nama: '7A', status: 'aktif', saldo: 5000, transaksi: [] }],
      '7A'
    );
    expect(slip).not.toContain('<img src=x');
    expect(slip).not.toContain('<b>Fiktif</b>');
    expect(slip).toContain('&lt;img');
  });

  it('berita acara kas: kas seharusnya = awal + setoran - penarikan, selisih ditandai', () => {
    ledger.setor({ siswa_id: ids[0], nominal: 50000 });
    ledger.tarik({ siswa_id: ids[0], nominal: 20000 });
    const kas = laporan.kasHarian();
    if (!kas.ok) throw new Error(kas.pesan);
    const html = generateTutupKasHtml(profil, kas.data, 100000, 125000);
    expect(html).toContain('Rp 130.000'); // 100.000 + 50.000 - 20.000
    expect(html).toContain('Selisih (Kurang)');
    expect(html).toContain('- Rp 5.000');
  });
});

// CAP-21: salinan cadangan ke folder luar (flashdisk)
describe('salinan cadangan ke folder luar', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-salinan-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('menyalin basis data utuh ke folder tujuan dan mencatat waktunya tanpa jalur', () => {
    const backup = new BackupService(path.join(tmpDir, 'backups'));
    const luar = path.join(tmpDir, "flashdisk 'uji'");
    fs.mkdirSync(luar);
    expect(backup.terakhirKeLuar()).toEqual({ ok: true, data: null });

    const r = backup.salinKeLuar(luar);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.nama_berkas).toMatch(/^pundi_salinan_.*\.sqlite$/);
    expect(fs.statSync(path.join(luar, r.data.nama_berkas)).size).toBe(r.data.ukuran_bytes);

    const salinan = new Database(path.join(luar, r.data.nama_berkas), { readonly: true });
    const n = (salinan.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }).n;
    salinan.close();
    expect(n).toBeGreaterThan(0);

    const t = backup.terakhirKeLuar();
    expect(t.ok && t.data).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const log = getDb().prepare("SELECT ringkasan FROM audit_log WHERE aksi = 'backup.salinKeLuar'").get() as { ringkasan: string };
    expect(log.ringkasan).not.toContain(luar);
    // Salinan luar tidak muncul di daftar cadangan lokal
    const daftar = backup.daftar();
    expect(daftar.ok && daftar.data.some((d) => d.nama.includes('salinan'))).toBe(false);
  });

  it('menolak folder yang tidak ada', () => {
    const r = new BackupService(path.join(tmpDir, 'backups')).salinKeLuar(path.join(tmpDir, 'tidak-ada'));
    expect(r.ok).toBe(false);
  });
});
