import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// F9-3: layar Bantuan dan Tentang (tanpa jaringan), dibuka lewat tombol bilah atas atau F1
test.describe.serial('layar Bantuan dan Tentang (F9-3)', () => {
  let s: AppSesi;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-e2e-bantuan-'));
  const versi = (JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { version: string })
    .version;

  test.beforeAll(async () => {
    s = await jalankanApp(dataDir);
  });

  test.afterAll(async () => {
    if (s) await s.tutup();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test('tombol Bantuan di bilah atas membuka panduan, pintasan, dan versi dari package.json', async () => {
    await s.page.getByRole('button', { name: 'Bantuan' }).click();
    const main = s.page.getByRole('main');
    await expect(main.getByRole('heading', { level: 2, name: 'Bantuan' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Panduan singkat' })).toBeVisible();
    await expect(main.getByText('Mencatat setoran atau penarikan')).toBeVisible();
    await expect(main.getByRole('row', { name: /Ctrl \+ K/ })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Tentang Pundi' })).toBeVisible();
    await expect(main.getByText(versi, { exact: true })).toBeVisible();
  });

  test('F1 membuka Bantuan dari layar lain; menu utama tetap sembilan', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Siswa' }).click();
    await expect(s.page.getByRole('main').getByRole('heading', { level: 2 })).toContainText('Data Siswa');
    await s.page.keyboard.press('F1');
    await expect(s.page.getByRole('main').getByRole('heading', { level: 2, name: 'Bantuan' })).toBeVisible();
    await expect(s.page.locator('nav').getByRole('button')).toHaveCount(9);
  });

  test('panduan dapat dibuka dengan keyboard', async () => {
    const ringkasan = s.page.getByText('Membatalkan transaksi yang salah');
    await ringkasan.focus();
    await s.page.keyboard.press('Enter');
    await expect(s.page.getByText(/transaksi pembalik/)).toBeVisible();
  });
});
