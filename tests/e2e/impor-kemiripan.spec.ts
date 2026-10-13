import { test, expect } from '@playwright/test';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { jalankanApp, type AppSesi } from './launch';

test.describe.serial('peringatan nama siswa mirip saat impor (BF-07)', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      const ta = await window.pundi.tahunAjaranSimpan({ nama: '2026/2027', mulai: '2026-07-01', selesai: '2027-06-30', aktif: true });
      if (!ta.ok) throw new Error(ta.pesan);
      const kelas = await window.pundi.kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
      if (!kelas.ok) throw new Error(kelas.pesan);
      const siswa = await window.pundi.siswaSimpan({ nama: 'Siti Aminah', nis: 'SINTETIS-1', status: 'aktif', kelas_id: kelas.data.id });
      if (!siswa.ok) throw new Error(siswa.pesan);
    });
  });
  test.afterAll(async () => s.tutup());

  test('memperingatkan nama mirip dalam kelas yang sama tanpa menggagalkan atau menerapkan penggabungan', async () => {
    const file = path.join(s.dataDir, 'nama-mirip.xlsx');
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Siswa');
    sheet.addRow(['Nama Siswa', 'NIS', 'Kelas']);
    sheet.addRow(['Siti Aminahh', 'SINTETIS-2', '7A']);
    await wb.xlsx.writeFile(file);
    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, file);

    await s.page.locator('nav').getByRole('button', { name: 'Impor Data' }).click();
    await s.page.getByRole('button', { name: /Pilih Berkas/ }).click();
    const preview = s.page.getByRole('region', { name: /^Pratinjau/ });
    await expect(preview.getByText('1 baris baik')).toBeVisible();
    await expect(preview.getByRole('row', { name: /Siti Aminahh/ })).toContainText('Nama mirip');
    await expect(s.page.getByRole('button', { name: /Terapkan Impor/ })).toBeEnabled();
  });
});
