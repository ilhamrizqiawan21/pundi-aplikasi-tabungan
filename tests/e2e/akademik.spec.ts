import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// CAP-02: tahun ajaran dan kelas, mulai dari instalasi baru (belum ada tahun ajaran sama sekali).
test.describe.serial('tahun ajaran dan kelas', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();
  const baris = (nama: RegExp) => s.page.getByRole('row', { name: nama });

  test('instalasi baru menampilkan keadaan kosong yang menuntun', async () => {
    await menu('Tahun Ajaran & Kelas');
    await expect(s.page.getByText(/Belum ada tahun ajaran/)).toBeVisible();
    await expect(s.page.getByText(/T\.A\./)).toBeHidden();
  });

  test('membuat tahun ajaran pertama, otomatis aktif dan tampil di bilah atas', async () => {
    await s.page.getByRole('button', { name: /Tambah Tahun Ajaran/ }).click();
    await expect(s.page.getByLabel('Nama Tahun Ajaran')).toHaveValue(/^\d{4}\/\d{4}$/);
    const aktif = s.page.getByLabel('Jadikan tahun ajaran aktif');
    await expect(aktif).toBeChecked();
    await expect(aktif).toBeDisabled();
    await s.page.getByLabel('Nama Tahun Ajaran').fill('2026/2027');
    await s.page.getByLabel('Mulai').fill('2026-07-01');
    await s.page.getByLabel('Selesai').fill('2027-06-30');
    await s.page.getByRole('button', { name: 'Simpan', exact: true }).click();

    await expect(baris(/2026\/2027/)).toContainText('Aktif');
    await expect(s.page.getByText('T.A. 2026/2027')).toBeVisible();
  });

  test('menambah kelas dan menolak nama kelas yang sama', async () => {
    await s.page.getByRole('button', { name: /Tambah Kelas/ }).click();
    await s.page.getByLabel('Nama Kelas').fill('7A');
    await s.page.getByLabel('Tingkat').fill('7');
    await s.page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(baris(/^7A/)).toContainText('7');

    await s.page.getByRole('button', { name: /Tambah Kelas/ }).click();
    await s.page.getByLabel('Nama Kelas').fill('7A');
    await s.page.getByLabel('Tingkat').fill('7');
    await s.page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(s.page.getByRole('alert')).toContainText('sudah ada');
    await s.page.getByRole('button', { name: 'Batal' }).click();
  });

  test('siswa ditempatkan di kelas dari tahun ajaran aktif; kelas berisi tidak bisa dihapus', async () => {
    await menu('Siswa');
    await s.page.getByRole('button', { name: /Tambah Siswa/ }).click();
    const form = s.page.locator('form').filter({ has: s.page.getByPlaceholder('Contoh: Ahmad Dahlan') });
    await form.getByPlaceholder('Contoh: Ahmad Dahlan').fill('Budi Santoso');
    await form.getByRole('combobox').first().selectOption({ index: 1 }); // 7A
    await form.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(baris(/Budi Santoso/)).toContainText('7A');

    await menu('Tahun Ajaran & Kelas');
    await expect(baris(/^7A/)).toContainText('1'); // jumlah siswa
    await s.page.getByRole('button', { name: 'Hapus kelas 7A' }).click();
    await expect(s.page.getByRole('status')).toContainText('masih berisi siswa');
    await expect(baris(/^7A/)).toBeVisible();
  });

  test('tahun ajaran baru: salin kelas, aktifkan; siswa lama belum punya kelas di tahun baru', async () => {
    await s.page.getByRole('button', { name: /Tambah Tahun Ajaran/ }).click();
    await expect(s.page.getByLabel('Nama Tahun Ajaran')).toHaveValue('2027/2028'); // melanjutkan tahun terakhir
    await s.page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(baris(/2027\/2028/)).toContainText('Tidak aktif');

    await s.page.getByRole('button', { name: '2027/2028', exact: true }).click(); // pilih untuk melihat kelasnya
    await s.page.getByRole('button', { name: /Salin Kelas dari Tahun Lain/ }).click();
    await s.page.getByRole('button', { name: 'Salin Kelas', exact: true }).click();
    await expect(s.page.getByRole('status')).toContainText('1 kelas disalin ke 2027/2028');
    await expect(baris(/^7A/)).toContainText('0'); // tanpa siswa

    await baris(/2027\/2028/).getByRole('button', { name: 'Jadikan Aktif' }).click();
    await expect(s.page.getByText(/Siswa belum memiliki kelas pada tahun ajaran ini/)).toBeVisible();
    await s.page.getByRole('button', { name: 'Jadikan Aktif', exact: true }).last().click();
    await expect(s.page.getByText('T.A. 2027/2028')).toBeVisible();
    await expect(baris(/2026\/2027/)).toContainText('Tidak aktif');

    // Data tahun lama tidak berubah: kelas 7A lama tetap berisi 1 siswa
    await s.page.getByRole('button', { name: '2026/2027', exact: true }).click();
    await expect(baris(/^7A/)).toContainText('1');

    // Di tahun baru, siswa belum punya kelas
    await menu('Siswa');
    await expect(baris(/Budi Santoso/)).not.toContainText('7A');
    expect(s.galat).toEqual([]);
  });
});
