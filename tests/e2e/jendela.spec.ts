import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// Pelindung regresi: preload gagal dimuat membuat window.pundi hilang dan hampir semua layar crash.
const MENU: Array<{ label: string; judul: string }> = [
  { label: 'Beranda', judul: 'Beranda (Kas Harian)' },
  { label: 'Catat Transaksi', judul: 'Catat Transaksi' },
  { label: 'Siswa', judul: 'Data Siswa & Buku Besar' },
  { label: 'Laporan', judul: 'Laporan Tabungan' },
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
});
