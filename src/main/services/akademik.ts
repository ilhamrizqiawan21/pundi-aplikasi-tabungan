import { getDb } from '../db/index.js';
import type { TahunAjaran, Kelas, Result } from '../../shared/types.js';
import { ERROR_MESSAGES, type ErrorCode } from '../../shared/errors.js';

function gagal(kode: ErrorCode, pesan?: string): { ok: false; kode: ErrorCode; pesan: string } {
  return { ok: false, kode, pesan: pesan ?? ERROR_MESSAGES[kode] };
}

function pelanggaranUnik(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE';
}

export class AkademikService {
  public tahunAjaranDaftar(): Result<TahunAjaran[]> {
    const db = getDb();
    try {
      const rows = db.prepare(`SELECT * FROM tahun_ajaran ORDER BY mulai DESC, id DESC`).all() as TahunAjaran[];
      return { ok: true, data: rows };
    } catch {
      return gagal('DATABASE_ERROR');
    }
  }

  public tahunAjaranSimpan(data: {
    id?: number;
    nama: string;
    mulai: string;
    selesai: string;
    aktif: boolean;
  }): Result<TahunAjaran> {
    const db = getDb();
    if (data.selesai < data.mulai) {
      return gagal('VALIDASI_GAGAL', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
    }

    try {
      let resultRow: TahunAjaran | null = null;
      const tx = db.transaction((): Result<TahunAjaran> | null => {
        if (data.id) {
          const lama = db.prepare(`SELECT * FROM tahun_ajaran WHERE id = ?`).get(data.id) as TahunAjaran | undefined;
          if (!lama) return gagal('TAHUN_AJARAN_TIDAK_DITEMUKAN');
          if (lama.aktif === 1 && !data.aktif) {
            return gagal(
              'VALIDASI_GAGAL',
              'Tahun ajaran yang sedang aktif tidak bisa dinonaktifkan. Jadikan tahun ajaran lain sebagai aktif.'
            );
          }
        }

        if (data.aktif) {
          // Hanya satu tahun ajaran aktif (CAP-02)
          db.prepare(`UPDATE tahun_ajaran SET aktif = 0 WHERE aktif = 1`).run();
        }

        if (data.id) {
          db.prepare(`
            UPDATE tahun_ajaran
            SET nama = ?, mulai = ?, selesai = ?, aktif = ?
            WHERE id = ?
          `).run(data.nama, data.mulai, data.selesai, data.aktif ? 1 : 0, data.id);
          resultRow = db.prepare(`SELECT * FROM tahun_ajaran WHERE id = ?`).get(data.id) as TahunAjaran;
        } else {
          const insert = db.prepare(`
            INSERT INTO tahun_ajaran (nama, mulai, selesai, aktif)
            VALUES (?, ?, ?, ?)
          `).run(data.nama, data.mulai, data.selesai, data.aktif ? 1 : 0);
          resultRow = db.prepare(`SELECT * FROM tahun_ajaran WHERE id = ?`).get(insert.lastInsertRowid) as TahunAjaran;
        }
        return null;
      });
      const penolakan = tx();
      if (penolakan) return penolakan;

      return { ok: true, data: resultRow! };
    } catch (err) {
      if (pelanggaranUnik(err)) {
        return gagal('DATA_DUPLIKAT', `Tahun ajaran "${data.nama}" sudah ada. Gunakan nama lain.`);
      }
      return gagal('DATABASE_ERROR');
    }
  }

  /** Hanya tahun ajaran yang tidak aktif dan belum punya kelas yang boleh dihapus. */
  public tahunAjaranHapus(id: number): Result<{ id: number }> {
    const db = getDb();
    try {
      const ta = db.prepare(`SELECT * FROM tahun_ajaran WHERE id = ?`).get(id) as TahunAjaran | undefined;
      if (!ta) return gagal('TAHUN_AJARAN_TIDAK_DITEMUKAN');
      if (ta.aktif === 1) {
        return gagal('MASIH_DIPAKAI', 'Tahun ajaran yang sedang aktif tidak bisa dihapus.');
      }
      const kelas = db.prepare(`SELECT COUNT(*) AS n FROM kelas WHERE tahun_ajaran_id = ?`).get(id) as { n: number };
      if (kelas.n > 0) {
        return gagal('MASIH_DIPAKAI', 'Tahun ajaran ini sudah punya kelas, sehingga tidak bisa dihapus.');
      }
      db.prepare(`DELETE FROM tahun_ajaran WHERE id = ?`).run(id);
      return { ok: true, data: { id } };
    } catch {
      return gagal('DATABASE_ERROR');
    }
  }

  public kelasDaftar(tahunAjaranId?: number): Result<Kelas[]> {
    const db = getDb();
    try {
      let query = `
        SELECT k.*, ta.nama AS tahun_ajaran_nama,
          (SELECT COUNT(*) FROM penempatan p WHERE p.kelas_id = k.id) AS jumlah_siswa
        FROM kelas k
        JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
      `;
      const params: unknown[] = [];
      if (tahunAjaranId) {
        query += ` WHERE k.tahun_ajaran_id = ?`;
        params.push(tahunAjaranId);
      }
      query += ` ORDER BY k.tingkat ASC, k.urutan ASC, k.nama ASC`;

      const rows = db.prepare(query).all(...params) as Kelas[];
      return { ok: true, data: rows };
    } catch {
      return gagal('DATABASE_ERROR');
    }
  }

  public kelasSimpan(data: {
    id?: number;
    tahun_ajaran_id: number;
    nama: string;
    tingkat: number;
    urutan: number;
  }): Result<Kelas> {
    const db = getDb();
    try {
      let resultRow: Kelas | null = null;
      if (data.id) {
        const lama = db.prepare(`SELECT * FROM kelas WHERE id = ?`).get(data.id) as Kelas | undefined;
        if (!lama) return gagal('KELAS_TIDAK_DITEMUKAN');
        // Penempatan dan transaksi menempel pada kelas; memindah tahun ajaran akan merusak riwayatnya
        if (lama.tahun_ajaran_id !== data.tahun_ajaran_id) {
          return gagal('VALIDASI_GAGAL', 'Kelas tidak dapat dipindahkan ke tahun ajaran lain.');
        }
        db.prepare(`
          UPDATE kelas
          SET nama = ?, tingkat = ?, urutan = ?
          WHERE id = ?
        `).run(data.nama, data.tingkat, data.urutan, data.id);
        resultRow = db.prepare(`SELECT * FROM kelas WHERE id = ?`).get(data.id) as Kelas;
      } else {
        const ta = db.prepare(`SELECT id FROM tahun_ajaran WHERE id = ?`).get(data.tahun_ajaran_id);
        if (!ta) return gagal('TAHUN_AJARAN_TIDAK_DITEMUKAN');
        const insert = db.prepare(`
          INSERT INTO kelas (tahun_ajaran_id, nama, tingkat, urutan)
          VALUES (?, ?, ?, ?)
        `).run(data.tahun_ajaran_id, data.nama, data.tingkat, data.urutan);
        resultRow = db.prepare(`SELECT * FROM kelas WHERE id = ?`).get(insert.lastInsertRowid) as Kelas;
      }

      return { ok: true, data: resultRow! };
    } catch (err) {
      if (pelanggaranUnik(err)) {
        return gagal('DATA_DUPLIKAT', `Kelas "${data.nama}" sudah ada pada tahun ajaran ini.`);
      }
      return gagal('DATABASE_ERROR');
    }
  }

  /** Menyalin daftar kelas (tanpa siswa) dari satu tahun ajaran ke tahun ajaran lain; yang sudah ada dilewati. */
  public kelasSalin(dariId: number, keId: number): Result<{ disalin: number; dilewati: number }> {
    const db = getDb();
    if (dariId === keId) {
      return gagal('VALIDASI_GAGAL', 'Pilih tahun ajaran asal yang berbeda dari tahun ajaran tujuan.');
    }
    try {
      const ada = db.prepare(`SELECT COUNT(*) AS n FROM tahun_ajaran WHERE id IN (?, ?)`).get(dariId, keId) as { n: number };
      if (ada.n !== 2) return gagal('TAHUN_AJARAN_TIDAK_DITEMUKAN');

      const tx = db.transaction(() => {
        const sumber = db
          .prepare(`SELECT nama, tingkat, urutan FROM kelas WHERE tahun_ajaran_id = ? ORDER BY tingkat, urutan, nama`)
          .all(dariId) as Array<{ nama: string; tingkat: number; urutan: number }>;
        const sisip = db.prepare(
          `INSERT OR IGNORE INTO kelas (tahun_ajaran_id, nama, tingkat, urutan) VALUES (?, ?, ?, ?)`
        );
        let disalin = 0;
        for (const k of sumber) {
          disalin += sisip.run(keId, k.nama, k.tingkat, k.urutan).changes;
        }
        return { disalin, dilewati: sumber.length - disalin };
      });
      return { ok: true, data: tx() };
    } catch {
      return gagal('DATABASE_ERROR');
    }
  }

  /** Kelas yang sudah pernah berisi siswa atau transaksi tidak dihapus agar riwayatnya utuh. */
  public kelasHapus(id: number): Result<{ id: number }> {
    const db = getDb();
    try {
      const k = db.prepare(`SELECT id FROM kelas WHERE id = ?`).get(id);
      if (!k) return gagal('KELAS_TIDAK_DITEMUKAN');
      const pakai = db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM penempatan WHERE kelas_id = ?) AS siswa,
                  (SELECT COUNT(*) FROM transaksi WHERE kelas_id = ?) AS transaksi`
        )
        .get(id, id) as { siswa: number; transaksi: number };
      if (pakai.siswa > 0 || pakai.transaksi > 0) {
        return gagal(
          'MASIH_DIPAKAI',
          'Kelas ini masih berisi siswa atau sudah punya riwayat transaksi, sehingga tidak bisa dihapus.'
        );
      }
      db.prepare(`DELETE FROM kelas WHERE id = ?`).run(id);
      return { ok: true, data: { id } };
    } catch {
      return gagal('DATABASE_ERROR');
    }
  }
}
