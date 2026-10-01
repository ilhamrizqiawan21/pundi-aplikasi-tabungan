import { getDb } from '../db/index.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import type { Transaksi, Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

export interface SetorInput {
  siswa_id: number;
  nominal: number;
  tanggal?: string;
  keterangan?: string;
}

export interface SaldoAwalInput {
  siswa_id: number;
  nominal: number;
  tanggal: string;
  impor_id?: number | null;
  keterangan?: string;
}

export interface TarikInput {
  siswa_id: number;
  nominal: number;
  tanggal?: string;
  keterangan?: string;
}

export interface BalikInput {
  transaksi_id: number;
  alasan: string;
}

export interface RiwayatFilter {
  siswa_id?: number;
  tanggal?: string;
  dari_tanggal?: string;
  sampai_tanggal?: string;
  kelas_id?: number;
  limit?: number;
}

export class LedgerService {
  /**
   * Menghasilkan nomor bukti berurutan atomik dalam transaksi SQL (mis. TRX-2026-000001)
   */
  private generateNomorBukti(db: ReturnType<typeof getDb>, tanggal: string): string {
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
  public getSaldoSiswa(siswaId: number): number {
    const db = getDb();
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
  private getKelasAktifSiswa(db: ReturnType<typeof getDb>, siswaId: number): number | null {
    const row = db.prepare(`
      SELECT p.kelas_id
      FROM penempatan p
      JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
      WHERE p.siswa_id = ? AND ta.aktif = 1
      LIMIT 1
    `).get(siswaId) as { kelas_id: number } | undefined;

    return row ? row.kelas_id : null;
  }

  /**
   * CAP-05: Setoran tabungan siswa
   */
  public setor(input: SetorInput): Result<Transaksi> {
    const db = getDb();
    const tanggal = input.tanggal || hariIniLokal();

    if (!Number.isInteger(input.nominal) || input.nominal <= 0) {
      return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
    }

    try {
      let createdTrx: Transaksi | null = null;

      const tx = db.transaction(() => {
        // Cek keberadaan siswa
        const siswa = db.prepare(`SELECT id, status FROM siswa WHERE id = ?`).get(input.siswa_id) as {
          id: number;
          status: string;
        } | undefined;

        if (!siswa) {
          throw new Error('SISWA_TIDAK_DITEMUKAN');
        }

        const saldoLama = this.getSaldoSiswa(input.siswa_id);
        const saldoBaru = saldoLama + input.nominal;
        const nomorBukti = this.generateNomorBukti(db, tanggal);
        const kelasId = this.getKelasAktifSiswa(db, input.siswa_id);
        const dibuatPada = new Date().toISOString();

        const insert = db.prepare(`
          INSERT INTO transaksi (
            nomor_bukti, siswa_id, kelas_id, tanggal, jenis, nilai,
            saldo_setelah, keterangan, membalik_id, impor_id, dibuat_pada
          ) VALUES (?, ?, ?, ?, 'setoran', ?, ?, ?, NULL, NULL, ?)
        `).run(
          nomorBukti,
          input.siswa_id,
          kelasId,
          tanggal,
          input.nominal,
          saldoBaru,
          input.keterangan || null,
          dibuatPada
        );

        // Audit log
        db.prepare(`
          INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
          VALUES (?, 'transaksi.setor', 'transaksi', ?, 'Setoran berhasil')
        `).run(dibuatPada, insert.lastInsertRowid);

        createdTrx = {
          id: Number(insert.lastInsertRowid),
          nomor_bukti: nomorBukti,
          siswa_id: input.siswa_id,
          kelas_id: kelasId,
          tanggal,
          jenis: 'setoran',
          nilai: input.nominal,
          saldo_setelah: saldoBaru,
          keterangan: input.keterangan || null,
          membalik_id: null,
          impor_id: null,
          dibuat_pada: dibuatPada,
        };
      });

      tx();

      return { ok: true, data: createdTrx! };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'SISWA_TIDAK_DITEMUKAN') {
        return { ok: false, kode: 'SISWA_TIDAK_DITEMUKAN', pesan: ERROR_MESSAGES.SISWA_TIDAK_DITEMUKAN };
      }
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * CAP-14: Saldo awal siswa hasil migrasi dari aplikasi lama.
   * Dicatat sebagai transaksi `saldo_awal` (bukan setoran) dan hanya untuk siswa yang belum punya transaksi.
   * Aman dipanggil di dalam transaksi SQL pemanggil (menjadi savepoint), sehingga impor tetap atomik.
   */
  public saldoAwal(input: SaldoAwalInput): Result<Transaksi> {
    const db = getDb();

    if (!Number.isSafeInteger(input.nominal) || input.nominal <= 0) {
      return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
    }

    try {
      let dibuat: Transaksi | null = null;

      const tx = db.transaction(() => {
        const siswa = db.prepare(`SELECT id FROM siswa WHERE id = ?`).get(input.siswa_id);
        if (!siswa) throw new Error('SISWA_TIDAK_DITEMUKAN');

        const sudahAda = db.prepare(`SELECT COUNT(*) AS n FROM transaksi WHERE siswa_id = ?`).get(input.siswa_id) as {
          n: number;
        };
        if (sudahAda.n > 0) throw new Error('SALDO_AWAL_DITOLAK');

        const nomorBukti = this.generateNomorBukti(db, input.tanggal);
        const kelasId = this.getKelasAktifSiswa(db, input.siswa_id);
        const dibuatPada = new Date().toISOString();
        const keterangan = input.keterangan || 'Saldo awal';

        const insert = db
          .prepare(
            `INSERT INTO transaksi (
               nomor_bukti, siswa_id, kelas_id, tanggal, jenis, nilai,
               saldo_setelah, keterangan, membalik_id, impor_id, dibuat_pada
             ) VALUES (?, ?, ?, ?, 'saldo_awal', ?, ?, ?, NULL, ?, ?)`
          )
          .run(
            nomorBukti,
            input.siswa_id,
            kelasId,
            input.tanggal,
            input.nominal,
            input.nominal,
            keterangan,
            input.impor_id ?? null,
            dibuatPada
          );

        db.prepare(
          `INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
           VALUES (?, 'transaksi.saldo_awal', 'transaksi', ?, 'Saldo awal dicatat')`
        ).run(dibuatPada, insert.lastInsertRowid);

        dibuat = {
          id: Number(insert.lastInsertRowid),
          nomor_bukti: nomorBukti,
          siswa_id: input.siswa_id,
          kelas_id: kelasId,
          tanggal: input.tanggal,
          jenis: 'saldo_awal',
          nilai: input.nominal,
          saldo_setelah: input.nominal,
          keterangan,
          membalik_id: null,
          impor_id: input.impor_id ?? null,
          dibuat_pada: dibuatPada,
        };
      });
      tx();

      return { ok: true, data: dibuat! };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'SISWA_TIDAK_DITEMUKAN') {
        return { ok: false, kode: 'SISWA_TIDAK_DITEMUKAN', pesan: ERROR_MESSAGES.SISWA_TIDAK_DITEMUKAN };
      }
      if (msg === 'SALDO_AWAL_DITOLAK') {
        return {
          ok: false,
          kode: 'VALIDASI_GAGAL',
          pesan: 'Saldo awal hanya bisa dicatat untuk siswa yang belum punya transaksi.',
        };
      }
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * CAP-06: Penarikan tabungan siswa
   */
  public tarik(input: TarikInput): Result<Transaksi> {
    const db = getDb();
    const tanggal = input.tanggal || hariIniLokal();

    if (!Number.isInteger(input.nominal) || input.nominal <= 0) {
      return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
    }

    try {
      let createdTrx: Transaksi | null = null;

      const tx = db.transaction(() => {
        const siswa = db.prepare(`SELECT id, status FROM siswa WHERE id = ?`).get(input.siswa_id) as {
          id: number;
          status: string;
        } | undefined;

        if (!siswa) {
          throw new Error('SISWA_TIDAK_DITEMUKAN');
        }

        const saldoLama = this.getSaldoSiswa(input.siswa_id);
        if (input.nominal > saldoLama) {
          throw new Error('SALDO_TIDAK_CUKUP');
        }

        const saldoBaru = saldoLama - input.nominal;
        const nomorBukti = this.generateNomorBukti(db, tanggal);
        const kelasId = this.getKelasAktifSiswa(db, input.siswa_id);
        const dibuatPada = new Date().toISOString();

        const insert = db.prepare(`
          INSERT INTO transaksi (
            nomor_bukti, siswa_id, kelas_id, tanggal, jenis, nilai,
            saldo_setelah, keterangan, membalik_id, impor_id, dibuat_pada
          ) VALUES (?, ?, ?, ?, 'penarikan', ?, ?, ?, NULL, NULL, ?)
        `).run(
          nomorBukti,
          input.siswa_id,
          kelasId,
          tanggal,
          -input.nominal,
          saldoBaru,
          input.keterangan || null,
          dibuatPada
        );

        db.prepare(`
          INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
          VALUES (?, 'transaksi.tarik', 'transaksi', ?, 'Penarikan berhasil')
        `).run(dibuatPada, insert.lastInsertRowid);

        createdTrx = {
          id: Number(insert.lastInsertRowid),
          nomor_bukti: nomorBukti,
          siswa_id: input.siswa_id,
          kelas_id: kelasId,
          tanggal,
          jenis: 'penarikan',
          nilai: -input.nominal,
          saldo_setelah: saldoBaru,
          keterangan: input.keterangan || null,
          membalik_id: null,
          impor_id: null,
          dibuat_pada: dibuatPada,
        };
      });

      tx();

      return { ok: true, data: createdTrx! };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'SISWA_TIDAK_DITEMUKAN') {
        return { ok: false, kode: 'SISWA_TIDAK_DITEMUKAN', pesan: ERROR_MESSAGES.SISWA_TIDAK_DITEMUKAN };
      }
      if (msg === 'SALDO_TIDAK_CUKUP') {
        return { ok: false, kode: 'SALDO_TIDAK_CUKUP', pesan: ERROR_MESSAGES.SALDO_TIDAK_CUKUP };
      }
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * CAP-07: Koreksi transaksi (membuat transaksi pembalik)
   */
  public balik(input: BalikInput): Result<Transaksi> {
    const db = getDb();
    const alasan = input.alasan?.trim();
    if (!alasan || alasan.length < 3) {
      return { ok: false, kode: 'ALASAN_KOREKSI_WAJIB', pesan: ERROR_MESSAGES.ALASAN_KOREKSI_WAJIB };
    }

    try {
      let createdTrx: Transaksi | null = null;

      const tx = db.transaction(() => {
        const target = db.prepare(`SELECT * FROM transaksi WHERE id = ?`).get(input.transaksi_id) as Transaksi | undefined;
        if (!target) {
          throw new Error('TRANSAKSI_TIDAK_DITEMUKAN');
        }

        if (target.jenis === 'pembalik') {
          throw new Error('TRANSAKSI_PEMBALIK_DITOLAK');
        }

        // Cek apakah transaksi ini sudah pernah dibalik
        const sudahDibalik = db.prepare(`SELECT id FROM transaksi WHERE membalik_id = ?`).get(target.id);
        if (sudahDibalik) {
          throw new Error('TRANSAKSI_SUDAH_DIBALIK');
        }

        const saldoLama = this.getSaldoSiswa(target.siswa_id);
        const nilaiPembalik = -target.nilai;
        const saldoBaru = saldoLama + nilaiPembalik;

        if (saldoBaru < 0) {
          throw new Error('SALDO_TIDAK_CUKUP');
        }

        const tanggal = hariIniLokal();
        const nomorBukti = this.generateNomorBukti(db, tanggal);
        const dibuatPada = new Date().toISOString();

        const insert = db.prepare(`
          INSERT INTO transaksi (
            nomor_bukti, siswa_id, kelas_id, tanggal, jenis, nilai,
            saldo_setelah, keterangan, membalik_id, impor_id, dibuat_pada
          ) VALUES (?, ?, ?, ?, 'pembalik', ?, ?, ?, ?, NULL, ?)
        `).run(
          nomorBukti,
          target.siswa_id,
          target.kelas_id,
          tanggal,
          nilaiPembalik,
          saldoBaru,
          `Koreksi atas ${target.nomor_bukti}: ${alasan}`,
          target.id,
          dibuatPada
        );

        db.prepare(`
          INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
          VALUES (?, 'transaksi.balik', 'transaksi', ?, 'Pembalikan transaksi berhasil')
        `).run(dibuatPada, insert.lastInsertRowid);

        createdTrx = {
          id: Number(insert.lastInsertRowid),
          nomor_bukti: nomorBukti,
          siswa_id: target.siswa_id,
          kelas_id: target.kelas_id,
          tanggal,
          jenis: 'pembalik',
          nilai: nilaiPembalik,
          saldo_setelah: saldoBaru,
          keterangan: `Koreksi atas ${target.nomor_bukti}: ${alasan}`,
          membalik_id: target.id,
          impor_id: null,
          dibuat_pada: dibuatPada,
        };
      });

      tx();

      return { ok: true, data: createdTrx! };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'TRANSAKSI_TIDAK_DITEMUKAN') {
        return { ok: false, kode: 'TRANSAKSI_TIDAK_DITEMUKAN', pesan: ERROR_MESSAGES.TRANSAKSI_TIDAK_DITEMUKAN };
      }
      if (msg === 'TRANSAKSI_PEMBALIK_DITOLAK') {
        return { ok: false, kode: 'TRANSAKSI_PEMBALIK_DITOLAK', pesan: ERROR_MESSAGES.TRANSAKSI_PEMBALIK_DITOLAK };
      }
      if (msg === 'TRANSAKSI_SUDAH_DIBALIK') {
        return { ok: false, kode: 'TRANSAKSI_SUDAH_DIBALIK', pesan: ERROR_MESSAGES.TRANSAKSI_SUDAH_DIBALIK };
      }
      if (msg === 'SALDO_TIDAK_CUKUP') {
        return { ok: false, kode: 'SALDO_TIDAK_CUKUP', pesan: 'Pembalikan ditolak karena menyebabkan saldo siswa menjadi negatif.' };
      }
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * CAP-10: Riwayat transaksi (buku besar)
   */
  public riwayat(filter: RiwayatFilter): Result<Transaksi[]> {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.siswa_id) {
      conditions.push('t.siswa_id = ?');
      params.push(filter.siswa_id);
    }
    if (filter.tanggal) {
      conditions.push('t.tanggal = ?');
      params.push(filter.tanggal);
    }
    if (filter.dari_tanggal) {
      conditions.push('t.tanggal >= ?');
      params.push(filter.dari_tanggal);
    }
    if (filter.sampai_tanggal) {
      conditions.push('t.tanggal <= ?');
      params.push(filter.sampai_tanggal);
    }
    if (filter.kelas_id) {
      conditions.push('t.kelas_id = ?');
      params.push(filter.kelas_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ? Math.min(filter.limit, 500) : 100;

    try {
      const rows = db.prepare(`
        SELECT
          t.*,
          s.nama AS siswa_nama,
          s.nomor AS siswa_nomor,
          k.nama AS kelas_nama
        FROM transaksi t
        JOIN siswa s ON s.id = t.siswa_id
        LEFT JOIN kelas k ON k.id = t.kelas_id
        ${whereClause}
        ORDER BY t.id DESC
        LIMIT ?
      `).all(...params, limit) as Transaksi[];

      return { ok: true, data: rows };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
