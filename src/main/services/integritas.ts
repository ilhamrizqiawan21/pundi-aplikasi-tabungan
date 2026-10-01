import { getDb } from '../db/index.js';
import type { HasilPeriksaIntegritas, Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

export class IntegritasService {
  /**
   * CAP-17: Memeriksa apakah seluruh saldo_setelah siswa sama persis dengan SUM(nilai) transaksi
   */
  public periksa(): Result<HasilPeriksaIntegritas> {
    const db = getDb();
    try {
      const siswaList = db.prepare(`
        SELECT id, nomor, nama FROM siswa ORDER BY id ASC
      `).all() as Array<{ id: number; nomor: string; nama: string }>;

      const totalTransaksiRow = db.prepare(`
        SELECT COUNT(*) as count FROM transaksi
      `).get() as { count: number };

      const selisihList: HasilPeriksaIntegritas['selisih'] = [];

      for (const s of siswaList) {
        // Ambil saldo tercatat (baris transaksi terakhir)
        const lastTrx = db.prepare(`
          SELECT saldo_setelah FROM transaksi
          WHERE siswa_id = ?
          ORDER BY id DESC LIMIT 1
        `).get(s.id) as { saldo_setelah: number } | undefined;

        const saldoTercatat = lastTrx ? lastTrx.saldo_setelah : 0;

        // Ambil saldo kalkulasi dari penjumlahan seluruh transaksi
        const sumRow = db.prepare(`
          SELECT COALESCE(SUM(nilai), 0) AS total
          FROM transaksi
          WHERE siswa_id = ?
        `).get(s.id) as { total: number };

        const saldoKalkulasi = sumRow.total;

        if (saldoTercatat !== saldoKalkulasi) {
          selisihList.push({
            siswa_id: s.id,
            nomor: s.nomor,
            nama: s.nama,
            saldo_tercatat: saldoTercatat,
            saldo_kalkulasi: saldoKalkulasi,
            selisih: saldoTercatat - saldoKalkulasi,
          });
        }
      }

      return {
        ok: true,
        data: {
          apakah_seimbang: selisihList.length === 0,
          total_siswa_diperiksa: siswaList.length,
          total_transaksi_diperiksa: totalTransaksiRow.count,
          selisih: selisihList,
        },
      };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
