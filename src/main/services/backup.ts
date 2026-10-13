import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  getDb,
  getDbPath,
  closeDb,
  reopenDb,
  pangkasCadanganOtomatis,
  BATAS_CADANGAN_OTOMATIS,
} from '../db/index.js';
import type { Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';
import { timestampWib } from '../../shared/tanggal.js';

export type JenisCadangan = 'manual' | 'otomatis' | 'pre-restore';

export interface ItemCadangan {
  nama: string;
  jalur: string;
  jenis: JenisCadangan;
  ukuran: number;
  tanggal: string;
}

const TABEL_WAJIB = [
  'tahun_ajaran',
  'kelas',
  'siswa',
  'penempatan',
  'transaksi',
  'profil_sekolah',
  'pengaturan',
  'audit_log',
  'schema_migrations',
];
// Pengaman tambah-saja (NFR-03): cadangan tanpa pemicu ini tidak boleh menggantikan data aktif.
const PEMICU_WAJIB = ['trg_transaksi_no_update', 'trg_transaksi_no_delete'];

export class BackupService {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public buat(
    keterangan?: string,
    jenis: JenisCadangan = 'manual'
  ): Result<{ berkas: string; ukuran_bytes: number }> {
    const db = getDb();
    try {
      const timestamp = timestampWib();
      const suffix = keterangan ? `_${keterangan.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      let filename = `pundi_${jenis}_${timestamp}${suffix}.sqlite`;
      let targetPath = path.join(this.baseDir, filename);

      let counter = 1;
      while (fs.existsSync(targetPath)) {
        filename = `pundi_${jenis}_${timestamp}${suffix}_${counter}.sqlite`;
        targetPath = path.join(this.baseDir, filename);
        counter++;
      }

      // Gunakan VACUUM INTO untuk backup SQLite yang konsisten (ERD §4.8)
      // Path di-escape untuk string literal SQL
      const escapedPath = targetPath.replace(/'/g, "''");
      db.exec(`VACUUM INTO '${escapedPath}';`);

      const stat = fs.statSync(targetPath);

      // Catat audit log
      db.prepare(`
        INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
        VALUES (datetime('now'), 'backup.buat', 'backup', NULL, ?)
      `).run(`Backup dibuat: ${filename}`);

      // Hanya cadangan otomatis yang dibatasi; cadangan manual dan pengaman tidak pernah dihapus sendiri
      this.bersihkanCadanganOtomatis();

      return {
        ok: true,
        data: {
          berkas: filename,
          ukuran_bytes: stat.size,
        },
      };
    } catch {
      return { ok: false, kode: 'BACKUP_GAGAL', pesan: ERROR_MESSAGES.BACKUP_GAGAL };
    }
  }

  /**
   * CAP-21: salinan cadangan ke folder pilihan pengguna (flashdisk, drive lain). Memakai VACUUM INTO,
   * bukan menyalin berkas mentah. Folder dipilih lewat dialog di proses utama.
   */
  public salinKeLuar(folderTujuan: string): Result<{ nama_berkas: string; ukuran_bytes: number }> {
    const db = getDb();
    try {
      if (!fs.existsSync(folderTujuan) || !fs.statSync(folderTujuan).isDirectory()) {
        return { ok: false, kode: 'BACKUP_GAGAL', pesan: 'Folder tujuan tidak ditemukan.' };
      }
      const nama = `pundi_salinan_${timestampWib()}.sqlite`;
      const target = path.join(folderTujuan, nama);
      db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}';`);
      const ukuran = fs.statSync(target).size;
      // Tanpa nama folder di log (NFR-02: log tidak memuat jalur pribadi)
      db.prepare(`
        INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
        VALUES (?, 'backup.salinKeLuar', 'backup', NULL, 'Salinan cadangan ke folder luar')
      `).run(new Date().toISOString());
      return { ok: true, data: { nama_berkas: nama, ukuran_bytes: ukuran } };
    } catch {
      return { ok: false, kode: 'BACKUP_GAGAL', pesan: ERROR_MESSAGES.BACKUP_GAGAL };
    }
  }

  /** Waktu salinan luar terakhir (dari audit log), atau null bila belum pernah. */
  public terakhirKeLuar(): Result<string | null> {
    try {
      const row = getDb()
        .prepare(`SELECT waktu FROM audit_log WHERE aksi = 'backup.salinKeLuar' ORDER BY id DESC LIMIT 1`)
        .get() as { waktu: string } | undefined;
      return { ok: true, data: row?.waktu ?? null };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  /**
   * Waktu cadangan terakhir yang dibuat pengguna/jadwal (manual atau otomatis). Cadangan pengaman
   * sebelum pemulihan tidak dihitung. Tidak membuat token berkas, jadi aman dipanggil dari bilah samping.
   */
  public terakhir(): Result<{ tanggal: string; jenis: JenisCadangan } | null> {
    const res = this.daftar();
    if (!res.ok) return res;
    const t = res.data.find((c) => c.jenis !== 'pre-restore');
    return { ok: true, data: t ? { tanggal: t.tanggal, jenis: t.jenis } : null };
  }

  /**
   * Memeriksa apakah cadangan otomatis harian perlu dibuat:
   * 1. Pengaturan `backup_otomatis` aktif di basis data (bawaan true).
   * 2. Cadangan otomatis terakhir lebih tua dari 24 jam (atau belum pernah dibuat).
   * Jam dapat disuntikkan lewat argumen `sekarang` (F7-3).
   */
  public perluBackupOtomatisHarian(sekarang: Date = new Date()): boolean {
    try {
      const db = getDb();
      const row = db.prepare(`SELECT nilai_json FROM pengaturan WHERE kunci = 'backup_otomatis'`).get() as
        | { nilai_json: string }
        | undefined;
      const aktif = row ? JSON.parse(row.nilai_json) === true : true;
      if (!aktif) return false;

      const daftarRes = this.daftar();
      if (!daftarRes.ok) return false;

      const otomatisTerakhir = daftarRes.data.find((c) => c.jenis === 'otomatis');
      if (!otomatisTerakhir) {
        // Hanya buat cadangan otomatis pertama jika sudah ada data transaksi (bukan basis data kosong baru)
        const trxCount = (db.prepare('SELECT COUNT(*) as n FROM transaksi').get() as { n: number })?.n ?? 0;
        return trxCount > 0;
      }

      const waktuTerakhir = new Date(otomatisTerakhir.tanggal).getTime();
      const selisihMs = sekarang.getTime() - waktuTerakhir;
      const duaPuluhEmpatJamMs = 24 * 60 * 60 * 1000;

      return selisihMs >= duaPuluhEmpatJamMs;
    } catch {
      return false;
    }
  }

  /**
   * Menjalankan cadangan otomatis harian bila memenuhi syarat (F7-3).
   */
  public jalankanBackupOtomatisJikaPerlu(sekarang: Date = new Date()): Result<{ dibuat: boolean; berkas?: string }> {
    if (!this.perluBackupOtomatisHarian(sekarang)) {
      return { ok: true, data: { dibuat: false } };
    }
    const res = this.buat('harian', 'otomatis');
    if (!res.ok) return res;
    return { ok: true, data: { dibuat: true, berkas: res.data.berkas } };
  }

  public daftar(): Result<ItemCadangan[]> {
    try {
      if (!fs.existsSync(this.baseDir)) {
        return { ok: true, data: [] };
      }

      const files = fs
        .readdirSync(this.baseDir)
        .filter((f) => f.startsWith('pundi_') && f.endsWith('.sqlite'))
        .map((f) => {
          const fullPath = path.join(this.baseDir, f);
          const stat = fs.statSync(fullPath);
          return {
            nama: f,
            jalur: fullPath,
            jenis: this.jenisDariNama(f),
            ukuran: stat.size,
            tanggal: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

      return { ok: true, data: files };
    } catch {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: ERROR_MESSAGES.FILE_TIDAK_VALID };
    }
  }

  /**
   * CAP-13: memulihkan data dari berkas cadangan.
   * Berkas disalin dulu, divalidasi, cadangan pengaman dibuat, baru menggantikan data aktif.
   * Bila langkah akhir gagal, data aktif dikembalikan dari cadangan pengaman.
   */
  public restore(sumber: string): Result<{ sukses: boolean }> {
    const livePath = getDbPath();
    const salinan = `${livePath}.restore`;
    const hapusSalinan = () => this.hapusBerkasDb(salinan);

    try {
      fs.copyFileSync(sumber, salinan);
    } catch {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Berkas cadangan tidak dapat dibaca.' };
    }

    const alasan = this.validasi(salinan);
    if (alasan) {
      hapusSalinan();
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: alasan };
    }

    const pengaman = this.buat('sebelum_pemulihan', 'pre-restore');
    if (!pengaman.ok) {
      hapusSalinan();
      return {
        ok: false,
        kode: 'RESTORE_GAGAL',
        pesan: 'Cadangan pengaman gagal dibuat, pemulihan dibatalkan. Data Anda tidak berubah.',
      };
    }
    const jalurPengaman = path.join(this.baseDir, pengaman.data.berkas);

    closeDb();
    try {
      // Sisa -wal/-shm milik basis data lama tidak boleh dipasangkan dengan berkas yang baru
      this.hapusSisaWal(livePath);
      fs.renameSync(salinan, livePath);
      reopenDb();
      getDb()
        .prepare(
          `INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
           VALUES (datetime('now'), 'restore', 'backup', NULL, 'Data dipulihkan dari cadangan')`
        )
        .run();
      return { ok: true, data: { sukses: true } };
    } catch {
      hapusSalinan();
      try {
        reopenDb();
      } catch {
        try {
          closeDb();
          this.hapusSisaWal(livePath);
          fs.copyFileSync(jalurPengaman, livePath);
          reopenDb();
        } catch {
          // Data aktif tetap aman di cadangan pengaman; galat dilaporkan di bawah
        }
      }
      return { ok: false, kode: 'RESTORE_GAGAL', pesan: ERROR_MESSAGES.RESTORE_GAGAL };
    }
  }

  /** Mengembalikan alasan penolakan (bahasa pengguna), atau null bila berkas layak dipulihkan. */
  private validasi(jalur: string): string | null {
    let cand: Database.Database | null = null;
    try {
      cand = new Database(jalur, { readonly: true, fileMustExist: true });

      if (cand.pragma('integrity_check', { simple: true }) !== 'ok') {
        return 'Berkas cadangan rusak dan tidak dapat dipulihkan.';
      }

      const nama = (jenis: 'table' | 'trigger') =>
        new Set(
          (cand!.prepare('SELECT name FROM sqlite_master WHERE type = ?').all(jenis) as Array<{ name: string }>).map(
            (r) => r.name
          )
        );
      const tabel = nama('table');
      if (TABEL_WAJIB.some((t) => !tabel.has(t))) {
        return 'Berkas ini bukan cadangan Pundi atau datanya tidak lengkap.';
      }
      const pemicu = nama('trigger');
      if (PEMICU_WAJIB.some((t) => !pemicu.has(t))) {
        return 'Cadangan ini tidak memiliki pengaman riwayat transaksi, sehingga tidak dipulihkan.';
      }

      const selisih = cand
        .prepare(
          `SELECT COUNT(*) AS n FROM siswa s
           WHERE COALESCE((SELECT saldo_setelah FROM transaksi WHERE siswa_id = s.id ORDER BY id DESC LIMIT 1), 0)
              <> COALESCE((SELECT SUM(nilai) FROM transaksi WHERE siswa_id = s.id), 0)`
        )
        .get() as { n: number };
      if (selisih.n > 0) {
        return 'Saldo di cadangan ini tidak cocok dengan riwayat transaksinya, sehingga tidak dipulihkan.';
      }
      return null;
    } catch {
      return 'Berkas ini bukan cadangan Pundi yang valid.';
    } finally {
      try {
        cand?.close();
      } catch {
        // abaikan
      }
    }
  }

  private jenisDariNama(nama: string): JenisCadangan {
    if (nama.startsWith('pundi_otomatis_')) return 'otomatis';
    if (nama.startsWith('pundi_pre-restore_')) return 'pre-restore';
    return 'manual';
  }

  private hapusSisaWal(dbPath: string): void {
    for (const sfx of ['-wal', '-shm']) {
      fs.rmSync(dbPath + sfx, { force: true });
    }
  }

  private hapusBerkasDb(dbPath: string): void {
    fs.rmSync(dbPath, { force: true });
    this.hapusSisaWal(dbPath);
  }

  private bersihkanCadanganOtomatis(): void {
    pangkasCadanganOtomatis(this.baseDir, BATAS_CADANGAN_OTOMATIS);
  }
}
