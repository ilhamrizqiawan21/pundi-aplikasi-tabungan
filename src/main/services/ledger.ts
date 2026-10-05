import { getDb } from '../db/index.js';
import { hariIniLokal, tanggalKalenderValid } from '../../shared/tanggal.js';
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

export interface SetorMassalInput {
  tanggal?: string;
  keterangan?: string;
  baris: { siswa_id: number; nominal: number }[];
}

export interface HasilSetorMassal {
  jumlah: number;
  total: number;
  transaksi_ids: number[];
}

/** Dilempar di dalam transaksi SQL setoran massal agar semuanya dibatalkan bila satu baris gagal. */
class GagalBarisMassal extends Error {
  constructor(public readonly hasil: { kode: string; pesan: string }, public readonly nomorBaris: number) {
    super('GAGAL_BARIS_MASSAL');
  }
}

export interface BiayaAdmInput {
  siswa_id: number;
  nominal: number;
  tanggal?: string;
  keterangan?: string;
}

export interface BiayaAdmMassalInput {
  kelas_id: number;
  nominal: number;
  /** Label periode bebas (mis. "Semester 1 2025/2026"); menjadi bagian keterangan dan kunci anti-ganda. */
  periode: string;
  tanggal?: string;
}

export interface RencanaBiayaAdm {
  keterangan: string;
  dipotong: { siswa_id: number; nomor: string; nama: string; saldo: number }[];
  dilewati: { siswa_id: number; nomor: string; nama: string; alasan: string }[];
}

