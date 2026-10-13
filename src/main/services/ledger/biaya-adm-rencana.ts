import type { getDb } from '../../db/index.js';
import type { Result } from '../../../shared/types.js';
import { ERROR_MESSAGES } from '../../../shared/errors.js';
import type { RencanaBiayaAdm } from './types.js';

/**
 * Rencana potongan biaya administrasi satu kelas (hanya membaca). Aturan (D-06): hanya siswa aktif;
 * siswa yang saldonya kurang dari biaya dilewati (tidak ada potongan sebagian); siswa yang sudah dipotong
 * untuk periode yang sama (dan belum dikoreksi) dilewati agar tidak ganda.
 */
export function hitungRencanaBiayaAdm(
  db: ReturnType<typeof getDb>,
  input: { kelas_id: number; nominal: number; periode: string },
  getSaldoSiswa: (siswaId: number) => number
): Result<RencanaBiayaAdm> {
  const periode = input.periode.trim();
  if (!Number.isSafeInteger(input.nominal) || input.nominal <= 0) {
    return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
  }
  if (periode.length < 3 || periode.length > 40) {
    return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Periode harus 3 sampai 40 karakter.' };
  }
  const keterangan = `Biaya administrasi ${periode}`;
  try {
    const siswaKelas = db.prepare(`
      SELECT s.id, s.nomor, s.nama, s.status
      FROM siswa s
      JOIN penempatan p ON p.siswa_id = s.id AND p.kelas_id = ?
      ORDER BY s.nama ASC
    `).all(input.kelas_id) as { id: number; nomor: string; nama: string; status: string }[];

    const sudahDipotong = db.prepare(`
      SELECT 1 FROM transaksi t
      WHERE t.siswa_id = ? AND t.jenis = 'biaya_adm' AND t.keterangan = ?
        AND NOT EXISTS (SELECT 1 FROM transaksi b WHERE b.membalik_id = t.id)
    `);

    const rencana: RencanaBiayaAdm = { keterangan, dipotong: [], dilewati: [] };
    for (const s of siswaKelas) {
      const saldo = getSaldoSiswa(s.id);
      const lewati = (alasan: string) => rencana.dilewati.push({ siswa_id: s.id, nomor: s.nomor, nama: s.nama, alasan });
      if (s.status !== 'aktif') lewati(s.status === 'lulus' ? 'Sudah lulus' : 'Sudah keluar');
      else if (sudahDipotong.get(s.id, keterangan)) lewati('Sudah dipotong untuk periode ini');
      else if (saldo < input.nominal) lewati('Saldo kurang dari biaya');
      else rencana.dipotong.push({ siswa_id: s.id, nomor: s.nomor, nama: s.nama, saldo });
    }
    return { ok: true, data: rencana };
  } catch {
    return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
  }
}
