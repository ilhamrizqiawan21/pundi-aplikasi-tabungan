import { getDb } from '../db/index.js';
import type { TahunAjaran, Kelas, Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

export class AkademikService {
  public tahunAjaranDaftar(): Result<TahunAjaran[]> {
    const db = getDb();
    try {
      const rows = db.prepare(`SELECT * FROM tahun_ajaran ORDER BY id DESC`).all() as TahunAjaran[];
      return { ok: true, data: rows };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
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
    try {
      let resultRow: TahunAjaran | null = null;
      const tx = db.transaction(() => {
        if (data.aktif) {
          // Nonaktifkan tahun ajaran lain
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
      });
      tx();

      return { ok: true, data: resultRow! };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public kelasDaftar(tahunAjaranId?: number): Result<Kelas[]> {
    const db = getDb();
    try {
      let query = `
        SELECT k.*, ta.nama AS tahun_ajaran_nama
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
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
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
        db.prepare(`
          UPDATE kelas
          SET tahun_ajaran_id = ?, nama = ?, tingkat = ?, urutan = ?
          WHERE id = ?
        `).run(data.tahun_ajaran_id, data.nama, data.tingkat, data.urutan, data.id);
        resultRow = db.prepare(`SELECT * FROM kelas WHERE id = ?`).get(data.id) as Kelas;
      } else {
        const insert = db.prepare(`
          INSERT INTO kelas (tahun_ajaran_id, nama, tingkat, urutan)
          VALUES (?, ?, ?, ?)
        `).run(data.tahun_ajaran_id, data.nama, data.tingkat, data.urutan);
        resultRow = db.prepare(`SELECT * FROM kelas WHERE id = ?`).get(insert.lastInsertRowid) as Kelas;
      }

      return { ok: true, data: resultRow! };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
