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
import { hariIniLokal } from '../../shared/tanggal.js';

// CAP-08 / D-06: biaya administrasi satu kelas
describe('biaya administrasi', () => {
  let tmpDir: string;
  const ledger = new LedgerService();
  const laporan = new LaporanService();
  let kelasId: number;
  let ids: number[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-biaya-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });
    const ta = new AkademikService().tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
    if (!ta.ok) throw new Error(ta.pesan);
    const k = new AkademikService().kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
    if (!k.ok) throw new Error(k.pesan);
    kelasId = k.data.id;
    const siswa = new SiswaService();
    ids = ['Ani Fiktif', 'Budi Fiktif', 'Citra Fiktif', 'Dewi Fiktif'].map((nama) => {
      const r = siswa.simpan({ nama, status: 'aktif', kelas_id: kelasId });
      if (!r.ok) throw new Error(r.pesan);
      return r.data.id;
    });
    ledger.setor({ siswa_id: ids[0], nominal: 50000 });
    ledger.setor({ siswa_id: ids[1], nominal: 10000 });
    ledger.setor({ siswa_id: ids[2], nominal: 3000 }); // kurang dari biaya
    // ids[3] tanpa saldo
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const saldo = (id: number) => ledger.getSaldoSiswa(id);
  const jumlahTransaksi = () => (getDb().prepare('SELECT COUNT(*) AS n FROM transaksi').get() as { n: number }).n;
  const selisihIntegritas = () => {
    const r = new IntegritasService().periksa();
    return r.ok ? r.data.selisih : null;
  };

  it('satu siswa: mengurangi saldo sebagai transaksi biaya_adm, tidak boleh melebihi saldo', () => {
    const r = ledger.biayaAdm({ siswa_id: ids[0], nominal: 5000, keterangan: 'Biaya administrasi uji' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ jenis: 'biaya_adm', nilai: -5000, saldo_setelah: 45000 });
    expect(saldo(ids[0])).toBe(45000);

    const lebih = ledger.biayaAdm({ siswa_id: ids[2], nominal: 5000 });
    expect(lebih.ok).toBe(false);
    expect(ledger.biayaAdm({ siswa_id: ids[0], nominal: 0 }).ok).toBe(false);
    expect(ledger.biayaAdm({ siswa_id: ids[0], nominal: 1.5 }).ok).toBe(false);
    expect(ledger.biayaAdm({ siswa_id: ids[0], nominal: 1000, tanggal: '2999-01-01' }).ok).toBe(false);
    expect(saldo(ids[2])).toBe(3000);
  });

  it('rencana: yang saldonya kurang, tanpa saldo, atau non-aktif dilewati dengan alasan', () => {
    getDb().prepare("UPDATE siswa SET status = 'lulus' WHERE id = ?").run(ids[1]);
    const r = ledger.rencanaBiayaAdm({ kelas_id: kelasId, nominal: 5000, periode: 'Semester 1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.keterangan).toBe('Biaya administrasi Semester 1');
    expect(r.data.dipotong.map((s) => s.siswa_id)).toEqual([ids[0]]);
    const alasan = Object.fromEntries(r.data.dilewati.map((s) => [s.siswa_id, s.alasan]));
    expect(alasan[ids[1]]).toBe('Sudah lulus');
    expect(alasan[ids[2]]).toBe('Saldo kurang dari biaya');
    expect(alasan[ids[3]]).toBe('Saldo kurang dari biaya');
  });

  it('massal: memotong semua yang layak sekaligus, saldo benar, nol selisih (CAP-17)', () => {
    const r = ledger.biayaAdmMassal({ kelas_id: kelasId, nominal: 5000, periode: 'Semester 1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ jumlah: 2, total: 10000 });
    expect(r.data.dilewati).toHaveLength(2);
    expect(saldo(ids[0])).toBe(45000);
    expect(saldo(ids[1])).toBe(5000);
    expect(saldo(ids[2])).toBe(3000);
    expect(selisihIntegritas()).toEqual([]);
  });

  it('periode yang sama tidak dipotong dua kali; setelah dikoreksi, boleh dipotong lagi', () => {
    ledger.biayaAdmMassal({ kelas_id: kelasId, nominal: 5000, periode: 'Semester 1' });
    const sebelum = jumlahTransaksi();
    const lagi = ledger.biayaAdmMassal({ kelas_id: kelasId, nominal: 5000, periode: 'Semester 1' });
    expect(lagi.ok).toBe(false); // semua dilewati
    expect(jumlahTransaksi()).toBe(sebelum);

    // Periode lain tidak terhalang
    expect(ledger.biayaAdmMassal({ kelas_id: kelasId, nominal: 5000, periode: 'Semester 2' }).ok).toBe(true);

    // Koreksi potongan Ani untuk Semester 1, lalu rencana Semester 1 memasukkan Ani lagi
    const trxAni = getDb()
      .prepare("SELECT id FROM transaksi WHERE siswa_id = ? AND keterangan = 'Biaya administrasi Semester 1'")
      .get(ids[0]) as { id: number };
    expect(ledger.balik({ transaksi_id: trxAni.id, alasan: 'Salah periode' }).ok).toBe(true);
    const rencana = ledger.rencanaBiayaAdm({ kelas_id: kelasId, nominal: 5000, periode: 'Semester 1' });
    expect(rencana.ok && rencana.data.dipotong.map((s) => s.siswa_id)).toEqual([ids[0]]);
    expect(selisihIntegritas()).toEqual([]);
  });

  it('massal gagal total bila periode atau nominal tidak sah, tanpa menyimpan apa pun', () => {
    const sebelum = jumlahTransaksi();
    expect(ledger.biayaAdmMassal({ kelas_id: kelasId, nominal: 5000, periode: 'ab' }).ok).toBe(false);
    expect(ledger.biayaAdmMassal({ kelas_id: kelasId, nominal: -1, periode: 'Semester 1' }).ok).toBe(false);
    expect(ledger.biayaAdmMassal({ kelas_id: 999999, nominal: 5000, periode: 'Semester 1' }).ok).toBe(false);
    expect(jumlahTransaksi()).toBe(sebelum);
  });

  it('kas harian dan rekap bulanan memisahkan biaya administrasi dari setoran dan penarikan', () => {
    const kasAwal = laporan.kasHarian();
    ledger.biayaAdmMassal({ kelas_id: kelasId, nominal: 5000, periode: 'Semester 1' }); // 2 siswa, 10.000
    const kas = laporan.kasHarian();
    expect(kas.ok && kasAwal.ok).toBe(true);
    if (!kas.ok || !kasAwal.ok) return;
    expect(kas.data.total_penarikan).toBe(kasAwal.data.total_penarikan); // tidak bertambah
    expect(kas.data.total_setoran).toBe(kasAwal.data.total_setoran);
    expect(kas.data.total_biaya_adm).toBe(10000);

    // Koreksi potongan bukan setoran tunai
    const trx = getDb().prepare("SELECT id FROM transaksi WHERE jenis = 'biaya_adm' LIMIT 1").get() as { id: number };
    ledger.balik({ transaksi_id: trx.id, alasan: 'Salah catat' });
    const sesudahKoreksi = laporan.kasHarian();
    expect(sesudahKoreksi.ok && sesudahKoreksi.data.total_setoran).toBe(kasAwal.data.total_setoran);
    expect(sesudahKoreksi.ok && sesudahKoreksi.data.total_biaya_adm).toBe(5000);

    const bulan = hariIniLokal().slice(0, 7);
    const rekap = laporan.rekapBulanan({ dari: `${bulan}-01`, sampai: `${bulan}-31` });
    expect(rekap.ok).toBe(true);
    if (!rekap.ok) return;
    expect(rekap.data.baris[0]).toMatchObject({ setoran: 63000, penarikan: 0, biaya_adm: 5000 });
    // Saldo akhir tetap memuat potongan: 63.000 - 5.000
    expect(rekap.data.baris[0].saldo_akhir).toBe(58000);
  });

  it('properti: urutan acak setor/tarik/biaya/koreksi menjaga saldo >= 0 dan nol selisih', () => {
    let seed = 20261005;
    const acak = (n: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed % n;
    };
    for (let i = 0; i < 300; i++) {
      const siswaId = ids[acak(ids.length)];
      const nominal = (acak(20) + 1) * 500;
      switch (acak(4)) {
        case 0:
          ledger.setor({ siswa_id: siswaId, nominal });
          break;
        case 1:
          ledger.tarik({ siswa_id: siswaId, nominal });
          break;
        case 2:
          ledger.biayaAdm({ siswa_id: siswaId, nominal, keterangan: 'Biaya administrasi acak' });
          break;
        default: {
          const t = getDb().prepare("SELECT id FROM transaksi WHERE jenis <> 'pembalik' ORDER BY RANDOM() LIMIT 1").get() as { id: number } | undefined;
          if (t) ledger.balik({ transaksi_id: t.id, alasan: 'Koreksi acak' });
        }
      }
    }
    for (const id of ids) expect(saldo(id)).toBeGreaterThanOrEqual(0);
    expect(selisihIntegritas()).toEqual([]);
  });
});
