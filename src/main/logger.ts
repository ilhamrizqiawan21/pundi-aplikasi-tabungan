import fs from 'node:fs';
import path from 'node:path';
import { dialog, app, type BrowserWindow } from 'electron';

export interface FileLoggerOptions {
  logsDir: string;
  retensiHari?: number;
  maxSizeBytes?: number;
}

export interface LogEntryInput {
  kode?: string;
  durasi_ms?: number;
  jumlah?: number;
  keterangan?: string;
}

/**
 * Sanitasi string agar tidak memuat data pribadi, nominal rupiah, nomor rekening, atau jalur sistem (NFR-02).
 */
export function sanitasiPesan(teks: string): string {
  if (!teks) return '';

  return (
    teks
      // Samarkan path absolut Windows (mis. C:\path\file)
      .replace(/[A-Za-z]:\\[^\s"',;)]+/g, '<path>')
      // Samarkan path absolut POSIX (mis. /home/user/path)
      .replace(/\/(?:[a-zA-Z0-9_\-.]+\/)+[a-zA-Z0-9_\-.]+/g, '<path>')
      // Samarkan format nominal rupiah (mis. Rp 500.000 atau Rp.10.000)
      .replace(/(?:Rp\.?\s*|\brp\s*)\d+(?:[.,]\d+)*/gi, '<nominal>')
      // Samarkan string seperti NIS, nomor rekening, atau deretan angka >= 4 digit
      .replace(/\b(?:NIS|rek|rekening|akun)\s*[:=]?\s*\w+/gi, '<nomor>')
      .replace(/\b\d{4,}\b/g, '<angka>')
      // Samarkan pola nama setelah frasa umum jika ada
      .replace(/(?:siswa|nama)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi, '<nama>')
  );
}

export class FileLogger {
  private readonly logsDir: string;
  private readonly retensiHari: number;
  private readonly maxSizeBytes: number;

  constructor(options: FileLoggerOptions) {
    this.logsDir = options.logsDir;
    this.retensiHari = options.retensiHari ?? 7;
    this.maxSizeBytes = options.maxSizeBytes ?? 2 * 1024 * 1024; // 2 MB
  }

  private pastikanFolder(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private formatTanggal(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const t = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${t}`;
  }

  private ambilBerkasAktif(): string {
    this.pastikanFolder();
    const tgl = this.formatTanggal(new Date());
    let namaBerkas = `pundi-${tgl}.log`;
    let target = path.join(this.logsDir, namaBerkas);

    let indeks = 1;
    while (fs.existsSync(target)) {
      try {
        const stats = fs.statSync(target);
        if (stats.size < this.maxSizeBytes) {
          return target;
        }
      } catch {
        break;
      }
      namaBerkas = `pundi-${tgl}.${indeks}.log`;
      target = path.join(this.logsDir, namaBerkas);
      indeks++;
    }

    return target;
  }

  public bersihkanBerkasLama(): void {
    try {
      this.pastikanFolder();
      const files = fs
        .readdirSync(this.logsDir)
        .filter((f) => f.startsWith('pundi-') && f.endsWith('.log'))
        .sort()
        .reverse(); // Terbaru ke terlama

      if (files.length > this.retensiHari) {
        const berkasDihapus = files.slice(this.retensiHari);
        for (const file of berkasDihapus) {
          try {
            fs.unlinkSync(path.join(this.logsDir, file));
          } catch {
            // Abaikan kegagalan penghapusan berkas usang
          }
        }
      }
    } catch {
      // Abaikan kegagalan pembersihan agar tidak mengganggu aplikasi
    }
  }

  public tulis(level: 'INFO' | 'WARN' | 'ERROR', kode: string, input?: LogEntryInput): void {
    try {
      const target = this.ambilBerkasAktif();
      const timestamp = new Date().toISOString();
      const durasiStr = input?.durasi_ms !== undefined ? ` durasi_ms=${input.durasi_ms}` : '';
      const jumlahStr = input?.jumlah !== undefined ? ` jumlah=${input.jumlah}` : '';
      const ketStr = input?.keterangan ? ` pesan="${sanitasiPesan(input.keterangan)}"` : '';

      const baris = `[${timestamp}] [${level}] kode=${kode}${durasiStr}${jumlahStr}${ketStr}\n`;
      fs.appendFileSync(target, baris, 'utf8');
      this.bersihkanBerkasLama();
    } catch {
      // Menulis log gagal tidak boleh memicu unhandled crash
    }
  }

  public info(kode: string, input?: LogEntryInput): void {
    this.tulis('INFO', kode, input);
  }

  public warn(kode: string, input?: LogEntryInput): void {
    this.tulis('WARN', kode, input);
  }

  public error(kode: string, input?: LogEntryInput): void {
    this.tulis('ERROR', kode, input);
  }
}

export interface CrashHandlerOptions {
  tampilkanDialog?: (judul: string, pesan: string) => void;
  keluarAplikasi?: () => void;
}

/**
 * Memasang penangan uncaughtException dan unhandledRejection di proses utama Electron (F7-2).
 */
export function pasangPenanganCrash(
  logger: FileLogger,
  opts?: CrashHandlerOptions
): { lepas: () => void; pemicuUncaught: (err: Error) => void } {
  const dialogFn =
    opts?.tampilkanDialog ??
    ((judul, pesan) => {
      dialog.showErrorBox(judul, pesan);
    });

  const exitFn =
    opts?.keluarAplikasi ??
    (() => {
      app.quit();
    });

  const uncaughtHandler = (err: Error) => {
    try {
      logger.error('UNCAUGHT_EXCEPTION', {
        keterangan: err?.name || 'Error',
      });
    } catch {
      // Log gagal
    }

    dialogFn(
      'Aplikasi Mengalami Kendala',
      'Terjadi kesalahan sistem yang tidak terduga. Aplikasi akan ditutup untuk menjaga keamanan data. Silakan buka kembali aplikasi.'
    );
    exitFn();
  };

  const unhandledHandler = (reason: unknown) => {
    try {
      const pesan = reason instanceof Error ? reason.name : 'Unknown';
      logger.error('UNHANDLED_REJECTION', {
        keterangan: pesan,
      });
    } catch {
      // Log gagal
    }
  };

  process.on('uncaughtException', uncaughtHandler);
  process.on('unhandledRejection', unhandledHandler);

  return {
    lepas: () => {
      process.off('uncaughtException', uncaughtHandler);
      process.off('unhandledRejection', unhandledHandler);
    },
    pemicuUncaught: uncaughtHandler,
  };
}

/**
 * Memasang penangan render-process-gone pada jendela BrowserWindow (F7-2).
 */
export function pasangPenanganRendererCrash(
  win: BrowserWindow,
  logger: FileLogger,
  opts?: { tampilkanDialog?: (judul: string, pesan: string) => void }
): void {
  const dialogFn =
    opts?.tampilkanDialog ??
    ((judul, pesan) => {
      dialog.showErrorBox(judul, pesan);
    });

  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('RENDER_PROCESS_GONE', {
      keterangan: details.reason,
    });

    dialogFn(
      'Tampilan Terhenti',
      `Proses tampilan aplikasi terhenti secara tidak terduga (${details.reason}). Silakan buka kembali aplikasi.`
    );
  });
}

