import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb, getDb } from '../db/index.js';
import { AkademikService } from './akademik.js';
import { SiswaService } from './siswa.js';
import { LedgerService } from './ledger.js';
import { IntegritasService } from './integritas.js';
import { KenaikanService } from './kenaikan.js';

describe('KenaikanService (CAP-12)', () => {
  let tmpDir: string;
  const akademik = new AkademikService();
  const siswa = new SiswaService();
  const ledger = new LedgerService();
  const kenaikan = new KenaikanService();

  let lama: number;
  let baru: number;
  let kelas7A: number;
  let kelas8A: number;
  let kelas8B: number;
  let ani: number;
  let budi: number;
  let citra: number;

  const ta = (nama: string, mulai: string, selesai: string, aktif: boolean) => {
    const r = akademik.tahunAjaranSimpan({ nama, mulai, selesai, aktif });
    if (!r.ok) throw new Error(r.pesan);
    return r.data.id;
  };
  const kelas = (tahunId: number, nama: string, tingkat: number) => {
    const r = akademik.kelasSimpan({ tahun_ajaran_id: tahunId, nama, tingkat, urutan: 1 });
    if (!r.ok) throw new Error(r.pesan);
    return r.data.id;
  };
  const murid = (nama: string, kelasId: number, saldo: number) => {
    const r = siswa.simpan({ nama, status: 'aktif', kelas_id: kelasId });
    if (!r.ok) throw new Error(r.pesan);
    if (saldo > 0) ledger.setor({ siswa_id: r.data.id, nominal: saldo });
    return r.data.id;
  };
  const penempatan = (siswaId: number, tahunId: number) =>
    (
      getDb()
        .prepare('SELECT kelas_id AS k FROM penempatan WHERE siswa_id = ? AND tahun_ajaran_id = ?')
        .get(siswaId, tahunId) as { k: number } | undefined
    )?.k;
  const status = (siswaId: number) =>
    (getDb().prepare('SELECT status FROM siswa WHERE id = ?').get(siswaId) as { status: string }).status;
  const totalSaldo = () =>
    (getDb().prepare('SELECT COALESCE(SUM(nilai), 0) AS t FROM transaksi').get() as { t: number }).t;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-kenaikan-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });

    lama = ta('2025/2026', '2025-07-01', '2026-06-30', true);
    kelas7A = kelas(lama, '7A', 7);
    ani = murid('Ani Fiktif', kelas7A, 100000);
    budi = murid('Budi Fiktif', kelas7A, 50000);
    citra = murid('Citra Fiktif', kelas7A, 0);

    baru = ta('2026/2027', '2026-07-01', '2027-06-30', false);
    kelas8A = kelas(baru, '8A', 8);
    kelas8B = kelas(baru, '8B', 8);
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('mendaftar siswa kelas asal dengan saldo, dan menandai yang sudah dipindahkan ke tahun tujuan', () => {
    const sebelum = kenaikan.daftar(kelas7A, baru);
    expect(sebelum.ok && sebelum.data.map((d) => [d.nama, d.saldo, d.kelas_tujuan_nama])).toEqual([
      ['Ani Fiktif', 100000, null],
      ['Budi Fiktif', 50000, null],
      ['Citra Fiktif', 0, null],
    ]);

    kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: baru,
      perubahan: [{ siswa_id: ani, tindakan: 'pindah', kelas_tujuan_id: kelas8A }],
    });
    const sesudah = kenaikan.daftar(kelas7A, baru);
    expect(sesudah.ok && sesudah.data.find((d) => d.siswa_id === ani)?.kelas_tujuan_nama).toBe('8A');
  });

  it('memindahkan, meluluskan, dan mengeluarkan; riwayat kelas lama tetap, saldo tidak berubah', () => {
    const totalSebelum = totalSaldo();
    const r = kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: baru,
      perubahan: [
        { siswa_id: ani, tindakan: 'pindah', kelas_tujuan_id: kelas8A },
        { siswa_id: budi, tindakan: 'pindah', kelas_tujuan_id: kelas8B },
        { siswa_id: citra, tindakan: 'lulus' },
      ],
    });
    expect(r.ok && r.data).toEqual({ dipindah: 2, lulus: 1, keluar: 0 });

    expect(penempatan(ani, baru)).toBe(kelas8A);
    expect(penempatan(budi, baru)).toBe(kelas8B);
    expect(penempatan(citra, baru)).toBeUndefined();
    expect(status(citra)).toBe('lulus');
    // Penempatan tahun lama tidak dihapus: riwayat kelas tersimpan
    expect(penempatan(ani, lama)).toBe(kelas7A);

    expect(totalSaldo()).toBe(totalSebelum);
    const periksa = new IntegritasService().periksa();
    expect(periksa.ok && periksa.data.apakah_seimbang).toBe(true);
  });

  it('transaksi pada tahun ajaran aktif yang baru memakai kelas baru', () => {
    kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: baru,
      perubahan: [{ siswa_id: ani, tindakan: 'pindah', kelas_tujuan_id: kelas8A }],
    });
    const aktif = akademik.tahunAjaranSimpan({ id: baru, nama: '2026/2027', mulai: '2026-07-01', selesai: '2027-06-30', aktif: true });
    expect(aktif.ok).toBe(true);

    const setor = ledger.setor({ siswa_id: ani, nominal: 5000 });
    expect(setor.ok && setor.data.kelas_id).toBe(kelas8A);
  });

  it('mengeluarkan siswa mengubah status tanpa menempatkannya di tahun baru', () => {
    const r = kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: baru,
      perubahan: [{ siswa_id: budi, tindakan: 'keluar' }],
    });
    expect(r.ok && r.data.keluar).toBe(1);
    expect(status(budi)).toBe('keluar');
    expect(penempatan(budi, baru)).toBeUndefined();
  });

  it('semua atau tidak sama sekali: satu baris salah membatalkan seluruh perubahan', () => {
    const r = kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: baru,
      perubahan: [
        { siswa_id: ani, tindakan: 'pindah', kelas_tujuan_id: kelas8A },
        { siswa_id: budi, tindakan: 'pindah', kelas_tujuan_id: kelas7A }, // kelas milik tahun lama
      ],
    });
    expect(r.ok).toBe(false);
    expect(penempatan(ani, baru)).toBeUndefined();
    const audit = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE aksi = 'kenaikan.terapkan'").get() as { n: number };
    expect(audit.n).toBe(0);
  });

  it('menolak tahun tujuan yang sama atau lebih lama', () => {
    const sama = kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: lama,
      perubahan: [{ siswa_id: ani, tindakan: 'lulus' }],
    });
    expect(sama.ok).toBe(false);

    const mundur = kenaikan.terapkan({
      kelas_asal_id: kelas8A,
      tahun_ajaran_tujuan_id: lama,
      perubahan: [{ siswa_id: ani, tindakan: 'lulus' }],
    });
    expect(mundur.ok).toBe(false);
  });

  it('menolak siswa yang bukan anggota kelas asal dan siswa yang muncul dua kali', () => {
    const lain = siswa.simpan({ nama: 'Eko Fiktif', status: 'aktif' });
    if (!lain.ok) throw new Error(lain.pesan);

    const bukanAnggota = kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: baru,
      perubahan: [{ siswa_id: lain.data.id, tindakan: 'lulus' }],
    });
    expect(bukanAnggota.ok).toBe(false);
    expect(status(lain.data.id)).toBe('aktif');

    const ganda = kenaikan.terapkan({
      kelas_asal_id: kelas7A,
      tahun_ajaran_tujuan_id: baru,
      perubahan: [
        { siswa_id: ani, tindakan: 'lulus' },
        { siswa_id: ani, tindakan: 'keluar' },
      ],
    });
    expect(ganda.ok).toBe(false);
    expect(status(ani)).toBe('aktif');
  });
});
