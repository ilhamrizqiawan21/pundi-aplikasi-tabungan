import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jalankanApp, type AppSesi } from './launch';

test.describe.serial('logo sekolah (CAP-01)', () => {
  let s: AppSesi;
  let tmpDir: string;
  let logoPath: string;
  let svgPath: string;

  test.beforeAll(async () => {
    s = await jalankanApp();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-logo-'));
    logoPath = path.join(tmpDir, 'logo-sintetis.png');
    fs.writeFileSync(logoPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ6kAAAAASUVORK5CYII=', 'base64'));
    svgPath = path.join(tmpDir, 'bukan-logo.svg');
    fs.writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  });

  test.afterAll(async () => {
    await s.tutup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('logo dipilih melalui dialog main, tidak membocorkan jalur, dan masuk ke keluaran cetak', async () => {
    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, logoPath);
    await s.page.locator('nav').getByRole('button', { name: 'Pengaturan' }).click();
    await s.page.getByLabel('Nama Sekolah / Lembaga').fill('Sekolah Sintetis');
    await s.page.getByRole('button', { name: 'Simpan Pengaturan' }).click();
    await expect(s.page.getByRole('status')).toContainText('Pengaturan dan profil sekolah berhasil disimpan');
    const profilTersimpan = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(profilTersimpan).toMatchObject({ ok: true, data: { nama: 'Sekolah Sintetis' } });

    await s.page.getByRole('button', { name: 'Pilih Logo' }).click();
    await expect(s.page.getByRole('status')).toContainText('Logo sekolah diperbarui');

    const profil = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(profil).toMatchObject({ ok: true, data: { logo_tersedia: true } });
    expect(profil.ok && 'logo_rel_path' in profil.data).toBe(false);

    const cetak = await s.page.evaluate(() => window.pundi.cetakLaporanHtml({ jenis: 'rekapKelas' }));
    expect(cetak.ok && cetak.data.html).toContain('data:image/png;base64,');
    expect(cetak.ok && cetak.data.html).not.toContain(logoPath);

    await s.page.getByRole('button', { name: 'Hapus Logo' }).click();
    await expect(s.page.getByRole('status')).toContainText('Logo sekolah dihapus');
    const sesudah = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(sesudah).toMatchObject({ ok: true, data: { logo_tersedia: false } });

    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, svgPath);
    await s.page.getByRole('button', { name: 'Pilih Logo' }).click();
    await expect(s.page.getByRole('alert')).toContainText('Pilih gambar PNG atau JPEG yang valid');
    const tetapKosong = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(tetapKosong).toMatchObject({ ok: true, data: { logo_tersedia: false } });
  });
});
