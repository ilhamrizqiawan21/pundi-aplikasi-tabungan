import { test, expect } from '@playwright/test';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { jalankanApp, type AppSesi } from './launch';

// CAP-04 dan CAP-14: impor siswa dan saldo awal. Berkas sintetis; dialog pilih berkas milik proses utama diganti.
test.describe.serial('impor siswa dan saldo awal', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      await window.pundi.tahunAjaranSimpan({ nama: '2026/2027', mulai: '2026-07-01', selesai: '2027-06-30', aktif: true });
    });
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  async function buatBerkas(nama: string, baris: unknown[][]): Promise<string> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Data');
    baris.forEach((b) => sheet.addRow(b));
    const jalur = path.join(s.dataDir, nama);
    await wb.xlsx.writeFile(jalur);
    return jalur;
  }
  async function pilihBerkasDialog(jalur: string) {
    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, jalur);
  }
  const bukaImpor = async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Impor Data' }).click();
  };
  const tombolPilih = () => s.page.getByRole('button', { name: /Pilih Berkas|Ganti Berkas/ });
  const terapkan = () => s.page.getByRole('button', { name: /Terapkan Impor/ });
  // Nama yang sama juga tampil di tabel contoh isi berkas, jadi baris pratinjau dibatasi ke bagiannya sendiri
  const barisPratinjau = (nama: RegExp) => s.page.getByRole('region', { name: /^Pratinjau/ }).getByRole('row', { name: nama });

  test('unduh format contoh menghasilkan berkas yang bisa langsung diimpor', async () => {
    const contoh = path.join(s.dataDir, 'format_contoh.xlsx');
    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, contoh);
    await bukaImpor();
    await s.page.getByRole('button', { name: 'Unduh Format Contoh' }).click();
    await expect(s.page.getByRole('status')).toContainText('format_contoh.xlsx');

    await pilihBerkasDialog(contoh);
    await tombolPilih().click();
    await expect(s.page.getByText('2 baris baik')).toBeVisible();
    await expect(s.page.getByLabel('Saldo', { exact: true })).toHaveText(/Saldo/);
    await s.page.getByRole('button', { name: 'Batal', exact: true }).click(); // tidak diterapkan; hanya memeriksa
  });

  test('baris bermasalah memblokir impor dan menjelaskan alasannya per baris', async () => {
    const f = await buatBerkas('masalah.xlsx', [
      ['No', 'Nama Siswa', 'NISN', 'Rombel', 'Saldo (Rp)'],
      [1, 'Ani Fiktif', '1001', '7A', 100000],
      [2, 'Budi Fiktif', '1002', '7A', '1.250,50'],
    ]);
    await pilihBerkasDialog(f);
    await bukaImpor();
    await tombolPilih().click();

    await expect(s.page.getByLabel('Nama siswa')).toHaveValue(/\d+/);
    await expect(s.page.getByText('1 bermasalah')).toBeVisible();
    await expect(barisPratinjau(/Budi Fiktif/)).toContainText('Saldo: Format nominal tidak dikenali');
    await expect(terapkan()).toBeDisabled();
  });

  test('berkas yang benar: pemetaan otomatis, pencocokan angka kontrol, lalu terapkan', async () => {
    const f = await buatBerkas('benar.xlsx', [
      ['No', 'Jenis Kelamin', 'Nama Ibu', 'Nama Siswa', 'NISN', 'Rombel', 'Saldo (Rp)'],
      [1, 'P', 'Ibu A', 'Ani Fiktif', '1001', '7A', 100000],
      [2, 'L', 'Ibu B', 'Budi Fiktif', '1002', '7A', 'Rp 40.000'],
      [3, 'P', 'Ibu C', 'Citra Fiktif', '1003', 'VIII B', null],
    ]);
    await pilihBerkasDialog(f);
    await tombolPilih().click();

    // Tidak tertipu "Jenis Kelamin" (bukan NIS) dan "Nama Ibu" (bukan nama siswa)
    await expect(s.page.getByLabel('Nama siswa')).toHaveText(/Nama Siswa/);
    await expect(s.page.getByLabel('NIS', { exact: true })).toHaveText(/NISN/);
    await expect(s.page.getByText('3 baris baik')).toBeVisible();
    await expect(s.page.getByText(/2 kelas belum ada dan akan dibuat otomatis/)).toBeVisible();
    await expect(terapkan()).toBeEnabled();

    // Angka kontrol yang salah memblokir; yang benar meloloskan
    await s.page.getByLabel('Jumlah siswa di aplikasi lama').fill('4');
    await expect(s.page.getByText(/✗ Berbeda 1 siswa/)).toBeVisible();
    await expect(terapkan()).toBeDisabled();
    await s.page.getByLabel('Jumlah siswa di aplikasi lama').fill('3');
    await s.page.getByLabel('Total saldo di aplikasi lama').fill('Rp 139.999');
    await expect(s.page.getByText(/✗ Berbeda Rp 1/)).toBeVisible();
    await expect(terapkan()).toBeDisabled();
    await s.page.getByLabel('Total saldo di aplikasi lama').fill('Rp 140.000');
    await expect(s.page.getByText('✓ Jumlah siswa cocok')).toBeVisible();
    await expect(s.page.getByText('✓ Total saldo cocok')).toBeVisible();

    await s.page.getByLabel('Tanggal saldo awal').fill('2026-07-01');
    await terapkan().click();
    await expect(s.page.getByRole('status').filter({ hasText: 'berhasil diimpor' })).toContainText('3 siswa berhasil diimpor, 2 di antaranya dengan saldo awal (total Rp 140.000)');

    const hasil = await s.page.evaluate(async () => {
      const p = window.pundi;
      const siswa = await p.siswaCari('');
      const integritas = await p.integritasPeriksa();
      const kas = await p.laporanKasHarian('2026-07-01');
      const trx = await p.laporanTransaksi({ dari: '2026-07-01', sampai: '2026-07-01' });
      return {
        siswa: siswa.ok ? siswa.data.map((x) => [x.nama, x.nis, x.kelas_nama, x.saldo]).sort() : null,
        seimbang: integritas.ok ? integritas.data.apakah_seimbang : null,
        kas: kas.ok ? [kas.data.total_setoran, kas.data.jumlah_transaksi, kas.data.saldo_seluruh_siswa] : null,
        jenis: trx.ok ? trx.data.baris.map((b) => b.jenis) : null,
      };
    });
    expect(hasil.siswa).toEqual([
      ['Ani Fiktif', '1001', '7A', 100000],
      ['Budi Fiktif', '1002', '7A', 40000],
      ['Citra Fiktif', '1003', 'VIII B', 0],
    ]);
    expect(hasil.seimbang).toBe(true);
    expect(hasil.kas).toEqual([0, 0, 140000]); // saldo awal bukan setoran hari itu
    expect(hasil.jenis).toEqual(['saldo_awal', 'saldo_awal']);
  });

  test('mengimpor ulang berkas yang sama tidak menggandakan siswa', async () => {
    await pilihBerkasDialog(path.join(s.dataDir, 'benar.xlsx'));
    await tombolPilih().click();
    await expect(s.page.getByText('3 bermasalah')).toBeVisible();
    await expect(barisPratinjau(/Ani Fiktif/)).toContainText('sudah terdaftar');
    await expect(terapkan()).toBeDisabled();
  });

  test('judul tidak dikenali: kolom dipilih manual lalu berhasil diterapkan', async () => {
    const f = await buatBerkas('aneh.xlsx', [
      ['Kolom X', 'Kolom Y'],
      ['Dewi Fiktif', 25000],
    ]);
    await pilihBerkasDialog(f);
    await tombolPilih().click();

    await expect(s.page.getByText('Pilih kolom yang berisi nama siswa untuk melanjutkan.')).toBeVisible();
    await s.page.getByLabel('Nama siswa').selectOption({ label: 'Kolom X' });
    await s.page.getByLabel('Saldo', { exact: true }).selectOption({ label: 'Kolom Y' });
    await expect(s.page.getByText('1 baris baik')).toBeVisible();
    await terapkan().click();
    await expect(s.page.getByRole('status').filter({ hasText: 'berhasil diimpor' })).toContainText('1 siswa berhasil diimpor, 1 di antaranya dengan saldo awal');

    await s.page.locator('nav').getByRole('button', { name: 'Siswa' }).click();
    const baris = s.page.getByRole('row', { name: /Dewi Fiktif/ });
    await expect(baris).toContainText('Rp 25.000');
    expect(s.galat).toEqual([]);
  });
});
