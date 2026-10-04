import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Result } from '../../shared/types.js';

/**
 * Jendela tersembunyi untuk cetak/PDF: tanpa JavaScript, tanpa preload, sesi terpisah (sementara),
 * dan semua permintaan selain `data:` dibatalkan, sehingga HTML tidak bisa memuat sumber luar (NFR-01, NFR-07).
 */
export function buatJendelaCetak(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      javascript: false,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: `cetak-${randomUUID()}`,
    },
  });
  win.webContents.session.webRequest.onBeforeRequest((detail, callback) => {
    let diizinkan: boolean;
    try {
      diizinkan = new URL(detail.url).protocol === 'data:';
    } catch {
      diizinkan = false;
    }
    callback({ cancel: !diizinkan });
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  return win;
}

/**
 * Mencetak dokumen HTML langsung melalui printer sistem menggunakan jendela tersembunyi.
 */
export async function printHtml(
  html: string,
  options?: { silent?: boolean; printerName?: string }
): Promise<Result<{ sukses: boolean }>> {
  let win: BrowserWindow | null = null;
  try {
    win = buatJendelaCetak();

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await win.loadURL(dataUrl);

    return new Promise((resolve) => {
      win!.webContents.print(
        {
          silent: options?.silent ?? false,
          printBackground: true,
          deviceName: options?.printerName,
        },
        (success, failureReason) => {
          try {
            win?.close();
            win = null;
          } catch {
            // abaikan
          }

          if (success) {
            resolve({ ok: true, data: { sukses: true } });
          } else {
            resolve({
              ok: false,
              kode: 'CETAK_GAGAL',
              pesan: failureReason ? `Gagal mencetak: ${failureReason}` : 'Pencetakan dibatalkan atau gagal.',
            });
          }
        }
      );
    });
  } catch {
    try {
      win?.close();
    } catch {
      // abaikan
    }
    return {
      ok: false,
      kode: 'CETAK_GAGAL',
      pesan: 'Terjadi kesalahan saat mencetak.',
    };
  }
}

/**
 * Mengekspor dokumen HTML ke berkas PDF menggunakan jendela tersembunyi dan dialog simpan.
 */
export async function savePdf(
  html: string,
  defaultFilename: string,
  options?: { landscape?: boolean; pageSize?: 'A4' | 'A5' | 'A6' }
): Promise<Result<{ nama_berkas: string } | null>> {
  const pilihan = await dialog.showSaveDialog({
    defaultPath: defaultFilename,
    filters: [{ name: 'Dokumen PDF', extensions: ['pdf'] }],
  });

  if (pilihan.canceled || !pilihan.filePath) {
    return { ok: true, data: null };
  }

  let win: BrowserWindow | null = null;
  try {
    win = buatJendelaCetak();

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await win.loadURL(dataUrl);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: options?.landscape ?? false,
      pageSize: options?.pageSize ?? 'A4',
      margins: {
        marginType: 'none',
      },
    });

    await fs.writeFile(pilihan.filePath, pdfBuffer);

    return {
      ok: true,
      data: {
        nama_berkas: path.basename(pilihan.filePath),
      },
    };
  } catch {
    return {
      ok: false,
      kode: 'CETAK_GAGAL',
      pesan: 'Gagal menyimpan berkas PDF.',
    };
  } finally {
    try {
      win?.close();
    } catch {
      // abaikan
    }
  }
}
