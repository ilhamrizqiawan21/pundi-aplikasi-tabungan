import { getDb } from '../db/index.js';
import type { ItemKenaikan, PerubahanKenaikan, Result } from '../../shared/types.js';
import { ERROR_MESSAGES, type ErrorCode } from '../../shared/errors.js';

class Penolakan extends Error {
  constructor(
    public kode: ErrorCode,
    public pesan: string
  ) {
    super(pesan);
  }
}

/**
 * CAP-12: kenaikan kelas dan kelulusan.
 * Hanya memindahkan penempatan dan mengubah status siswa; tidak menyentuh tabel transaksi,
 * sehingga saldo dan riwayat ikut tanpa perubahan.
 */
export class KenaikanService {
  /** Siswa pada kelas asal, beserta saldo dan kelas tujuannya bila sudah dipindahkan ke tahun tujuan. */
  public daftar(kelasAsalId: number, tahunTujuanId: number): Result<ItemKenaikan[]> {
    const db = getDb();
    try {
      const rows = db
        .prepare(
          `SELECT s.id AS siswa_id, s.nomor, s.nama, s.status,
                  COALESCE((SELECT t.saldo_setelah FROM transaksi t WHERE t.siswa_id = s.id ORDER BY t.id DESC LIMIT 1), 0) AS saldo,
                  kt.nama AS kelas_tujuan_nama
           FROM penempatan p
           JOIN siswa s ON s.id = p.siswa_id
           LEFT JOIN penempatan pt ON pt.siswa_id = s.id AND pt.tahun_ajaran_id = ?
           LEFT JOIN kelas kt ON kt.id = pt.kelas_id
           WHERE p.kelas_id = ?
           ORDER BY s.nama COLLATE NOCASE, s.id`
        )
        .all(tahunTujuanId, kelasAsalId) as ItemKenaikan[];
      return { ok: true, data: rows };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public terapkan(data: {
    kelas_asal_id: number;
    tahun_ajaran_tujuan_id: number;
    perubahan: PerubahanKenaikan[];
  }): Result<{ dipindah: number; lulus: number; keluar: number }> {
    const db = getDb();
    try {
      const tx = db.transaction(() => {
        const asal = db
          .prepare(
            `SELECT k.id, k.tahun_ajaran_id, ta.mulai FROM kelas k
             JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id WHERE k.id = ?`
          )
          .get(data.kelas_asal_id) as { id: number; tahun_ajaran_id: number; mulai: string } | undefined;
        if (!asal) throw new Penolakan('KELAS_TIDAK_DITEMUKAN', ERROR_MESSAGES.KELAS_TIDAK_DITEMUKAN);

        const tujuan = db
          .prepare(`SELECT id, mulai FROM tahun_ajaran WHERE id = ?`)
          .get(data.tahun_ajaran_tujuan_id) as { id: number; mulai: string } | undefined;
        if (!tujuan) throw new Penolakan('TAHUN_AJARAN_TIDAK_DITEMUKAN', ERROR_MESSAGES.TAHUN_AJARAN_TIDAK_DITEMUKAN);
        if (tujuan.id === asal.tahun_ajaran_id || tujuan.mulai <= asal.mulai) {
          throw new Penolakan('VALIDASI_GAGAL', 'Tahun ajaran tujuan harus lebih baru dari tahun ajaran kelas asal.');
        }

        const sudahDiproses = new Set<number>();
        const dalamKelas = db.prepare(`SELECT 1 FROM penempatan WHERE siswa_id = ? AND kelas_id = ?`);
        const kelasTujuanSah = db.prepare(`SELECT 1 FROM kelas WHERE id = ? AND tahun_ajaran_id = ?`);
        const upsertPenempatan = db.prepare(
          `INSERT INTO penempatan (siswa_id, kelas_id, tahun_ajaran_id) VALUES (?, ?, ?)
           ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET kelas_id = excluded.kelas_id`
        );
        const ubahStatus = db.prepare(`UPDATE siswa SET status = ? WHERE id = ?`);

        const hasil = { dipindah: 0, lulus: 0, keluar: 0 };
        for (const p of data.perubahan) {
          if (sudahDiproses.has(p.siswa_id)) {
            throw new Penolakan('VALIDASI_GAGAL', 'Satu siswa muncul lebih dari sekali dalam daftar.');
          }
          sudahDiproses.add(p.siswa_id);

          if (!dalamKelas.get(p.siswa_id, data.kelas_asal_id)) {
            throw new Penolakan('VALIDASI_GAGAL', 'Ada siswa yang tidak berada pada kelas asal. Muat ulang daftar lalu coba lagi.');
          }

          if (p.tindakan === 'pindah') {
            if (!kelasTujuanSah.get(p.kelas_tujuan_id, tujuan.id)) {
              throw new Penolakan('VALIDASI_GAGAL', 'Kelas tujuan bukan kelas pada tahun ajaran tujuan.');
            }
            upsertPenempatan.run(p.siswa_id, p.kelas_tujuan_id, tujuan.id);
            // Siswa yang naik kelas kembali aktif (mis. sebelumnya ditandai keluar karena salah catat)
            ubahStatus.run('aktif', p.siswa_id);
            hasil.dipindah++;
          } else if (p.tindakan === 'lulus') {
            ubahStatus.run('lulus', p.siswa_id);
            hasil.lulus++;
          } else {
            ubahStatus.run('keluar', p.siswa_id);
            hasil.keluar++;
          }
        }

        // Ringkasan hanya jumlah, tanpa nama atau nominal (NFR-02)
        db.prepare(
          `INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
           VALUES (datetime('now'), 'kenaikan.terapkan', 'kelas', ?, ?)`
        ).run(
          data.kelas_asal_id,
          `Kenaikan kelas: ${hasil.dipindah} dipindah, ${hasil.lulus} lulus, ${hasil.keluar} keluar`
        );
        return hasil;
      });

      return { ok: true, data: tx() };
    } catch (err) {
      if (err instanceof Penolakan) return { ok: false, kode: err.kode, pesan: err.pesan };
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
