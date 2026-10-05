import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// CAP-16: kunci PIN 6 angka. Seluruh alur lewat UI; gerbang di proses utama diperiksa lewat window.pundi.
test.describe.serial('kunci PIN', () => {
  let s: AppSesi;
  let kodePemulihan = '';
  test.beforeAll(async () => {
    s = await jalankanApp();
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();
  const layarKunci = () => s.page.getByRole('main', { name: 'Kunci aplikasi' });

  test('tanpa PIN, aplikasi langsung terbuka dan tombol Kunci belum ada', async () => {
    await expect(s.page.locator('nav')).toBeVisible();
    await expect(s.page.getByRole('button', { name: 'Kunci', exact: true })).toHaveCount(0);
  });

  test('mengaktifkan PIN: PIN lemah ditolak, kode pemulihan wajib dikonfirmasi', async () => {
    await menu('Pengaturan');
    const panel = s.page.getByRole('region', { name: 'Keamanan: PIN aplikasi' });
    await panel.getByRole('button', { name: 'Aktifkan PIN' }).click();

    await panel.getByLabel('PIN baru', { exact: true }).fill('123456');
    await panel.getByLabel('Ulangi PIN baru').fill('123456');
    await panel.getByRole('button', { name: 'Aktifkan', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('terlalu mudah ditebak');

    await panel.getByLabel('PIN baru', { exact: true }).fill('482913');
    await panel.getByLabel('Ulangi PIN baru').fill('999999');
    await panel.getByRole('button', { name: 'Aktifkan', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('tidak sama');

    await panel.getByLabel('Ulangi PIN baru').fill('482913');
    await panel.getByRole('button', { name: 'Aktifkan', exact: true }).click();
    kodePemulihan = (await panel.getByLabel('Kode pemulihan', { exact: true }).textContent()) ?? '';
    expect(kodePemulihan).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);

    await expect(panel.getByRole('button', { name: 'Selesai' })).toBeDisabled();
    await panel.getByLabel('Saya sudah menyimpan kode pemulihan ini.').check();
    await panel.getByRole('button', { name: 'Selesai' }).click();
    await expect(panel.getByText('AKTIF', { exact: true })).toBeVisible();
    await expect(s.page.getByRole('button', { name: 'Kunci', exact: true })).toBeVisible();
  });

  test('kunci sekarang: hanya halaman PIN yang tampil dan data ditolak di proses utama', async () => {
    await s.page.getByRole('button', { name: 'Kunci', exact: true }).click();
    await expect(layarKunci()).toBeVisible();
    await expect(s.page.locator('nav')).toHaveCount(0); // menu tidak dimuat sama sekali

    const hasil = await s.page.evaluate(async () => {
      const p = window.pundi;
      const baca = await p.siswaCari('');
      const tulis = await p.siswaSimpan({ nama: 'Penyusup Fiktif', status: 'aktif' });
      return { baca, tulis };
    });
    expect(hasil.baca).toMatchObject({ ok: false, kode: 'TERKUNCI' });
    expect(hasil.tulis).toMatchObject({ ok: false, kode: 'TERKUNCI' });
  });

  test('PIN salah ditolak, PIN benar membuka dan data tidak ikut tertulis saat terkunci', async () => {
    await s.page.getByLabel(/Masukkan PIN/).fill('000001');
    await expect(s.page.getByRole('alert')).toContainText('PIN salah');
    await expect(layarKunci()).toBeVisible();

    await s.page.getByLabel(/Masukkan PIN/).fill('482913'); // terkirim otomatis pada angka ke-6
    await expect(s.page.locator('nav')).toBeVisible();
    const jumlah = await s.page.evaluate(async () => {
      const r = await window.pundi.siswaCari('');
      return r.ok ? r.data.length : -1;
    });
    expect(jumlah).toBe(0); // percobaan menyimpan saat terkunci tidak berhasil
  });

  test('lupa PIN: kode pemulihan menetapkan PIN baru, PIN lama berhenti berlaku', async () => {
    await s.page.getByRole('button', { name: 'Kunci', exact: true }).click();
    await s.page.getByRole('button', { name: 'Lupa PIN?' }).click();
    await s.page.getByLabel('Kode pemulihan', { exact: true }).fill(kodePemulihan.toLowerCase());
    await s.page.getByLabel('PIN baru', { exact: true }).fill('591827');
    await s.page.getByLabel('Ulangi PIN baru').fill('591827');
    await s.page.getByRole('button', { name: 'Pulihkan dan Masuk' }).click();

    const kodeBaru = (await s.page.getByLabel('Kode pemulihan', { exact: true }).textContent()) ?? '';
    expect(kodeBaru).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(kodeBaru).not.toBe(kodePemulihan);
    await s.page.getByLabel('Saya sudah menyimpan kode pemulihan ini.').check();
    await s.page.getByRole('button', { name: 'Selesai' }).click();
    await expect(s.page.locator('nav')).toBeVisible();

    await s.page.getByRole('button', { name: 'Kunci', exact: true }).click();
    await s.page.getByLabel(/Masukkan PIN/).fill('482913');
    await expect(s.page.getByRole('alert')).toContainText('PIN salah');
    await s.page.getByLabel(/Masukkan PIN/).fill('591827');
    await expect(s.page.locator('nav')).toBeVisible();
  });

  test('mematikan PIN perlu PIN yang benar', async () => {
    await menu('Pengaturan');
    const panel = s.page.getByRole('region', { name: 'Keamanan: PIN aplikasi' });
    await panel.getByRole('button', { name: 'Matikan PIN' }).click();
    await panel.getByLabel('Masukkan PIN untuk mematikan').fill('000001');
    await panel.getByRole('button', { name: 'Matikan PIN' }).last().click();
    await expect(panel.getByRole('alert')).toContainText('PIN salah');

    await panel.getByLabel('Masukkan PIN untuk mematikan').fill('591827');
    await panel.getByRole('button', { name: 'Matikan PIN' }).last().click();
    await expect(panel.getByText('TIDAK AKTIF', { exact: true })).toBeVisible();
    await expect(s.page.getByRole('button', { name: 'Kunci', exact: true })).toHaveCount(0);
  });
});
