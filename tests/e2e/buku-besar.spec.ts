import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// CAP-10 / F3-8 / F9-1: Buku besar per siswa, filter rentang tanggal, cetak/PDF, dan koreksi.
// Data sintetis pada folder data sementara.
test.describe.serial('buku besar per siswa (CAP-10 / F9-1)', () => {
  let s: AppSesi;

  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      const p = window.pundi;
      const ta = await p.tahunAjaranSimpan({
        nama: '2026/2027',
        mulai: '2026-07-01',
        selesai: '2027-06-30',
        aktif: true,
      });
      if (!ta.ok) throw new Error(ta.pesan);

      const k = await p.kelasSimpan({
        tahun_ajaran_id: ta.data.id,
        nama: '8B',
        tingkat: 8,
        urutan: 1,
      });
      if (!k.ok) throw new Error(k.pesan);

      const sw = await p.siswaSimpan({
        nama: 'Dewi Fiktif',
        nis: '8801',
        status: 'aktif',
        kelas_id: k.data.id,
      });
      if (!sw.ok) throw new Error(sw.pesan);

      // Catat 3 transaksi berbeda tanggal
      const t1 = await p.transaksiSetor({
        siswa_id: sw.data.id,
        nominal: 50000,
        tanggal: '2026-08-01',
        keterangan: 'Setoran tabungan awal Agustus',
      });
      if (!t1.ok) throw new Error(t1.pesan);

      const t2 = await p.transaksiSetor({
        siswa_id: sw.data.id,
        nominal: 75000,
        tanggal: '2026-08-15',
        keterangan: 'Setoran pertengahan Agustus',
      });
      if (!t2.ok) throw new Error(t2.pesan);

      const t3 = await p.transaksiTarik({
        siswa_id: sw.data.id,
        nominal: 20000,
        tanggal: '2026-09-01',
        keterangan: 'Penarikan awal September',
      });
      if (!t3.ok) throw new Error(t3.pesan);

      return sw.data.id;
    });
  });

  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();

  test('buku besar per siswa menampilkan riwayat kronologis dan saldo berjalan', async () => {
    await menu('Siswa');
    // Siswa terpilih otomatis atau klik siswa di daftar
    await s.page.locator('.siswa-table-wrapper').getByText('Dewi Fiktif').first().click();

    // Verifikasi saldo total pada kartu hero siswa
    await expect(s.page.locator('.siswa-hero').getByText('Rp 105.000')).toBeVisible();

    // Verifikasi transaksi buku besar
    const tabel = s.page.locator('.tabel-kartu');
    await expect(tabel).toContainText('Rp 50.000');
    await expect(tabel).toContainText('Rp 75.000');
    await expect(tabel).toContainText('Rp 20.000');
    // Saldo setelah mutasi terakhir
    await expect(tabel.getByText('Rp 105.000').first()).toBeVisible();
  });

  test('filter rentang tanggal menyaring transaksi buku besar dan dapat direset', async () => {
    await menu('Siswa');
    await s.page.locator('.siswa-table-wrapper').getByText('Dewi Fiktif').first().click();

    // Filter hanya transaksi tanggal 10 sampai 20 Agustus 2026
    const dariInput = s.page.locator('#buku-dari');
    const sampaiInput = s.page.locator('#buku-sampai');

    await dariInput.fill('2026-08-10');
    await sampaiInput.fill('2026-08-20');

    // Transaksi 15 Agustus (Rp 75.000) harus tetap terlihat
    const tabel = s.page.locator('.tabel-kartu');
    await expect(tabel).toContainText('Rp 75.000');

    // Transaksi 1 Agustus dan 1 September tidak boleh ada di tabel yang disaring
    await expect(tabel.getByText('Rp 50.000').first()).toBeHidden();
    await expect(tabel.getByText('Rp 20.000').first()).toBeHidden();

    // Reset filter
    await s.page.getByRole('button', { name: 'Reset Filter' }).click();

    // Seluruh transaksi muncul kembali
    await expect(tabel.getByText('Rp 50.000').first()).toBeVisible();
    await expect(tabel.getByText('Rp 75.000').first()).toBeVisible();
    await expect(tabel.getByText('Rp 20.000').first()).toBeVisible();
  });

  test('pratinjau cetak dan PDF buku besar membuka dialog dengan data buku besar', async () => {
    await menu('Siswa');
    await s.page.locator('.siswa-table-wrapper').getByText('Dewi Fiktif').first().click();

    // Klik tombol Cetak pada buku besar
    await s.page.getByRole('button', { name: 'Cetak' }).first().click();

    // Dialog Pratinjau Cetak terbuka
    const dialog = s.page.getByRole('dialog', { name: /Pratinjau Cetak/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Buku Besar - Dewi Fiktif');

    // Pastikan iframe pratinjau memuat konten
    const iframe = dialog.locator('iframe');
    await expect(iframe).toBeVisible();

    // Tutup dialog pratinjau
    await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test('koreksi transaksi langsung dari baris buku besar membalik nilai transaksi', async () => {
    await menu('Siswa');
    await s.page.locator('.siswa-table-wrapper').getByText('Dewi Fiktif').first().click();

    // Temukan tombol koreksi pada baris penarikan Rp 20.000
    const tombolKoreksi = s.page.getByRole('button', { name: 'Koreksi transaksi' }).first();
    await tombolKoreksi.click();

    const dialogKoreksi = s.page.getByRole('dialog', { name: /Koreksi Transaksi/ });
    await expect(dialogKoreksi).toBeVisible();

    const simpanBtn = dialogKoreksi.getByRole('button', { name: /Terapkan Koreksi/ });
    await expect(simpanBtn).toBeVisible();

    await dialogKoreksi.getByLabel(/Alasan Koreksi/i).fill('Koreksi penarikan salah hitung');
    await simpanBtn.click();
    await expect(dialogKoreksi).toBeHidden();

    // Saldo kembali pulih dari Rp 105.000 menjadi Rp 125.000 (penarikan Rp 20.000 dibalik)
    await expect(s.page.locator('.siswa-hero').getByText('Rp 125.000')).toBeVisible();
  });
});
