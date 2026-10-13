import type { getDb } from '../../db/index.js';
import { hariIniLokal, tanggalKalenderValid } from '../../../shared/tanggal.js';

/** Tanggal transaksi harus ada di kalender; setoran/penarikan tidak boleh bertanggal masa depan. */
export function galatTanggal(tanggal: string, bolehMasaDepan: boolean): string | null {
  if (!tanggalKalenderValid(tanggal)) return 'Tanggal tidak valid (format YYYY-MM-DD).';
  if (!bolehMasaDepan && tanggal > hariIniLokal()) return 'Tanggal transaksi tidak boleh di masa depan.';
  return null;
}

/**
 * Menghasilkan nomor bukti berurutan atomik dalam transaksi SQL (mis. TRX-2026-000001)
 */
export function generateNomorBukti(db: ReturnType<typeof getDb>, tanggal: string): string {
  const year = tanggal.substring(0, 4);
  db.prepare(`
    INSERT INTO sekuens (nama, nilai) VALUES ('nomor_bukti_transaksi', 1)
    ON CONFLICT(nama) DO UPDATE SET nilai = nilai + 1
  `).run();

  const row = db.prepare(`SELECT nilai FROM sekuens WHERE nama = 'nomor_bukti_transaksi'`).get() as {
    nilai: number;
  };
  const seq = row.nilai.toString().padStart(6, '0');
  return `TRX-${year}-${seq}`;
}

/**
 * Mengambil saldo terakhir siswa saat ini dari baris transaksi terakhir
 */
export function getSaldoSiswaDb(db: ReturnType<typeof getDb>, siswaId: number): number {
  const row = db.prepare(`
    SELECT saldo_setelah FROM transaksi
    WHERE siswa_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(siswaId) as { saldo_setelah: number } | undefined;

  return row ? row.saldo_setelah : 0;
}

/**
 * Mengambil kelas aktif siswa saat ini
 */
export function getKelasAktifSiswa(db: ReturnType<typeof getDb>, siswaId: number): number | null {
  const row = db.prepare(`
    SELECT p.kelas_id
    FROM penempatan p
    JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    WHERE p.siswa_id = ? AND ta.aktif = 1
    LIMIT 1
  `).get(siswaId) as { kelas_id: number } | undefined;

  return row ? row.kelas_id : null;
}