export interface HasilBiayaAdmMassal {
  jumlah: number;
  total: number;
  dilewati: RencanaBiayaAdm['dilewati'];
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

/** Tanggal transaksi harus ada di kalender; setoran/penarikan tidak boleh bertanggal masa depan. */
function galatTanggal(tanggal: string, bolehMasaDepan: boolean): string | null {
  if (!tanggalKalenderValid(tanggal)) return 'Tanggal tidak valid (format YYYY-MM-DD).';
  if (!bolehMasaDepan && tanggal > hariIniLokal()) return 'Tanggal transaksi tidak boleh di masa depan.';
  return null;
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

    if (!Number.isSafeInteger(input.nominal) || input.nominal <= 0) {
      return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
    }
    const salahTanggal = galatTanggal(tanggal, false);
    if (salahTanggal) return { ok: false, kode: 'VALIDASI_GAGAL', pesan: salahTanggal };

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
        // Siswa lulus/keluar tidak menyetor lagi; penarikan sisa saldo tetap boleh
        if (siswa.status !== 'aktif') {
          throw new Error('SISWA_TIDAK_AKTIF');
        }

        const saldoLama = this.getSaldoSiswa(input.siswa_id);
        const saldoBaru = saldoLama + input.nominal;
        if (!Number.isSafeInteger(saldoBaru)) throw new Error('NOMINAL_TIDAK_VALID');
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
      if (msg === 'SISWA_TIDAK_AKTIF') {
        return { ok: false, kode: 'SISWA_TIDAK_AKTIF', pesan: ERROR_MESSAGES.SISWA_TIDAK_AKTIF };
      }
      if (msg === 'NOMINAL_TIDAK_VALID') {
        return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
      }
      console.error('ledger.setor gagal:', (err as { code?: string }).code ?? 'TAK_DIKENAL');
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * CAP-19: Setoran massal satu kelas. Semua baris disimpan dalam satu transaksi SQL lewat `setor`
   * (nomor bukti dan saldo dibuat di sana); satu baris gagal berarti tidak ada yang tersimpan.
   */
  public setorMassal(input: SetorMassalInput): Result<HasilSetorMassal> {
    const db = getDb();
    try {
      const transaksiIds: number[] = [];
      let total = 0;
      db.transaction(() => {
        input.baris.forEach((b, i) => {
          const res = this.setor({
            siswa_id: b.siswa_id,
            nominal: b.nominal,
            tanggal: input.tanggal,
            keterangan: input.keterangan,
          });
          if (!res.ok) throw new GagalBarisMassal(res, i + 1);
          transaksiIds.push(res.data.id);
          total += b.nominal;
        });
      })();
      if (!Number.isSafeInteger(total)) {
        // Tidak terjangkau karena tiap saldo sudah dicek; dijaga agar jumlah tidak pernah tidak valid
        return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
      }
      return { ok: true, data: { jumlah: transaksiIds.length, total, transaksi_ids: transaksiIds } };
    } catch (err: unknown) {
      if (err instanceof GagalBarisMassal) {
        return {
          ok: false,
          kode: err.hasil.kode,
          pesan: `Baris ke-${err.nomorBaris}: ${err.hasil.pesan} Tidak ada setoran yang tersimpan.`,
        };
      }
      console.error('ledger.setorMassal gagal:', (err as { code?: string }).code ?? 'TAK_DIKENAL');
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * CAP-08: Biaya administrasi satu siswa. Transaksi tersendiri (`biaya_adm`) yang mengurangi saldo;
   * tidak boleh membuat saldo negatif. Uang tidak keluar dari laci, jadi tidak masuk hitungan kas.
   */
  public biayaAdm(input: BiayaAdmInput): Result<Transaksi> {
    const db = getDb();
    const tanggal = input.tanggal || hariIniLokal();

    if (!Number.isSafeInteger(input.nominal) || input.nominal <= 0) {
      return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
    }
    const salahTanggal = galatTanggal(tanggal, false);
    if (salahTanggal) return { ok: false, kode: 'VALIDASI_GAGAL', pesan: salahTanggal };

    try {
      let createdTrx: Transaksi | null = null;
      db.transaction(() => {
        const siswa = db.prepare(`SELECT id FROM siswa WHERE id = ?`).get(input.siswa_id);
        if (!siswa) throw new Error('SISWA_TIDAK_DITEMUKAN');

        const saldoLama = this.getSaldoSiswa(input.siswa_id);
        if (input.nominal > saldoLama) throw new Error('SALDO_TIDAK_CUKUP');

        const saldoBaru = saldoLama - input.nominal;
        const nomorBukti = this.generateNomorBukti(db, tanggal);
        const kelasId = this.getKelasAktifSiswa(db, input.siswa_id);
        const dibuatPada = new Date().toISOString();

        const insert = db.prepare(`
          INSERT INTO transaksi (
            nomor_bukti, siswa_id, kelas_id, tanggal, jenis, nilai,
            saldo_setelah, keterangan, membalik_id, impor_id, dibuat_pada
          ) VALUES (?, ?, ?, ?, 'biaya_adm', ?, ?, ?, NULL, NULL, ?)
        `).run(nomorBukti, input.siswa_id, kelasId, tanggal, -input.nominal, saldoBaru, input.keterangan || null, dibuatPada);

        db.prepare(`
          INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
          VALUES (?, 'transaksi.biaya_adm', 'transaksi', ?, 'Biaya administrasi dicatat')
        `).run(dibuatPada, insert.lastInsertRowid);

        createdTrx = {
          id: Number(insert.lastInsertRowid),
          nomor_bukti: nomorBukti,
          siswa_id: input.siswa_id,
          kelas_id: kelasId,
          tanggal,
          jenis: 'biaya_adm',
          nilai: -input.nominal,
          saldo_setelah: saldoBaru,
          keterangan: input.keterangan || null,
          membalik_id: null,
          impor_id: null,
          dibuat_pada: dibuatPada,
        };
      })();
      return { ok: true, data: createdTrx! };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'SISWA_TIDAK_DITEMUKAN') {
        return { ok: false, kode: 'SISWA_TIDAK_DITEMUKAN', pesan: ERROR_MESSAGES.SISWA_TIDAK_DITEMUKAN };
      }
      if (msg === 'SALDO_TIDAK_CUKUP') {
        return { ok: false, kode: 'SALDO_TIDAK_CUKUP', pesan: ERROR_MESSAGES.SALDO_TIDAK_CUKUP };
      }
      console.error('ledger.biayaAdm gagal:', (err as { code?: string }).code ?? 'TAK_DIKENAL');
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * Rencana potongan biaya administrasi satu kelas (hanya membaca). Aturan (D-06): hanya siswa aktif;
   * siswa yang saldonya kurang dari biaya dilewati (tidak ada potongan sebagian); siswa yang sudah dipotong
   * untuk periode yang sama (dan belum dikoreksi) dilewati agar tidak ganda.
   */
  public rencanaBiayaAdm(input: { kelas_id: number; nominal: number; periode: string }): Result<RencanaBiayaAdm> {
    const db = getDb();
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
        const saldo = this.getSaldoSiswa(s.id);
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

  /**
   * CAP-08: Potong biaya administrasi satu kelas sekaligus. Rencana dihitung ulang di dalam transaksi SQL
   * (bukan memercayai pratinjau), lalu tiap siswa yang layak dipotong lewat `biayaAdm`; gagal satu = batal semua.
   */
  public biayaAdmMassal(input: BiayaAdmMassalInput): Result<HasilBiayaAdmMassal> {
    const db = getDb();
    try {
      let hasil: HasilBiayaAdmMassal | null = null;
      let galat: { kode: string; pesan: string } | null = null;
      db.transaction(() => {
        const rencana = this.rencanaBiayaAdm(input);
        if (!rencana.ok) {
          galat = rencana;
          return;
        }
        if (rencana.data.dipotong.length === 0) {
          galat = { kode: 'VALIDASI_GAGAL', pesan: 'Tidak ada siswa yang bisa dipotong pada kelas ini.' };
          return;
        }
        for (const s of rencana.data.dipotong) {
          const res = this.biayaAdm({
            siswa_id: s.siswa_id,
            nominal: input.nominal,
            tanggal: input.tanggal,
            keterangan: rencana.data.keterangan,
          });
          if (!res.ok) throw new GagalBarisMassal(res, rencana.data.dipotong.indexOf(s) + 1);
        }
        hasil = {
          jumlah: rencana.data.dipotong.length,
          total: rencana.data.dipotong.length * input.nominal,
          dilewati: rencana.data.dilewati,
        };
      })();
      if (galat) return { ok: false, ...(galat as { kode: string; pesan: string }) };
      return { ok: true, data: hasil! };
    } catch (err: unknown) {
      if (err instanceof GagalBarisMassal) {
        return { ok: false, kode: err.hasil.kode, pesan: `Siswa ke-${err.nomorBaris}: ${err.hasil.pesan} Tidak ada potongan yang tersimpan.` };
      }
      console.error('ledger.biayaAdmMassal gagal:', (err as { code?: string }).code ?? 'TAK_DIKENAL');
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
    // Saldo awal boleh bertanggal lampau; yang dicek hanya keberadaannya di kalender
    const salahTanggal = galatTanggal(input.tanggal, true);
    if (salahTanggal) return { ok: false, kode: 'VALIDASI_GAGAL', pesan: salahTanggal };

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

    if (!Number.isSafeInteger(input.nominal) || input.nominal <= 0) {
      return { ok: false, kode: 'NOMINAL_TIDAK_VALID', pesan: ERROR_MESSAGES.NOMINAL_TIDAK_VALID };
    }
    const salahTanggal = galatTanggal(tanggal, false);
    if (salahTanggal) return { ok: false, kode: 'VALIDASI_GAGAL', pesan: salahTanggal };

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
      console.error('ledger.tarik gagal:', (err as { code?: string }).code ?? 'TAK_DIKENAL');
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
    // Sama dengan batas di IPC (TransaksiBalikSchema); service tidak boleh bergantung pada lapisan IPC saja
    if (alasan.length > 255) {
      return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Alasan koreksi maksimal 255 karakter.' };
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
      // Hanya kode galat, tanpa pesan/nominal/nama (NFR-02)
      console.error('ledger.balik gagal:', (err as { code?: string }).code ?? 'TAK_DIKENAL');
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
