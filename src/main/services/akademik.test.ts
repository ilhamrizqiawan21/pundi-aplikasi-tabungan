import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb } from '../db/index.js';
import { AkademikService } from './akademik.js';
import { SiswaService } from './siswa.js';
import { LedgerService } from './ledger.js';

describe('AkademikService (CAP-02)', () => {
  let tmpDir: string;
  let akademik: AkademikService;
  let siswa: SiswaService;

  const buatTahun = (nama: string, aktif = false, mulai = '2025-07-01', selesai = '2026-06-30') => {
    const r = akademik.tahunAjaranSimpan({ nama, mulai, selesai, aktif });
    if (!r.ok) throw new Error(r.pesan);
    return r.data;
  };
  const buatKelas = (tahunId: number, nama: string, tingkat = 7) => {
    const r = akademik.kelasSimpan({ tahun_ajaran_id: tahunId, nama, tingkat, urutan: 1 });
    if (!r.ok) throw new Error(r.pesan);
    return r.data;
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-akademik-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });
    akademik = new AkademikService();
    siswa = new SiswaService();
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hanya satu tahun ajaran aktif; mengaktifkan yang baru menonaktifkan yang lama tanpa mengubah kelasnya', () => {
    const lama = buatTahun('2025/2026', true);
    const kelasLama = buatKelas(lama.id, '7A');
    const baru = buatTahun('2026/2027', true, '2026-07-01', '2027-06-30');

    const daftar = akademik.tahunAjaranDaftar();
    expect(daftar.ok && daftar.data.filter((t) => t.aktif === 1).map((t) => t.nama)).toEqual(['2026/2027']);
    expect(baru.aktif).toBe(1);

    const kelas = akademik.kelasDaftar(lama.id);
    expect(kelas.ok && kelas.data.map((k) => k.id)).toEqual([kelasLama.id]);
  });

  it('menolak nama duplikat dengan pesan yang jelas, bukan galat basis data', () => {
    buatTahun('2025/2026');
    const dup = akademik.tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: false });
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.kode).toBe('DATA_DUPLIKAT');
      expect(dup.pesan).toContain('2025/2026');
    }

    const ta = buatTahun('2026/2027');
    buatKelas(ta.id, '7A');
    const kelasDup = akademik.kelasSimpan({ tahun_ajaran_id: ta.id, nama: '7A', tingkat: 7, urutan: 2 });
    expect(kelasDup.ok === false && kelasDup.kode).toBe('DATA_DUPLIKAT');
  });

  it('menolak rentang tanggal terbalik dan menonaktifkan tahun ajaran aktif secara langsung', () => {
    const terbalik = akademik.tahunAjaranSimpan({ nama: 'X', mulai: '2026-07-01', selesai: '2026-06-30', aktif: false });
    expect(terbalik.ok).toBe(false);

    const aktif = buatTahun('2025/2026', true);
    const matikan = akademik.tahunAjaranSimpan({
      id: aktif.id,
      nama: aktif.nama,
      mulai: aktif.mulai,
      selesai: aktif.selesai,
      aktif: false,
    });
    expect(matikan.ok).toBe(false);
  });

  it('kelas tidak bisa dipindah ke tahun ajaran lain', () => {
    const a = buatTahun('2025/2026', true);
    const b = buatTahun('2026/2027');
    const k = buatKelas(a.id, '7A');
    const pindah = akademik.kelasSimpan({ id: k.id, tahun_ajaran_id: b.id, nama: '7A', tingkat: 7, urutan: 1 });
    expect(pindah.ok).toBe(false);

    const ubahNama = akademik.kelasSimpan({ id: k.id, tahun_ajaran_id: a.id, nama: '7 Alpha', tingkat: 7, urutan: 1 });
    expect(ubahNama.ok && ubahNama.data.nama).toBe('7 Alpha');
  });

  it('kelas yang berisi siswa tidak bisa dihapus, kelas kosong bisa; jumlah siswa dihitung', () => {
    const ta = buatTahun('2025/2026', true);
    const terisi = buatKelas(ta.id, '7A');
    const kosong = buatKelas(ta.id, '7B');
    const s = siswa.simpan({ nama: 'Siswa Fiktif', status: 'aktif', kelas_id: terisi.id });
    expect(s.ok).toBe(true);

    const daftar = akademik.kelasDaftar(ta.id);
    expect(daftar.ok && daftar.data.map((k) => [k.nama, k.jumlah_siswa])).toEqual([
      ['7A', 1],
      ['7B', 0],
    ]);

    const tolak = akademik.kelasHapus(terisi.id);
    expect(tolak.ok === false && tolak.kode).toBe('MASIH_DIPAKAI');
    expect(akademik.kelasHapus(kosong.id).ok).toBe(true);
  });

  it('kelas yang pernah punya transaksi tidak bisa dihapus walau siswanya sudah pindah', () => {
    const ta = buatTahun('2025/2026', true);
    const k = buatKelas(ta.id, '7A');
    const s = siswa.simpan({ nama: 'Siswa Fiktif', status: 'aktif', kelas_id: k.id });
    if (!s.ok) throw new Error(s.pesan);
    expect(new LedgerService().setor({ siswa_id: s.data.id, nominal: 10000 }).ok).toBe(true);
    siswa.simpan({ id: s.data.id, nama: 'Siswa Fiktif', status: 'aktif', kelas_id: null });

    const hapus = akademik.kelasHapus(k.id);
    expect(hapus.ok === false && hapus.kode).toBe('MASIH_DIPAKAI');
  });

  it('tahun ajaran hanya bisa dihapus bila tidak aktif dan belum punya kelas', () => {
    const aktif = buatTahun('2025/2026', true);
    expect(akademik.tahunAjaranHapus(aktif.id).ok).toBe(false);

    const berkelas = buatTahun('2026/2027');
    buatKelas(berkelas.id, '7A');
    expect(akademik.tahunAjaranHapus(berkelas.id).ok).toBe(false);

    const kosong = buatTahun('2027/2028');
    expect(akademik.tahunAjaranHapus(kosong.id).ok).toBe(true);
  });

  it('siswa hanya bisa ditempatkan pada kelas tahun ajaran aktif', () => {
    const lama = buatTahun('2025/2026');
    const kelasLama = buatKelas(lama.id, '7A');
    buatTahun('2026/2027', true, '2026-07-01', '2027-06-30');

    const r = siswa.simpan({ nama: 'Siswa Fiktif', status: 'aktif', kelas_id: kelasLama.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.pesan).toContain('Tahun Ajaran & Kelas');
  });
});
