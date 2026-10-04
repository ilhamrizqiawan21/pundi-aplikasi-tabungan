import { test, expect } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { buildSync } from 'esbuild';
import { jalankanApp, type AppSesi } from './launch';

// Pelindung regresi: preload gagal dimuat membuat window.pundi hilang dan hampir semua layar crash.
const MENU: Array<{ label: string; judul: string }> = [
  { label: 'Beranda', judul: 'Beranda (Kas Harian)' },
  { label: 'Catat Transaksi', judul: 'Catat Transaksi' },
  { label: 'Siswa', judul: 'Data Siswa & Buku Besar' },
  { label: 'Laporan', judul: 'Laporan Tabungan' },
  { label: 'Tahun Ajaran & Kelas', judul: 'Tahun Ajaran & Kelas' },
  { label: 'Kenaikan Kelas', judul: 'Kenaikan Kelas & Kelulusan' },
  { label: 'Impor Data', judul: 'Impor Data Excel / CSV' },
  { label: 'Cadangan', judul: 'Cadangan & Pemulihan' },
  { label: 'Pengaturan', judul: 'Pengaturan Aplikasi' },
];

test.describe('jendela aplikasi', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  test('semua menu terbuka tanpa galat', async () => {
    expect(await s.page.evaluate(() => typeof window.pundi)).toBe('object');
    for (const { label, judul } of MENU) {
      await s.page.locator('nav').getByRole('button', { name: label }).click();
      await expect(s.page.getByRole('heading', { name: judul, level: 2 })).toBeVisible();
    }
    expect(s.galat).toEqual([]);
  });

  test('renderer tersandbox dan tidak bisa membuka jendela atau berpindah ke situs lain', async () => {
    const hasil = await s.page.evaluate(() => ({
      require: typeof (globalThis as Record<string, unknown>).require,
      process: typeof (globalThis as Record<string, unknown>).process,
      jendelaBaru: window.open('https://example.com') === null,
    }));
    expect(hasil).toEqual({ require: 'undefined', process: 'undefined', jendelaBaru: true });

    const awal = s.page.url();
    await s.page.evaluate(() => {
      window.location.href = 'https://example.com/';
    });
    await s.page.waitForTimeout(800);
    expect(s.page.url()).toBe(awal);
    expect(s.app.windows()).toHaveLength(1);
  });

  test('jendela cetak tidak memuat sumber luar (tanpa jaringan), sedangkan jendela biasa memuatnya', async () => {
    const dipanggil: string[] = [];
    const server = http.createServer((req, res) => {
      dipanggil.push(req.url ?? '');
      res.writeHead(200, { 'Content-Type': 'image/gif' });
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    // Kode asli printer.ts dibundel ke CJS sementara agar bisa di-require dari proses utama
    const keluar = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-printer-')), 'printer.cjs');
    buildSync({
      entryPoints: ['src/main/print/printer.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['electron'],
      outfile: keluar,
    });
    const modul = keluar;
    try {
      await s.app.evaluate(
        async ({ BrowserWindow }, arg) => {
          // Proses utama berupa ESM: require dibuat lewat modul bawaan
          const { createRequire } = process.getBuiltinModule('node:module');
          const { buatJendelaCetak } = createRequire(arg.modul)(arg.modul);
          const html = (nama: string) =>
            `data:text/html,${encodeURIComponent(`<img src="http://127.0.0.1:${arg.port}/${nama}"><link rel="stylesheet" href="http://127.0.0.1:${arg.port}/${nama}.css">`)}`;
          const cetak = buatJendelaCetak();
          await cetak.loadURL(html('cetak'));
          const biasa = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
          await biasa.loadURL(html('kontrol'));
          await new Promise((r) => setTimeout(r, 800));
          cetak.close();
          biasa.close();
        },
        { modul, port }
      );
    } finally {
      server.close();
      fs.rmSync(path.dirname(keluar), { recursive: true, force: true });
    }
    expect(dipanggil.some((u) => u.startsWith('/kontrol'))).toBe(true); // kontrol: jaringan memang bisa dijangkau
    expect(dipanggil.filter((u) => u.startsWith('/cetak'))).toEqual([]);
  });
});
