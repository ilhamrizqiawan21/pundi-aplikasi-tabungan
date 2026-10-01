import { test, expect } from '@playwright/test';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { jalankanApp, type AppSesi } from './launch';

// Alur utama pengguna (ARCHITECTURE §uji alur): siswa, setor, tarik, koreksi, laporan, backup, restore.
// Data sepenuhnya sintetis, pada folder data sementara.
test.describe.serial('alur utama', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();
  const riwayat = () =>
    s.page.evaluate(async () => {
      const r = await window.pundi.transaksiRiwayat({ siswa_id: 1, limit: 100 });
      return r.ok ? r.data.map((t) => ({ jenis: t.jenis, nilai: t.nilai, saldo: t.saldo_setelah })) : null;
    });

  /** Memilih siswa lewat pencarian lalu mengisi nominal, semuanya dengan keyboard. */
  async function catat(jenis: 'setoran' | 'penarikan', digit: string) {
    await s.page.keyboard.press('Control+k');
    await s.page.keyboard.type('Ahmad');
    await expect(s.page.getByText(/T-000001/)).toBeVisible();
    await s.page.keyboard.press('Enter');
    // Operator menunggu kartu siswa muncul; fokus pindah ke nominal setelah itu
    await expect(s.page.getByPlaceholder('Rp 0')).toBeFocused();
    if (jenis === 'penarikan') await s.page.keyboard.press('t');
    await s.page.keyboard.type(digit);
    await s.page.keyboard.press('Enter');
  }

  test('menambah siswa', async () => {
    await menu('Siswa');
    await s.page.getByRole('button', { name: /Tambah Siswa/ }).click();
    await s.page.getByPlaceholder('Contoh: Ahmad Dahlan').fill('Ahmad Dahlan');
    await s.page.getByRole('button', { name: 'Simpan', exact: true }).click();
    const baris = s.page.getByRole('row', { name: /Ahmad Dahlan/ });
    await expect(baris).toBeVisible();
    await expect(baris).toContainText('T-000001');
  });

  test('setoran dan penarikan tanpa mouse', async () => {
    await menu('Catat Transaksi');
    await catat('setoran', '100000');
    await expect(s.page.getByText(/Setoran Rp 100\.000 untuk Ahmad Dahlan berhasil tersimpan/)).toBeVisible();
    await expect(s.page.getByText(/Saldo baru:/)).toContainText('Rp 100.000');

    await catat('penarikan', '30000');
    await expect(s.page.getByText(/Penarikan Rp 30\.000 untuk Ahmad Dahlan berhasil tersimpan/)).toBeVisible();
    await expect(s.page.getByText(/Saldo baru:/)).toContainText('Rp 70.000');
  });

  test('menolak penarikan melebihi saldo', async () => {
    await catat('penarikan', '999999');
    await expect(s.page.getByText(/Saldo tidak cukup/)).toBeVisible();
    expect(await riwayat()).toHaveLength(2);
  });

  test('koreksi membuat transaksi pembalik, bukan menghapus; jenis kembali ke Setoran setelah penarikan', async () => {
    await s.page.keyboard.press('Escape'); // keluar dari kartu siswa bila terbuka
    await s.page.getByRole('button', { name: 'Ganti Siswa (Esc)' }).click().catch(() => undefined);
    await catat('setoran', '5000');
    await expect(s.page.getByText(/Setoran Rp 5\.000/)).toBeVisible();
    await s.page.getByRole('button', { name: /Batalkan \(Koreksi\)/ }).click();
    await expect(s.page.getByText(/Setoran Rp 5\.000/)).toBeHidden();

    const baris = await riwayat();
    expect(baris?.map((b) => b.jenis)).toEqual(expect.arrayContaining(['setoran', 'penarikan', 'pembalik']));
    expect(baris).toHaveLength(4);
    const saldo = await s.page.evaluate(async () => {
      const r = await window.pundi.integritasPeriksa();
      return r.ok ? r.data.apakah_seimbang : null;
    });
    expect(saldo).toBe(true);
  });

  test('laporan memuat siswa dengan saldo akhir', async () => {
    await menu('Laporan');
    // Rekap per Kelas kosong sampai ada UI tahun ajaran/kelas (CAP-02); rekap per siswa tetap berlaku
    await s.page.getByRole('button', { name: 'Rekap per Siswa' }).click();
    const baris = s.page.getByRole('row', { name: /Ahmad Dahlan/ });
    await expect(baris).toBeVisible();
    await expect(baris).toContainText('Rp 70.000');
  });

  test('laporan transaksi hari ini: total selaras dengan saldo, dan ekspor Excel terbaca', async () => {
    await menu('Laporan');
    await s.page.getByRole('main').getByRole('button', { name: 'Transaksi', exact: true }).click();
    await expect(s.page.getByText('4 transaksi')).toBeVisible(); // setoran, penarikan, setoran, pembalik
    const kartu = (judul: string) => s.page.getByText(judul, { exact: true }).locator('xpath=..');
    await expect(kartu('Total masuk')).toContainText('Rp 105.000');
    await expect(kartu('Total keluar')).toContainText('Rp 35.000');
    await expect(kartu('Selisih bersih')).toContainText('Rp 70.000');
    await expect(s.page.getByRole('row', { name: /Koreksi/ })).toContainText('-Rp 5.000');

    // Dialog simpan milik proses utama ditimpa agar tidak perlu klik dialog sistem
    const target = path.join(s.dataDir, 'laporan.xlsx');
    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, target);
    await s.page.getByRole('button', { name: 'Ekspor Excel' }).click();
    await expect(s.page.getByRole('status')).toContainText('laporan.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(target);
    const sheet = wb.getWorksheet('Transaksi')!;
    expect([2, 3, 4, 5].map((i) => sheet.getRow(i).getCell(7).value)).toEqual([100000, -30000, 5000, -5000]);
  });

  test('cadangkan lalu pulihkan mengembalikan data ke saat cadangan', async () => {
    await menu('Cadangan');
    await s.page.getByRole('button', { name: 'Cadangkan Sekarang' }).click();
    await expect(s.page.getByText(/Cadangan berhasil dibuat/)).toBeVisible();

    // Ubah data setelah cadangan
    await s.page.evaluate(async () => {
      await window.pundi.transaksiSetor({ siswa_id: 1, nominal: 7000 });
    });
    expect(await riwayat()).toHaveLength(5);

    await s.page.getByRole('button', { name: 'Segarkan' }).click();
    const muatUlang = s.page.waitForEvent('load');
    await s.page.getByRole('button', { name: /Pulihkan dari pundi_manual/ }).click();
    await expect(s.page.getByText(/Data yang ada sekarang akan diganti/)).toBeVisible();
    await s.page.getByRole('button', { name: 'Pulihkan Sekarang' }).click();
    await muatUlang;

    const baris = await riwayat();
    expect(baris).toHaveLength(4);
    expect(baris?.[0].saldo).toBe(70000);
    await menu('Cadangan');
    await expect(s.page.getByText('Pengaman sebelum pemulihan')).toBeVisible();
    expect(s.galat).toEqual([]);
  });
});

// Teks di layar menjanjikan pintasan ini, tetapi belum ada handlernya. Aktifkan setelah dibuat.
test.describe('pintasan yang dijanjikan layar', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  test.fixme('Alt+1 membuka Beranda (label menu "Alt+1")', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Pengaturan' }).click();
    await s.page.keyboard.press('Alt+1');
    await expect(s.page.getByRole('heading', { name: 'Beranda (Kas Harian)', level: 2 })).toBeVisible();
  });

  test.fixme('Ctrl+K dari layar mana pun membuka Catat Transaksi (label menu "Ctrl+K")', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Beranda' }).click();
    await s.page.keyboard.press('Control+k');
    await expect(s.page.getByRole('heading', { name: 'Catat Transaksi', level: 2 })).toBeVisible();
  });

  test.fixme('Esc pada form transaksi kembali ke pencarian (tombol "Ganti Siswa (Esc)")', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Catat Transaksi' }).click();
    await s.page.keyboard.type('a');
    await s.page.keyboard.press('Escape');
    await expect(s.page.getByPlaceholder(/Ketik nama siswa/)).toBeFocused();
  });
});
