import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FileLogger, sanitasiPesan, pasangPenanganCrash } from './logger.js';

describe('FileLogger (NFR-02 & F7-2)', () => {
  let tempDir: string;
  let logger: FileLogger;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-logger-test-'));
    logger = new FileLogger({ logsDir: tempDir, retensiHari: 7, maxSizeBytes: 1024 });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('membuat direktori logs jika belum ada dan menulis entri log', () => {
    const logsSubdir = path.join(tempDir, 'sub', 'logs');
    const customLogger = new FileLogger({ logsDir: logsSubdir });

    customLogger.info('BOOTSTRAP', { durasi_ms: 45, keterangan: 'Aplikasi dimulai' });

    expect(fs.existsSync(logsSubdir)).toBe(true);
    const files = fs.readdirSync(logsSubdir);
    expect(files.length).toBe(1);

    const content = fs.readFileSync(path.join(logsSubdir, files[0]), 'utf8');
    expect(content).toContain('[INFO]');
    expect(content).toContain('kode=BOOTSTRAP');
    expect(content).toContain('durasi_ms=45');
    expect(content).toContain('Aplikasi dimulai');
  });

  it('menolak atau membersihkan data sensitif (nama, nomor rekening, nominal rupiah)', () => {
    const pesanRaw = 'Gagal transfer Rp 500.000 untuk siswa Ahmad Dahlan NIS 12345 di C:\\Users\\secret\\pundi.sqlite';
    const disanitasi = sanitasiPesan(pesanRaw);

    expect(disanitasi).not.toContain('Ahmad Dahlan');
    expect(disanitasi).not.toContain('500.000');
    expect(disanitasi).not.toContain('12345');
    expect(disanitasi).not.toContain('C:\\Users\\secret');

    logger.error('DB_ERROR', {
      kode: 'DB_ERROR',
      durasi_ms: 120,
      jumlah: 3,
      keterangan: pesanRaw,
    });

    const files = fs.readdirSync(tempDir);
    const content = fs.readFileSync(path.join(tempDir, files[0]), 'utf8');
    expect(content).toContain('kode=DB_ERROR');
    expect(content).toContain('durasi_ms=120');
    expect(content).toContain('jumlah=3');
    expect(content).not.toContain('Ahmad Dahlan');
    expect(content).not.toContain('500.000');
  });

  it('melakukan rotasi berkas saat ukuran melampaui batas maksimum', () => {
    // maxSizeBytes diatur 1024 bytes pada setup
    for (let i = 0; i < 30; i++) {
      logger.info('TEST_LOOP', { kode: 'TEST_LOOP', durasi_ms: i, keterangan: `Iterasi ke-${i}` });
    }

    const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.log'));
    // Harus ada lebih dari 1 berkas log karena rotasi ukuran
    expect(files.length).toBeGreaterThan(1);
  });

  it('menjaga retensi berkas agar tidak melebihi batas yang ditentukan', () => {
    // Buat 10 berkas log simulasi tanggal lampau
    for (let i = 10; i >= 1; i--) {
      const nama = `pundi-2026-10-${i.toString().padStart(2, '0')}.log`;
      fs.writeFileSync(path.join(tempDir, nama), `dummy log ${i}\n`);
    }

    // Panggil rotasi/pembersihan dengan retensi 7
    logger.bersihkanBerkasLama();

    const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.log'));
    expect(files.length).toBeLessThanOrEqual(7);
  });
});

describe('Penangan Crash (F7-2)', () => {
  it('menangani uncaughtException: mencatat ke logger dan menampilkan dialog ramah', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-crash-test-'));
    try {
      const logger = new FileLogger({ logsDir: tempDir });
      let dialogDipanggil = false;
      let appQuitDipanggil = false;

      const copot = pasangPenanganCrash(logger, {
        tampilkanDialog: (judul, pesan) => {
          dialogDipanggil = true;
          expect(judul).toContain('Kendala');
          expect(pesan).toContain('kesalahan sistem');
        },
        keluarAplikasi: () => {
          appQuitDipanggil = true;
        },
      });

      // Simulasikan pemanggilan handler uncaughtException
      copot.pemicuUncaught(new Error('Simulasi fatal crash pada memory'));

      expect(dialogDipanggil).toBe(true);
      expect(appQuitDipanggil).toBe(true);

      const files = fs.readdirSync(tempDir);
      const content = fs.readFileSync(path.join(tempDir, files[0]), 'utf8');
      expect(content).toContain('[ERROR]');
      expect(content).toContain('UNCAUGHT_EXCEPTION');

      copot.lepas();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

