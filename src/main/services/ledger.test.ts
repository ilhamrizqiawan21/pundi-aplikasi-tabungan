import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb } from '../db/index.js';
import { LedgerService } from './ledger.js';
import { SiswaService } from './siswa.js';
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

  it('uji berbasis properti: 500 transaksi acak selalu menjaga saldo >= 0 dan CAP-17 nol selisih', () => {
    // Buat 5 siswa
    const siswaIds: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = siswaSvc.simpan({ nama: `Siswa Uji Properti ${i}`, status: 'aktif' });
      if (res.ok) siswaIds.push(res.data.id);
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
