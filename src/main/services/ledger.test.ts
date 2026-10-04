import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb } from '../db/index.js';
import { LedgerService } from './ledger.js';
import { SiswaService } from './siswa.js';
import { LaporanService } from './laporan.js';
import { IntegritasService } from './integritas.js';

describe('LedgerService (Buku Besar & Properti Invarian)', () => {
  let testDbPath: string;
  let ledger: LedgerService;
  let siswaSvc: SiswaService;
  let integritas: IntegritasService;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-ledger-test-'));
    testDbPath = path.join(tmpDir, 'test_ledger.sqlite');
    initDb({
      dbPath: testDbPath,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    });
    ledger = new LedgerService();
    siswaSvc = new SiswaService();
    integritas = new IntegritasService();
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

  it('berhasil melakukan setoran dan penarikan dengan saldo berjalan yang tepat', () => {
    const sRes = siswaSvc.simpan({ nama: 'Ahmad Dahlan', status: 'aktif' });
    expect(sRes.ok).toBe(true);
    if (!sRes.ok) return;

    const siswaId = sRes.data.id;

    // Setoran 1: Rp 100.000
    const setor1 = ledger.setor({ siswa_id: siswaId, nominal: 100000 });
    expect(setor1.ok).toBe(true);
    if (setor1.ok) {
      expect(setor1.data.saldo_setelah).toBe(100000);
      expect(setor1.data.nilai).toBe(100000);
    }

    // Setoran 2: Rp 50.000 -> Total Rp 150.000
    const setor2 = ledger.setor({ siswa_id: siswaId, nominal: 50000 });
    expect(setor2.ok).toBe(true);
    if (setor2.ok) {
      expect(setor2.data.saldo_setelah).toBe(150000);
    }

    // Penarikan 1: Rp 30.000 -> Sisa Rp 120.000
    const tarik1 = ledger.tarik({ siswa_id: siswaId, nominal: 30000 });
    expect(tarik1.ok).toBe(true);
    if (tarik1.ok) {
      expect(tarik1.data.saldo_setelah).toBe(120000);
      expect(tarik1.data.nilai).toBe(-30000);
    }

    // Penarikan berlebih: Rp 200.000 -> Harus ditolak (SALDO_TIDAK_CUKUP)
    const tarikGagal = ledger.tarik({ siswa_id: siswaId, nominal: 200000 });
    expect(tarikGagal.ok).toBe(false);
    if (!tarikGagal.ok) {
      expect(tarikGagal.kode).toBe('SALDO_TIDAK_CUKUP');
    }

    // Saldo tetap Rp 120.000
    expect(ledger.getSaldoSiswa(siswaId)).toBe(120000);
  });

  it('koreksi transaksi (pembalik) bekerja dengan benar dan menolak pembalikan ganda', () => {
    const sRes = siswaSvc.simpan({ nama: 'Nyai Ahmad Dahlan', status: 'aktif' });
    if (!sRes.ok) return;
    const siswaId = sRes.data.id;

    const setor = ledger.setor({ siswa_id: siswaId, nominal: 50000 });
    if (!setor.ok) return;

    // Balik setoran
    const balik = ledger.balik({
      transaksi_id: setor.data.id,
      alasan: 'Salah input nominal oleh operator',
    });
    expect(balik.ok).toBe(true);
    if (balik.ok) {
      expect(balik.data.nilai).toBe(-50000);
      expect(balik.data.saldo_setelah).toBe(0);
      expect(balik.data.membalik_id).toBe(setor.data.id);
    }

    // Coba balik lagi transaksi yang sama -> Harus ditolak
    const balikLagi = ledger.balik({
      transaksi_id: setor.data.id,
      alasan: 'Mencoba membalik ulang',
    });
    expect(balikLagi.ok).toBe(false);
    if (!balikLagi.ok) {
      expect(balikLagi.kode).toBe('TRANSAKSI_SUDAH_DIBALIK');
    }
  });

  it('koreksi: alasan wajib dan dibatasi 255 karakter, pembalik tidak bisa dibalik, saldo tidak boleh negatif', () => {
    const s = siswaSvc.simpan({ nama: 'Siswa Koreksi', status: 'aktif' });
    if (!s.ok) throw new Error(s.pesan);
    const setor = ledger.setor({ siswa_id: s.data.id, nominal: 50000, tanggal: '2026-03-01' });
    if (!setor.ok) throw new Error(setor.pesan);

    for (const alasan of ['', '  ', 'ab']) {
      const r = ledger.balik({ transaksi_id: setor.data.id, alasan });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.kode).toBe('ALASAN_KOREKSI_WAJIB');
    }
    const panjang = ledger.balik({ transaksi_id: setor.data.id, alasan: 'x'.repeat(256) });
    expect(panjang.ok).toBe(false);
    if (!panjang.ok) expect(panjang.kode).toBe('VALIDASI_GAGAL');
    expect(ledger.getSaldoSiswa(s.data.id)).toBe(50000);

    // Penarikan setelah setoran: membalik setoran akan membuat saldo negatif -> ditolak
    const tarik = ledger.tarik({ siswa_id: s.data.id, nominal: 30000, tanggal: '2026-03-02' });
    if (!tarik.ok) throw new Error(tarik.pesan);
    const tolak = ledger.balik({ transaksi_id: setor.data.id, alasan: 'Salah input' });
    expect(tolak.ok).toBe(false);
    if (!tolak.ok) expect(tolak.kode).toBe('SALDO_TIDAK_CUKUP');

    // Pembalik tidak boleh dibalik lagi
    const pembalik = ledger.balik({ transaksi_id: tarik.data.id, alasan: 'Salah input' });
    if (!pembalik.ok) throw new Error(pembalik.pesan);
    const lagi = ledger.balik({ transaksi_id: pembalik.data.id, alasan: 'Coba lagi' });
    expect(lagi.ok).toBe(false);
    if (!lagi.ok) expect(lagi.kode).toBe('TRANSAKSI_PEMBALIK_DITOLAK');
    expect(ledger.getSaldoSiswa(s.data.id)).toBe(50000);
  });

  it('setoran/penarikan menolak tanggal tidak ada di kalender, tanggal masa depan, dan nominal tak aman', () => {
    const s = siswaSvc.simpan({ nama: 'Siswa Tanggal', status: 'aktif' });
    if (!s.ok) throw new Error(s.pesan);
    const id = s.data.id;

    for (const tanggal of ['2026-02-30', '2026-13-01', '26-01-01', '1999-01-01', '2999-01-01']) {
      const r = ledger.setor({ siswa_id: id, nominal: 1000, tanggal });
      expect(r.ok, `setor ${tanggal}`).toBe(false);
      if (!r.ok) expect(r.kode).toBe('VALIDASI_GAGAL');
    }
    expect(ledger.tarik({ siswa_id: id, nominal: 1, tanggal: '2026-02-30' }).ok).toBe(false);
    expect(ledger.saldoAwal({ siswa_id: id, nominal: 1000, tanggal: '2026-02-30' }).ok).toBe(false);

    // Nominal di luar bilangan bulat aman ditolak, saldo tak berubah
    const besar = ledger.setor({ siswa_id: id, nominal: Number.MAX_SAFE_INTEGER + 2, tanggal: '2026-03-01' });
    expect(besar.ok).toBe(false);
    expect(ledger.setor({ siswa_id: id, nominal: Number.MAX_SAFE_INTEGER, tanggal: '2026-03-01' }).ok).toBe(true);
    // Saldo + setoran berikutnya melampaui batas aman -> ditolak, bukan dibulatkan diam-diam
    const luber = ledger.setor({ siswa_id: id, nominal: 10, tanggal: '2026-03-01' });
    expect(luber.ok).toBe(false);
    if (!luber.ok) expect(luber.kode).toBe('NOMINAL_TIDAK_VALID');
    expect(ledger.getSaldoSiswa(id)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('siswa lulus/keluar tidak dapat menyetor, tetapi masih dapat menarik sisa saldo', () => {
    const s = siswaSvc.simpan({ nama: 'Siswa Lulus', status: 'aktif' });
    if (!s.ok) throw new Error(s.pesan);
    const id = s.data.id;
    expect(ledger.setor({ siswa_id: id, nominal: 50000, tanggal: '2026-03-01' }).ok).toBe(true);

    for (const status of ['lulus', 'keluar'] as const) {
      const u = siswaSvc.simpan({ id, nama: 'Siswa Lulus', status });
      if (!u.ok) throw new Error(u.pesan);
      const r = ledger.setor({ siswa_id: id, nominal: 1000, tanggal: '2026-03-02' });
      expect(r.ok, status).toBe(false);
      if (!r.ok) expect(r.kode).toBe('SISWA_TIDAK_AKTIF');
      expect(ledger.getSaldoSiswa(id)).toBe(50000 - (status === 'keluar' ? 20000 : 0));
      if (status === 'lulus') {
        expect(ledger.tarik({ siswa_id: id, nominal: 20000, tanggal: '2026-03-02' }).ok).toBe(true);
      }
    }
  });

  it('saldo awal: dicatat sebagai jenis saldo_awal, hanya untuk siswa tanpa transaksi, dan tidak dihitung kas harian', () => {
    const s = siswaSvc.simpan({ nama: 'Siswa Saldo Awal', status: 'aktif' });
    if (!s.ok) throw new Error(s.pesan);

    const r = ledger.saldoAwal({ siswa_id: s.data.id, nominal: 250000, tanggal: '2026-03-01' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ jenis: 'saldo_awal', nilai: 250000, saldo_setelah: 250000 });
    expect(ledger.getSaldoSiswa(s.data.id)).toBe(250000);

    // Sudah punya transaksi: ditolak, saldo tidak berubah
    expect(ledger.saldoAwal({ siswa_id: s.data.id, nominal: 1000, tanggal: '2026-03-01' }).ok).toBe(false);
    expect(ledger.getSaldoSiswa(s.data.id)).toBe(250000);

    // Nominal tidak valid
    const baru = siswaSvc.simpan({ nama: 'Siswa Lain', status: 'aktif' });
    if (!baru.ok) throw new Error(baru.pesan);
    for (const nominal of [0, -5, 1.5, Number.NaN]) {
      expect(ledger.saldoAwal({ siswa_id: baru.data.id, nominal, tanggal: '2026-03-01' }).ok).toBe(false);
    }

    // Setoran sesudahnya melanjutkan saldo; kas harian hanya memuat setoran, bukan saldo awal
    expect(ledger.setor({ siswa_id: s.data.id, nominal: 10000, tanggal: '2026-03-01' }).ok).toBe(true);
    const kas = new LaporanService().kasHarian('2026-03-01');
    expect(kas.ok && kas.data).toMatchObject({ total_setoran: 10000, jumlah_transaksi: 1, saldo_seluruh_siswa: 260000 });
    const periksa = integritas.periksa();
    expect(periksa.ok && periksa.data.apakah_seimbang).toBe(true);
  });

  it('uji berbasis properti: 500 transaksi acak selalu menjaga saldo >= 0 dan CAP-17 nol selisih', () => {
    // Buat 5 siswa
    const siswaIds: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = siswaSvc.simpan({ nama: `Siswa Uji Properti ${i}`, status: 'aktif' });
      if (res.ok) siswaIds.push(res.data.id);
    }
    // Sebagian siswa dimulai dari saldo awal (CAP-14); koreksi acak boleh membalikkannya
    for (const id of siswaIds.slice(0, 3)) {
      expect(ledger.saldoAwal({ siswa_id: id, nominal: 100000, tanggal: '2026-01-01' }).ok).toBe(true);
    }

    const nominals = [10000, 20000, 25000, 50000, 100000, 250000];

    // Jalankan 500 transaksi acak
    for (let op = 0; op < 500; op++) {
      const siswaId = siswaIds[Math.floor(Math.random() * siswaIds.length)];
      const actionType = Math.random();
      const amount = nominals[Math.floor(Math.random() * nominals.length)];

      if (actionType < 0.6) {
        // 60% Setoran
        ledger.setor({ siswa_id: siswaId, nominal: amount });
      } else if (actionType < 0.9) {
        // 30% Penarikan
        ledger.tarik({ siswa_id: siswaId, nominal: amount });
      } else {
        // 10% Koreksi transaksi terakhir acak
        const history = ledger.riwayat({ siswa_id: siswaId, limit: 5 });
        if (history.ok && history.data.length > 0) {
          const eligible = history.data.find(
            (t) => t.jenis !== 'pembalik' && !t.membalik_id
          );
          if (eligible) {
            ledger.balik({
              transaksi_id: eligible.id,
              alasan: 'Koreksi properti test acak',
            });
          }
        }
      }

      // Pastikan saldo siswa tidak pernah negatif
      const saldoCurrent = ledger.getSaldoSiswa(siswaId);
      expect(saldoCurrent).toBeGreaterThanOrEqual(0);
    }

    // Periksa Integritas Saldo (CAP-17)
    const periksaRes = integritas.periksa();
    expect(periksaRes.ok).toBe(true);
    if (periksaRes.ok) {
      expect(periksaRes.data.apakah_seimbang).toBe(true);
      expect(periksaRes.data.selisih.length).toBe(0);
      expect(periksaRes.data.total_siswa_diperiksa).toBeGreaterThanOrEqual(5);
    }
  });
});
