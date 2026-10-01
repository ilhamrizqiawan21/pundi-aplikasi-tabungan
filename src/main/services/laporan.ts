import ExcelJS from 'exceljs';
import { getDb } from '../db/index.js';
import type {
  RingkasanKasHarian,
  ItemRekapKelas,
  ItemLaporanSiswa,
  FilterLaporanTransaksi,
  ItemLaporanTransaksi,
  HasilLaporanTransaksi,
  Result,
} from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';
import { hariIniLokal } from '../../shared/tanggal.js';

// Batas baris yang dikirim ke layar; total tetap dihitung atas semua baris yang cocok
const BATAS_TAMPIL = 1000;

export class LaporanService {
  /**
   * Ringkasan kas harian (CAP-11 & DESIGN §4.1)
   */
  public kasHarian(tanggalInput?: string): Result<RingkasanKasHarian> {
    const db = getDb();
    const tanggal = tanggalInput || hariIniLokal();

    try {
      const row = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN nilai > 0 THEN nilai ELSE 0 END), 0) AS total_setoran,
          COALESCE(SUM(CASE WHEN nilai < 0 THEN ABS(nilai) ELSE 0 END), 0) AS total_penarikan,
          COUNT(*) AS jumlah_transaksi
        FROM transaksi
        WHERE tanggal = ?
      `).get(tanggal) as {
        total_setoran: number;
        total_penarikan: number;
        jumlah_transaksi: number;
      };

      const saldoSemua = db.prepare(`
        SELECT COALESCE(SUM(nilai), 0) AS total_saldo
        FROM transaksi
      `).get() as { total_saldo: number };

      return {
        ok: true,
        data: {
          tanggal,
          total_setoran: row.total_setoran,
          total_penarikan: row.total_penarikan,
          jumlah_transaksi: row.jumlah_transaksi,
          saldo_seluruh_siswa: saldoSemua.total_saldo,
        },
      };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * Rekapitulasi tabungan per kelas (CAP-11)
   */
  public rekapKelas(tahunAjaranId?: number): Result<ItemRekapKelas[]> {
    const db = getDb();
    try {
      const activeTa = db.prepare(`SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1`).get() as {
        id: number;
      } | undefined;

      const targetTaId = tahunAjaranId || (activeTa ? activeTa.id : null);
      if (!targetTaId) {
        return { ok: true, data: [] };
      }

      const rows = db.prepare(`
        SELECT
          k.id AS kelas_id,
          k.nama AS kelas_nama,
          k.tingkat,
          COUNT(DISTINCT p.siswa_id) AS jumlah_siswa,
          COALESCE(SUM(CASE WHEN t.nilai > 0 THEN t.nilai ELSE 0 END), 0) AS total_setoran,
          COALESCE(SUM(CASE WHEN t.nilai < 0 THEN ABS(t.nilai) ELSE 0 END), 0) AS total_penarikan,
          COALESCE(SUM(t.nilai), 0) AS total_saldo
        FROM kelas k
        LEFT JOIN penempatan p ON p.kelas_id = k.id AND p.tahun_ajaran_id = ?
        LEFT JOIN transaksi t ON t.siswa_id = p.siswa_id
        WHERE k.tahun_ajaran_id = ?
        GROUP BY k.id, k.nama, k.tingkat
        ORDER BY k.tingkat ASC, k.urutan ASC, k.nama ASC
      `).all(targetTaId, targetTaId) as ItemRekapKelas[];

      return { ok: true, data: rows };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * Rekap tabungan per siswa (CAP-11)
   */
  public rekapSiswa(filter: { tahunAjaranId?: number; kelasId?: number }): Result<ItemLaporanSiswa[]> {
    const db = getDb();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filter.kelasId) {
        conditions.push('p.kelas_id = ?');
        params.push(filter.kelasId);
      } else if (filter.tahunAjaranId) {
        conditions.push('p.tahun_ajaran_id = ?');
        params.push(filter.tahunAjaranId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = db.prepare(`
        SELECT
          s.id AS siswa_id,
          s.nomor,
          s.nis,
          s.nama,
          k.nama AS kelas_nama,
          s.status,
          COALESCE(SUM(CASE WHEN t.nilai > 0 THEN t.nilai ELSE 0 END), 0) AS total_setoran,
          COALESCE(SUM(CASE WHEN t.nilai < 0 THEN ABS(t.nilai) ELSE 0 END), 0) AS total_penarikan,
          COALESCE(SUM(t.nilai), 0) AS saldo_akhir
        FROM siswa s
        LEFT JOIN penempatan p ON p.siswa_id = s.id AND p.tahun_ajaran_id = (
          SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1
        )
        LEFT JOIN kelas k ON k.id = p.kelas_id
        LEFT JOIN transaksi t ON t.siswa_id = s.id
        ${whereClause}
        GROUP BY s.id, s.nomor, s.nis, s.nama, k.nama, s.status
        ORDER BY s.nama ASC
      `).all(...params) as ItemLaporanSiswa[];

      return { ok: true, data: rows };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * Transaksi pada rentang tanggal (CAP-11: transaksi harian dan per periode).
   * `batas` membatasi baris yang dikembalikan; total dan jumlah selalu mencakup semuanya.
   */
  public transaksi(
    filter: FilterLaporanTransaksi,
    batas: number | null = BATAS_TAMPIL
  ): Result<HasilLaporanTransaksi> {
    const db = getDb();
    try {
      const kondisi = ['t.tanggal >= ?', 't.tanggal <= ?'];
      const params: unknown[] = [filter.dari, filter.sampai];
      if (filter.jenis) {
        kondisi.push('t.jenis = ?');
        params.push(filter.jenis);
      }
      if (filter.kelasId) {
        kondisi.push('t.kelas_id = ?');
        params.push(filter.kelasId);
      }
      const where = `WHERE ${kondisi.join(' AND ')}`;

      const agg = db
        .prepare(
          `SELECT COUNT(*) AS jumlah,
                  COALESCE(SUM(CASE WHEN t.nilai > 0 THEN t.nilai END), 0) AS masuk,
                  COALESCE(SUM(CASE WHEN t.nilai < 0 THEN -t.nilai END), 0) AS keluar
           FROM transaksi t ${where}`
        )
        .get(...params) as { jumlah: number; masuk: number; keluar: number };

      const baris = db
        .prepare(
          `SELECT t.id, t.tanggal, t.nomor_bukti, s.nama AS siswa_nama, s.nomor AS siswa_nomor,
                  k.nama AS kelas_nama, t.jenis, t.nilai, t.saldo_setelah, t.keterangan
           FROM transaksi t
           JOIN siswa s ON s.id = t.siswa_id
           LEFT JOIN kelas k ON k.id = t.kelas_id
           ${where}
           ORDER BY t.tanggal ASC, t.id ASC
           ${batas === null ? '' : 'LIMIT ?'}`
        )
        .all(...params, ...(batas === null ? [] : [batas])) as ItemLaporanTransaksi[];

      return {
        ok: true,
        data: {
          baris,
          jumlah: agg.jumlah,
          total_masuk: agg.masuk,
          total_keluar: agg.keluar,
          terpotong: batas !== null && agg.jumlah > batas,
        },
      };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * Ekspor transaksi pada rentang tanggal ke Excel (CAP-11); seluruh baris, tanpa batas tampilan.
   */
  public async eksporTransaksi(
    targetPath: string,
    filter: FilterLaporanTransaksi
  ): Promise<Result<{ berkas: string }>> {
    const dataRes = this.transaksi(filter, null);
    if (!dataRes.ok) return dataRes;

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Transaksi');
      sheet.columns = [
        { header: 'Tanggal', key: 'tanggal', width: 12 },
        { header: 'No. Bukti', key: 'nomor_bukti', width: 18 },
        { header: 'No. Rekening', key: 'siswa_nomor', width: 14 },
        { header: 'Nama Siswa', key: 'siswa_nama', width: 28 },
        { header: 'Kelas', key: 'kelas_nama', width: 10 },
        { header: 'Jenis', key: 'jenis', width: 12 },
        { header: 'Nilai (Rp)', key: 'nilai', width: 16, style: { numFmt: '#,##0' } },
        { header: 'Saldo Setelah (Rp)', key: 'saldo_setelah', width: 18, style: { numFmt: '#,##0' } },
        { header: 'Keterangan', key: 'keterangan', width: 36 },
      ];
      for (const r of dataRes.data.baris) {
        sheet.addRow({ ...r, kelas_nama: r.kelas_nama ?? '-', keterangan: r.keterangan ?? '' });
      }
      sheet.addRow({});
      sheet.addRow({ siswa_nama: 'Total masuk', nilai: dataRes.data.total_masuk });
      sheet.addRow({ siswa_nama: 'Total keluar', nilai: dataRes.data.total_keluar });
      sheet.addRow({ siswa_nama: 'Selisih bersih', nilai: dataRes.data.total_masuk - dataRes.data.total_keluar });

      await workbook.xlsx.writeFile(targetPath);
      return { ok: true, data: { berkas: targetPath } };
    } catch {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Gagal mengekspor laporan ke Excel.' };
    }
  }

  /**
   * Ekspor Rekap Siswa ke Excel (CAP-11)
   */
  public async eksporRekapSiswa(
    targetPath: string,
    filter: { tahunAjaranId?: number; kelasId?: number }
  ): Promise<Result<{ berkas: string }>> {
    const dataRes = this.rekapSiswa(filter);
    if (!dataRes.ok) return dataRes;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Tabungan Siswa');

      worksheet.columns = [
        { header: 'No. Rekening', key: 'nomor', width: 16 },
        { header: 'NIS', key: 'nis', width: 14 },
        { header: 'Nama Siswa', key: 'nama', width: 28 },
        { header: 'Kelas', key: 'kelas_nama', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Total Setoran (Rp)', key: 'total_setoran', width: 18 },
        { header: 'Total Penarikan (Rp)', key: 'total_penarikan', width: 18 },
        { header: 'Saldo Akhir (Rp)', key: 'saldo_akhir', width: 18 },
      ];

      for (const row of dataRes.data) {
        worksheet.addRow({
          nomor: row.nomor,
          nis: row.nis || '-',
          nama: row.nama,
          kelas_nama: row.kelas_nama || '-',
          status: row.status.toUpperCase(),
          total_setoran: row.total_setoran,
          total_penarikan: row.total_penarikan,
          saldo_akhir: row.saldo_akhir,
        });
      }

      await workbook.xlsx.writeFile(targetPath);
      return { ok: true, data: { berkas: targetPath } };
    } catch {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Gagal mengekspor laporan ke Excel.' };
    }
  }
}
