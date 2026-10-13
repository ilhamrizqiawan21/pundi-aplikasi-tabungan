import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Bilah samping putih yang dapat dibuka-tutup, dengan menu dikelompokkan berwarna (urutan Alt+1..9 tetap)
test.describe.serial('bilah samping dapat dibuka-tutup', () => {
  let s: AppSesi;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-e2e-bilah-'));

  test.beforeAll(async () => {
    s = await jalankanApp(dataDir);
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1366, 768));
  });

  test.afterAll(async () => {
    if (s) await s.tutup();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const lebar = () => s.page.locator('aside').evaluate((e) => e.getBoundingClientRect().width);
  const toggle = () => s.page.getByRole('button', { name: /bilah samping/ });

  test('terbentang 240 px, berlatar putih, menu terkelompok tanpa mengubah jumlah tombol menu', async () => {
    await expect.poll(lebar).toBe(240);
    await expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    await expect(s.page.locator('nav').getByRole('button')).toHaveCount(9);
    await expect(s.page.locator('nav').getByRole('group')).toHaveCount(3);
    const latar = await s.page.locator('aside').evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(latar).toBe('rgb(255, 255, 255)');
  });

  test('tombol menciutkan menjadi rel ikon dan membentangkan kembali; nama menu tetap ada untuk pembaca layar', async () => {
    await toggle().click();
    await expect.poll(lebar).toBe(76);
    await expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle()).toHaveAccessibleName('Bentangkan bilah samping');
    await expect(s.page.locator('nav').getByRole('button', { name: 'Catat Transaksi' })).toBeVisible();
    await toggle().click();
    await expect.poll(lebar).toBe(240);
  });

  test('Ctrl+B mengubah bilah, pilihan diingat saat aplikasi dibuka ulang, menu tetap berfungsi', async () => {
    await s.page.keyboard.press('Control+b');
    await expect.poll(lebar).toBe(76);
    await s.page.locator('nav').getByRole('button', { name: 'Siswa' }).click();
    await expect(s.page.getByRole('main').getByRole('heading', { level: 2 })).toContainText('Data Siswa');
    await s.page.reload();
    await expect.poll(lebar).toBe(76);
    await s.page.keyboard.press('Control+b');
    await expect.poll(lebar).toBe(240);
  });

  test('di bawah 1100 px selalu rel ikon dan tombol ciutkan disembunyikan', async () => {
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 700));
    await expect.poll(lebar).toBe(76);
    await expect(toggle()).toHaveCount(0);
  });
});
