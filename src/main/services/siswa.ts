import { getDb } from '../db/index.js';
import type { Siswa, StatusSiswa, Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

export interface SiswaSimpanInput {
  id?: number;
  nis?: string | null;
  nama: string;
  alamat?: string | null;
  status: StatusSiswa;
  kelas_id?: number | null;
}

export class SiswaService {
  private generateNomorSiswa(db: ReturnType<typeof getDb>): string {
    db.prepare(`
      INSERT INTO sekuens (nama, nilai) VALUES ('nomor_siswa', 1)
      ON CONFLICT(nama) DO UPDATE SET nilai = nilai + 1
    `).run();

    const row = db.prepare(`SELECT nilai FROM sekuens WHERE nama = 'nomor_siswa'`).get() as {
      nilai: number;
    };
    const seq = row.nilai.toString().padStart(6, '0');
    return `T-${seq}`;
  }

  public cari(query: string = '', kelasId?: number, status?: StatusSiswa): Result<Siswa[]> {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.trim()) {
      const q = `%${query.trim()}%`;
      conditions.push('(s.nama LIKE ? OR s.nomor LIKE ? OR s.nis LIKE ?)');
      params.push(q, q, q);
    }

    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }

    if (kelasId) {
      conditions.push('p.kelas_id = ?');
      params.push(kelasId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const rows = db.prepare(`
        SELECT
          s.*,
          k.id AS kelas_id,
          k.nama AS kelas_nama,
          COALESCE((
            SELECT saldo_setelah FROM transaksi
            WHERE siswa_id = s.id
            ORDER BY id DESC LIMIT 1
          ), 0) AS saldo
        FROM siswa s
        LEFT JOIN penempatan p ON p.siswa_id = s.id AND p.tahun_ajaran_id = (
          SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1
        )
        LEFT JOIN kelas k ON k.id = p.kelas_id
        ${whereClause}
        ORDER BY s.nama ASC
        LIMIT 100
      `).all(...params) as Siswa[];

      return { ok: true, data: rows };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public detail(id: number): Result<Siswa> {
    const db = getDb();
    try {
      const row = db.prepare(`
        SELECT
          s.*,
          k.id AS kelas_id,
          k.nama AS kelas_nama,
          COALESCE((
            SELECT saldo_setelah FROM transaksi
            WHERE siswa_id = s.id
            ORDER BY id DESC LIMIT 1
          ), 0) AS saldo
        FROM siswa s
        LEFT JOIN penempatan p ON p.siswa_id = s.id AND p.tahun_ajaran_id = (
          SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1
        )
        LEFT JOIN kelas k ON k.id = p.kelas_id
        WHERE s.id = ?
      `).get(id) as Siswa | undefined;

      if (!row) {
        return { ok: false, kode: 'SISWA_TIDAK_DITEMUKAN', pesan: ERROR_MESSAGES.SISWA_TIDAK_DITEMUKAN };
      }

      return { ok: true, data: row };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public simpan(input: SiswaSimpanInput): Result<Siswa> {
    const db = getDb();
    const nama = input.nama?.trim();
    if (!nama) {
      return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Nama siswa wajib diisi.' };
    }

    try {
      let savedId = input.id;

      const tx = db.transaction(() => {
        const aktifTa = db.prepare(`SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1`).get() as {
          id: number;
        } | undefined;

        if (input.id) {
          // Update
          db.prepare(`
            UPDATE siswa
            SET nis = ?, nama = ?, alamat = ?, status = ?
            WHERE id = ?
          `).run(input.nis || null, nama, input.alamat || null, input.status, input.id);

          // Update penempatan pada tahun ajaran aktif jika ada kelas_id
          if (aktifTa && input.kelas_id !== undefined) {
            if (input.kelas_id) {
              db.prepare(`
                INSERT INTO penempatan (siswa_id, kelas_id, tahun_ajaran_id)
                VALUES (?, ?, ?)
                ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET kelas_id = excluded.kelas_id
              `).run(input.id, input.kelas_id, aktifTa.id);
            } else {
              db.prepare(`
                DELETE FROM penempatan
                WHERE siswa_id = ? AND tahun_ajaran_id = ?
              `).run(input.id, aktifTa.id);
            }
          }
        } else {
          // Tambah baru
          const nomor = this.generateNomorSiswa(db);
          const dibuatPada = new Date().toISOString();

          const insert = db.prepare(`
            INSERT INTO siswa (nomor, nis, nama, alamat, status, dibuat_pada)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(nomor, input.nis || null, nama, input.alamat || null, input.status, dibuatPada);

          savedId = Number(insert.lastInsertRowid);

          if (aktifTa && input.kelas_id) {
            db.prepare(`
              INSERT INTO penempatan (siswa_id, kelas_id, tahun_ajaran_id)
              VALUES (?, ?, ?)
            `).run(savedId, input.kelas_id, aktifTa.id);
          }

          db.prepare(`
            INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
            VALUES (?, 'siswa.tambah', 'siswa', ?, 'Siswa baru ditambahkan')
          `).run(dibuatPada, savedId);
        }
      });

      tx();

      return this.detail(savedId!);
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public hapus(id: number): Result<{ sukses: boolean }> {
    const db = getDb();
    try {
      // Cek transaksi
      const trx = db.prepare(`SELECT id FROM transaksi WHERE siswa_id = ? LIMIT 1`).get(id);
      if (trx) {
        return {
          ok: false,
          kode: 'SISWA_SUDAH_PUNYA_TRANSAKSI',
          pesan: ERROR_MESSAGES.SISWA_SUDAH_PUNYA_TRANSAKSI,
        };
      }

      const tx = db.transaction(() => {
        db.prepare(`DELETE FROM penempatan WHERE siswa_id = ?`).run(id);
        db.prepare(`DELETE FROM siswa WHERE id = ?`).run(id);
      });
      tx();

      return { ok: true, data: { sukses: true } };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
