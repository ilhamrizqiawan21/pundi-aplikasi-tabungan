import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jalankanApp, type AppSesi } from './launch';

test.describe.serial('alur cadangan dari layar (CAP-13, CAP-21)', () => {
  let s: AppSesi;
  let tmpDir: string;
  let folderSalinan: string;

  test.beforeAll(async () => {
    s = await jalankanApp();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-cadangan-e2e-'));
    folderSalinan = path.join(tmpDir, 'salinan-luar');
    fs.mkdirSync(folderSalinan);
  });

  test.afterAll(async () => {
    await s.tutup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('membuat backup, menyalin berkas, lalu memulihkan dengan backup pengaman', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Cadangan' }).click();
    await s.page.getByRole('button', { name: 'Cadangkan Sekarang' }).click();
    await expect(s.page.getByRole('status')).toContainText('Cadangan berhasil dibuat');
    const manual = s.page.getByRole('row', { name: /Manual/ }).first();
    await expect(manual).toBeVisible();

    await s.app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    }, folderSalinan);
    await s.page.getByRole('button', { name: /Salin ke flashdisk/ }).click();
    await expect(s.page.getByRole('status')).toContainText('Salinan cadangan tersimpan');
    expect(fs.readdirSync(folderSalinan).some((nama) => nama.endsWith('.sqlite'))).toBe(true);

    const siswa = await s.page.evaluate(() => window.pundi.siswaSimpan({ nama: 'Siswa Setelah Cadangan', status: 'aktif' }));
    expect(siswa.ok).toBe(true);
    await s.page.getByRole('button', { name: /Pulihkan dari pundi_manual/ }).first().click();
    const dialogPulih = s.page.getByRole('dialog', { name: 'Pulihkan Data dari Cadangan' });
    await expect(dialogPulih.getByRole('alert')).toContainText('Data yang ada sekarang akan diganti');
    await dialogPulih.getByRole('button', { name: 'Pulihkan Sekarang' }).click();

    await expect(s.page.locator('nav')).toBeVisible({ timeout: 15000 });
    const siswaSesudah = await s.page.evaluate(() => window.pundi.siswaCari(''));
    expect(siswaSesudah).toMatchObject({ ok: true, data: [] });
    const daftar = fs.readdirSync(path.join(s.dataDir, 'Pundi', 'backups'));
    expect(daftar.some((nama) => nama.includes('pre-restore'))).toBe(true);
  });
});
