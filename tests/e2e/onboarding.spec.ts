import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test.describe.serial('wizard onboarding instalasi baru (CAP-01, CAP-02 / F9-2)', () => {
  let s: AppSesi;
  const sharedDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-e2e-onboarding-shared-'));
  const skipDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-e2e-onboarding-skip-'));

  test.afterAll(async () => {
    if (s) await s.tutup();
    fs.rmSync(sharedDataDir, { recursive: true, force: true });
    fs.rmSync(skipDataDir, { recursive: true, force: true });
  });

  test('instalasi baru memunculkan wizard onboarding dan dapat diselesaikan penuh', async () => {
    // Jalankan dengan folder data sementara terisolasi
    s = await jalankanApp(sharedDataDir);

    const wizard = s.page.locator('.onboarding-wizard');
    await expect(wizard).toBeVisible();
    await expect(wizard).toContainText('1. Profil Sekolah');

    // 2. Isi Profil Sekolah
    await wizard.getByLabel('Nama Sekolah / Madrasah').fill('SMP Fiktif Teladan');
    await wizard.getByLabel('Kota / Kabupaten').fill('Bandung');
    await wizard.getByLabel('Alamat Singkat').fill('Jl. Pendidikan No. 12');
    await wizard.getByLabel('Nama Bendahara').fill('Ibu Siti Fiktif');
    await wizard.getByLabel('Nama Kepala Sekolah').fill('Bpk. Drs. H. Fiktif');

    // Klik Simpan & Lanjut
    await wizard.getByRole('button', { name: 'Simpan & Lanjut' }).click();

    // 3. Langkah 2: Tahun Ajaran
    await expect(wizard).toContainText('2. Tahun Ajaran');
    await wizard.getByLabel('Nama Tahun Ajaran').fill('2026/2027');
    await wizard.getByLabel('Tanggal Mulai').fill('2026-07-01');
    await wizard.getByLabel('Tanggal Selesai').fill('2027-06-30');

    // Klik Simpan & Lanjut ke Kelas
    await wizard.getByRole('button', { name: 'Simpan & Lanjut ke Kelas' }).click();

    // 4. Langkah 3: Data Kelas
    await expect(wizard).toContainText('3. Data Kelas');
    // Gunakan preset pembuatan kelas SMP/MTs (7A-7B, 8A-8B, 9A-9B)
    await wizard.getByRole('button', { name: /\+ Buat 7A-7B/i }).click();

    // Verifikasi badge kelas terdaftar
    await expect(wizard.getByText('Kelas 7A (Tingkat 7)')).toBeVisible();
    await expect(wizard.getByText('Kelas yang Terdaftar (6)')).toBeVisible();

    // Lanjut ke Siswa
    await wizard.getByRole('button', { name: 'Lanjut ke Siswa' }).click();

    // 5. Langkah 4: Selesai & Pilihan Aksi
    await expect(wizard).toContainText('Penyiapan Awal Selesai!');
    await wizard.getByRole('button', { name: 'Buka Beranda' }).click();

    // Wizard tertutup
    await expect(wizard).toBeHidden();

    // Verifikasi Profil Sekolah tampil di identitas header aplikasi
    await expect(s.page.locator('.header-sekolah-text')).toContainText('SMP Fiktif Teladan');

    // Verifikasi Tahun Ajaran tampil di bilah atas
    await expect(s.page.getByText('T.A. 2026/2027')).toBeVisible();

    // Verifikasi kelas sudah masuk di menu Akademik
    await s.page.locator('nav').getByRole('button', { name: 'Tahun Ajaran & Kelas' }).click();
    await expect(s.page.getByRole('row', { name: /^7A/ })).toBeVisible();
    await expect(s.page.getByRole('row', { name: /^9B/ })).toBeVisible();
  });

  test('setelah selesai, wizard onboarding tidak muncul lagi saat aplikasi dibuka ulang', async () => {
    // Tutup sesi pertama
    await s.tutup();

    // Buka kembali aplikasi dengan folder data pengguna yang sama
    s = await jalankanApp(sharedDataDir);

    // Wizard onboarding tidak boleh muncul lagi
    const wizard = s.page.locator('.onboarding-wizard');
    await expect(wizard).toBeHidden();

    // Nama sekolah tetap tersimpan
    await expect(s.page.locator('.header-sekolah-text')).toContainText('SMP Fiktif Teladan');
    await expect(s.page.getByText('T.A. 2026/2027')).toBeVisible();
  });

  test('tombol Lewati Semua menutup wizard dan menandai onboarding selesai', async () => {
    await s.tutup();

    // Buka dengan folder data bersih yang kedua
    s = await jalankanApp(skipDataDir);

    const wizard = s.page.locator('.onboarding-wizard');
    await expect(wizard).toBeVisible();

    // Klik tombol Lewati Semua di pojok kanan atas wizard
    await wizard.getByRole('button', { name: 'Lewati Semua' }).click();

    // Wizard langsung tertutup
    await expect(wizard).toBeHidden();

    // Buka ulang untuk membuktikan tidak muncul lagi
    await s.tutup();

    s = await jalankanApp(skipDataDir);
    await expect(s.page.locator('.onboarding-wizard')).toBeHidden();
  });
});
