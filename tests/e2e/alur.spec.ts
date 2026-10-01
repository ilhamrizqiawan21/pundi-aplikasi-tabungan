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

// Pintasan keyboard (DESIGN §6, NFR-08)
test.describe('pintasan keyboard', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      await window.pundi.siswaSimpan({ nama: 'Ahmad Fiktif', status: 'aktif' });
    });
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const nav = () => s.page.locator('nav');
  const judul = () => s.page.getByRole('main').getByRole('heading', { level: 2 });
  const URUTAN = [
    'Beranda (Kas Harian)',
    'Catat Transaksi',
    'Data Siswa & Buku Besar',
    'Laporan Tabungan',
    'Tahun Ajaran & Kelas',
    'Kenaikan Kelas & Kelulusan',
    'Impor Data Excel / CSV',
    'Cadangan & Pemulihan',
    'Pengaturan Aplikasi',
  ];

  test('label pintasan di menu sesuai kenyataan: Alt+1..9 dan Ctrl+K untuk Catat Transaksi', async () => {
    const tombol = nav().getByRole('button');
    await expect(tombol).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
      await expect(tombol.nth(i)).toContainText(i === 1 ? 'Ctrl+K' : `Alt+${i + 1}`);
    }
  });

  test('Alt+1 sampai Alt+9 membuka menu sesuai urutan, dari layar mana pun', async () => {
    for (const n of [9, 5, 1, 4, 7, 3, 8, 6, 2]) {
      await s.page.keyboard.press(`Alt+${n}`);
      await expect(judul()).toHaveText(URUTAN[n - 1]);
      await expect(nav().getByRole('button').nth(n - 1)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('Ctrl+K dari layar lain membuka Catat Transaksi dan memfokuskan pencarian', async () => {
    await s.page.keyboard.press('Alt+1');
    await expect(judul()).toHaveText(URUTAN[0]);
    await s.page.keyboard.press('Control+k');
    await expect(judul()).toHaveText('Catat Transaksi');
    await expect(s.page.getByPlaceholder(/Ketik nama siswa/)).toBeFocused();
  });

  test('Esc membatalkan selangkah: dari kartu siswa ke pencarian, lalu mengosongkan pencarian', async () => {
    const cari = s.page.getByPlaceholder(/Ketik nama siswa/);
    await s.page.keyboard.type('Ahmad');
    await expect(s.page.getByText(/T-000001/)).toBeVisible();
    await s.page.keyboard.press('Enter');
    await expect(s.page.getByPlaceholder('Rp 0')).toBeFocused();

    await s.page.keyboard.press('Escape');
    await expect(s.page.getByText('Belum ada siswa yang dipilih')).toBeVisible();
    await expect(cari).toBeFocused();

    await s.page.keyboard.type('zzz');
    await expect(cari).toHaveValue('zzz');
    await s.page.keyboard.press('Escape');
    await expect(cari).toHaveValue('');
  });

  test('saat dialog terbuka, pintasan layar tidak aktif dan Esc menutup dialog', async () => {
    await s.page.keyboard.press('Alt+5');
    await expect(judul()).toHaveText('Tahun Ajaran & Kelas');
    await s.page.getByRole('button', { name: /Tambah Tahun Ajaran/ }).click();
    const dialog = s.page.getByRole('dialog', { name: 'Tambah Tahun Ajaran' });
    await expect(dialog).toBeVisible();

    await s.page.keyboard.press('Alt+1');
    await s.page.keyboard.press('Control+k');
    await expect(judul()).toHaveText('Tahun Ajaran & Kelas');
    await expect(dialog).toBeVisible();

    await s.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('fokus keyboard selalu terlihat', async () => {
    await s.page.keyboard.press('Alt+8');
    await s.page.keyboard.press('Tab');
    const gaya = await s.page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const g = getComputedStyle(el);
      return { tag: el.tagName, gaya: g.outlineStyle, lebar: g.outlineWidth };
    });
    expect(gaya.tag).not.toBe('BODY');
    expect(gaya.gaya).not.toBe('none');
    expect(gaya.lebar).toBe('2px');
  });
});
