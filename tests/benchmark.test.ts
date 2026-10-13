import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { initDb, closeDb, getDb } from '../src/main/db/index.js';
import { SiswaService } from '../src/main/services/siswa.js';
import { LedgerService } from '../src/main/services/ledger.js';
import { LaporanService } from '../src/main/services/laporan.js';
import { AkademikService } from '../src/main/services/akademik.js';

describe('Uji Kinerja NFR-04 (5.000 Siswa & 200.000 Transaksi)', () => {
  it(
    'memenuhi kriteria NFR-04: cari <200ms, catat <300ms, rekap <3s',
    async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-benchmark-'));
      const testDbPath = path.join(tmpDir, 'perf_pundi.sqlite');

      try {
        initDb({
          dbPath: testDbPath,
          migrationsDir: path.join(process.cwd(), 'migrations'),
        });

        const db = getDb();
        const siswaSvc = new SiswaService();
        const ledgerSvc = new LedgerService();
        const laporanSvc = new LaporanService();
        const akademikSvc = new AkademikService();

        console.log('\n--- Memulai Seeding 5.000 Siswa ---');
        const waktuMulaiSeedSiswa = performance.now();

        // 1. Tahun Ajaran & 20 Kelas
        const taRes = akademikSvc.tahunAjaranSimpan({
          nama: '2025/2026',
          mulai: '2025-07-01',
          selesai: '2026-06-30',
          aktif: 1,
        });
        if (!taRes.ok) throw new Error('Gagal membuat tahun ajaran');
        const taId = taRes.data.id;

        const kelasIds: number[] = [];
        for (let i = 1; i <= 20; i++) {
          const kRes = akademikSvc.kelasSimpan({
            tahun_ajaran_id: taId,
            nama: `Kelas ${Math.ceil(i / 4)}-${String.fromCharCode(65 + ((i - 1) % 4))}`,
            tingkat: Math.ceil(i / 4),
            urutan: i,
          });
          if (kRes.ok) kelasIds.push(kRes.data.id);
        }

        // 2. Buat 5.000 Siswa secara batch
        const TOTAL_SISWA = 5000;
        const siswaIds: number[] = [];

        const seedSiswaTx = db.transaction(() => {
          for (let i = 1; i <= TOTAL_SISWA; i++) {
            const kelasId = kelasIds[(i - 1) % kelasIds.length];
            const sRes = siswaSvc.simpan({
              nama: `Siswa Benchmark ${i.toString().padStart(5, '0')}`,
              nis: `NIS-${i.toString().padStart(5, '0')}`,
              status: 'aktif',
              kelas_id: kelasId,
            });
            if (sRes.ok) {
              siswaIds.push(sRes.data.id);
            }
          }
        });
        seedSiswaTx();

        const durasiSeedSiswa = performance.now() - waktuMulaiSeedSiswa;
        console.log(`✓ 5.000 siswa selesai dibuat dalam ${(durasiSeedSiswa / 1000).toFixed(2)} detik`);
        expect(siswaIds.length).toBe(TOTAL_SISWA);

        // 3. Seeding 200.000 Transaksi melalui LedgerService
        const TOTAL_TRANSAKSI = 200000;
        const BATCH_SIZE = 10000;
        console.log(`--- Memulai Seeding ${TOTAL_TRANSAKSI.toLocaleString()} Transaksi via LedgerService ---`);
        const waktuMulaiSeedTrx = performance.now();

        for (let batch = 0; batch < TOTAL_TRANSAKSI / BATCH_SIZE; batch++) {
          const batchTx = db.transaction(() => {
            for (let j = 0; j < BATCH_SIZE; j++) {
              const idxTrx = batch * BATCH_SIZE + j;
              const siswaId = siswaIds[idxTrx % TOTAL_SISWA];
              const nominal = 10000 + ((idxTrx % 15) + 1) * 5000; // 15rb - 85rb
              // Tanggal bervariasi dalam rentang 1 tahun
              const hariKe = (idxTrx % 300) + 1;
              const bulan = Math.floor(hariKe / 30) + 1;
              const tanggal = (hariKe % 28) + 1;
              const tglStr = `2025-${bulan.toString().padStart(2, '0')}-${tanggal.toString().padStart(2, '0')}`;

              ledgerSvc.setor({
                siswa_id: siswaId,
                nominal,
                tanggal: tglStr,
                keterangan: `Setoran rutin batch ${batch + 1}`,
              });
            }
          });
          batchTx();
          // Beri kesempatan event loop Vitest RPC memproses pesan
          await new Promise((r) => setTimeout(r, 0));
        }

        const durasiSeedTrx = performance.now() - waktuMulaiSeedTrx;
        console.log(`✓ ${TOTAL_TRANSAKSI.toLocaleString()} transaksi selesai dibuat dalam ${(durasiSeedTrx / 1000).toFixed(2)} detik`);

        // Verifikasi jumlah transaksi
        const jumlahTrxActual = (db.prepare('SELECT COUNT(*) as n FROM transaksi').get() as { n: number }).n;
        expect(jumlahTrxActual).toBe(TOTAL_TRANSAKSI);

        // ==========================================
        // PENGUJIAN KINERJA NFR-04
        // ==========================================
        console.log('\n==========================================');
        console.log('HASIL PENGUKURAN KINERJA NFR-04 (ANGKA NYATA)');
        console.log('==========================================');

        // METRIK 1: PENCARIAN SISWA (Target: < 200 ms)
        // Coba beberapa variasi pencarian nyata
        const tAwalCari1 = performance.now();
        const hasilCari1 = siswaSvc.cari('Benchmark 02500');
        const durasiCari1 = performance.now() - tAwalCari1;

        const tAwalCari2 = performance.now();
        const hasilCari2 = siswaSvc.cari('', kelasIds[0]);
        const durasiCari2 = performance.now() - tAwalCari2;

        const tAwalCari3 = performance.now();
        const hasilCari3 = siswaSvc.cari('049', undefined, 'aktif');
        const durasiCari3 = performance.now() - tAwalCari3;

        console.log(`1. Pencarian Siswa (Target: < 200 ms):`);
        console.log(`   - Cari nama spesifik: ${durasiCari1.toFixed(2)} ms (ditemukan ${hasilCari1.ok ? hasilCari1.data.length : 0})`);
        console.log(`   - Filter per kelas:   ${durasiCari2.toFixed(2)} ms (ditemukan ${hasilCari2.ok ? hasilCari2.data.length : 0})`);
        console.log(`   - Cari substring:     ${durasiCari3.toFixed(2)} ms (ditemukan ${hasilCari3.ok ? hasilCari3.data.length : 0})`);

        expect(durasiCari1).toBeLessThan(200);
        expect(durasiCari2).toBeLessThan(200);
        expect(durasiCari3).toBeLessThan(200);

        // METRIK 2: CATAT TRANSAKSI BARU (Target: < 300 ms)
        // Penulisan transaksi individu nyata ke disk (dengan fsync penuh)
        const tAwalSetor = performance.now();
        const hasilSetor = ledgerSvc.setor({
          siswa_id: siswaIds[100],
          nominal: 50000,
          keterangan: 'Uji transaksi individu',
        });
        const durasiSetor = performance.now() - tAwalSetor;

        const tAwalTarik = performance.now();
        const hasilTarik = ledgerSvc.tarik({
          siswa_id: siswaIds[100],
          nominal: 20000,
          keterangan: 'Uji penarikan individu',
        });
        const durasiTarik = performance.now() - tAwalTarik;

        console.log(`\n2. Pencatatan Transaksi Baru (Target: < 300 ms):`);
        console.log(`   - Setoran individu:   ${durasiSetor.toFixed(2)} ms (status: ${hasilSetor.ok ? 'sukses' : 'gagal'})`);
        console.log(`   - Penarikan individu: ${durasiTarik.toFixed(2)} ms (status: ${hasilTarik.ok ? 'sukses' : 'gagal'})`);

        expect(hasilSetor.ok).toBe(true);
        expect(hasilTarik.ok).toBe(true);
        expect(durasiSetor).toBeLessThan(300);
        expect(durasiTarik).toBeLessThan(300);

        // METRIK 3: REKAP LAPORAN (Target: < 3.000 ms)
        const tAwalKas = performance.now();
        const hasilKas = laporanSvc.kasHarian('2025-05-15');
        const durasiKas = performance.now() - tAwalKas;

        const tAwalRekapKelas = performance.now();
        const hasilRekapKelas = laporanSvc.rekapKelas(taId);
        const durasiRekapKelas = performance.now() - tAwalRekapKelas;

        const tAwalRekapSiswa = performance.now();
        const hasilRekapSiswa = laporanSvc.rekapSiswa({ tahunAjaranId: taId });
        const durasiRekapSiswa = performance.now() - tAwalRekapSiswa;

        console.log(`\n3. Rekap Laporan (Target: < 3.000 ms):`);
        console.log(`   - Kas harian tanggal: ${durasiKas.toFixed(2)} ms`);
        console.log(`   - Rekap 20 kelas:     ${durasiRekapKelas.toFixed(2)} ms`);
        console.log(`   - Rekap 5.000 siswa:  ${durasiRekapSiswa.toFixed(2)} ms (baris: ${hasilRekapSiswa.ok ? hasilRekapSiswa.data.length : 0})`);
        console.log('==========================================\n');

        expect(hasilKas.ok).toBe(true);
        expect(hasilRekapKelas.ok).toBe(true);
        expect(hasilRekapSiswa.ok).toBe(true);
        expect(durasiKas).toBeLessThan(3000);
        expect(durasiRekapKelas).toBeLessThan(3000);
        expect(durasiRekapSiswa).toBeLessThan(3000);
      } finally {
        closeDb();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
    180000 // Timeout 3 menit untuk pembuatan 200.000 transaksi
  );
});

