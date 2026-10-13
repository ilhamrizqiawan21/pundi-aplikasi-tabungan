import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';
import fs from 'node:fs';

import path from 'node:path';
import os from 'node:os';

// CAP-15 & F8-3: Lima tema aplikasi, bawaan putih, tersimpan lewat pengaturan dan bertahan saat dibuka ulang
test.describe.serial('tema aplikasi (CAP-15 / F8-3)', () => {
  let s: AppSesi;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-e2e-tema-'));

  test.beforeAll(async () => {
    s = await jalankanApp(dataDir);
  });

  test.afterAll(async () => {
    if (s) {
      await s.tutup();
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const ambilTemaSekarang = async () => {
    return s.page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  };

  test('tema bawaan instalasi baru adalah putih', async () => {
    const temaAwal = await ambilTemaSekarang();
    expect(temaAwal).toBe('putih');
  });

  test('mengganti tema lewat pengaturan mengubah atribut data-theme seketika', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Pengaturan' }).click();

    const selectTema = s.page.getByLabel('Tema Tampilan');
    await expect(selectTema).toBeVisible();

    // Uji berganti ke hijau
    await selectTema.selectOption('hijau');
    expect(await ambilTemaSekarang()).toBe('hijau');

    // Uji berganti ke biru
    await selectTema.selectOption('biru');
    expect(await ambilTemaSekarang()).toBe('biru');

    // Uji berganti ke ungu
    await selectTema.selectOption('ungu');
    expect(await ambilTemaSekarang()).toBe('ungu');

    // Uji berganti ke grafit (tema gelap)
    await selectTema.selectOption('grafit');
    expect(await ambilTemaSekarang()).toBe('grafit');

    // Klik tombol Simpan pengaturan dan tunggu konfirmasi sukses dari backend
    await s.page.getByRole('button', { name: 'Simpan pengaturan' }).click();
    await expect(s.page.getByText('Pengaturan dan profil sekolah berhasil disimpan.')).toBeVisible();

    const cekSimpan = await s.page.evaluate(async () => window.pundi.pengaturanBaca());
    expect(cekSimpan).toMatchObject({ ok: true, data: { tema: 'grafit' } });
  });

  test('tema tersimpan bertahan setelah aplikasi ditutup dan dibuka ulang', async () => {
    const savedDataDir = s.dataDir;
    // Tutup sesi pertama tanpa menghapus dataDir
    await s.tutup();

    // Buka sesi kedua dengan dataDir yang sama
    s = await jalankanApp(savedDataDir);

    const cekSesi2 = await s.page.evaluate(async () => window.pundi.pengaturanBaca());
    expect(cekSesi2).toMatchObject({ ok: true, data: { tema: 'grafit' } });

    // Verifikasi tema tetap 'grafit' setelah inisialisasi ulang
    await expect.poll(async () => ambilTemaSekarang()).toBe('grafit');
  });
});

