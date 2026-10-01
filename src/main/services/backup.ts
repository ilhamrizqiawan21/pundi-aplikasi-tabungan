import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import type { Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

export class BackupService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'backups');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public buat(keterangan?: string): Result<{ berkas: string; ukuran_bytes: number }> {
    const db = getDb();
    try {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const suffix = keterangan ? `_${keterangan.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const filename = `pundi_backup_${timestamp}${suffix}.sqlite`;
      const targetPath = path.join(this.baseDir, filename);

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

      // Bersihkan cadangan otomatis berlebih (simpan 7 terakhir)
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

  public daftar(): Result<Array<{ nama: string; jalur: string; ukuran: number; tanggal: string }>> {
    try {
      if (!fs.existsSync(this.baseDir)) {
        return { ok: true, data: [] };
      }

      const files = fs
        .readdirSync(this.baseDir)
        .filter((f) => f.endsWith('.sqlite'))
        .map((f) => {
          const fullPath = path.join(this.baseDir, f);
          const stat = fs.statSync(fullPath);
          return {
            nama: f,
            jalur: fullPath,
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

  private bersihkanCadanganOtomatis(): void {
    try {
      const files = fs
        .readdirSync(this.baseDir)
        .filter((f) => f.startsWith('pundi_backup_') && f.endsWith('.sqlite'))
        .map((f) => {
          const fullPath = path.join(this.baseDir, f);
          return { name: f, path: fullPath, time: fs.statSync(fullPath).mtimeMs };
        })
        .sort((a, b) => b.time - a.time);

      // Jika lebih dari 7, hapus yang tertua
      if (files.length > 7) {
        const toDelete = files.slice(7);
        for (const f of toDelete) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            // Abaikan kesalahan penghapusan file lama
          }
        }
      }
    } catch {
      // Abaikan jika folder belum ada
    }
  }
}
