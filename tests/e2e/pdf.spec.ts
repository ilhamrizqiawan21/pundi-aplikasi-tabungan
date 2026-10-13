import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { jalankanApp, type AppSesi } from './launch';

test.describe.serial('PDF laporan panjang (S-03)', () => {
  let s: AppSesi;
  let targetDir: string;
  let targetPdf: string;
  let targetXlsx: string;
  let tahunAjaranId = 0;

  test.beforeAll(async () => {
    s = await jalankanApp();
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-pdf-'));
    targetPdf = path.join(targetDir, 'rekap-siswa.pdf');
    targetXlsx = path.join(targetDir, 'rekap-kelas.xlsx');
    await s.page.evaluate(async () => {
      const ta = await window.pundi.tahunAjaranSimpan({ nama: '2026/2027', mulai: '2026-07-01', selesai: '2027-06-30', aktif: true });
      if (!ta.ok) throw new Error(ta.pesan);
      const kelas = await window.pundi.kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
      if (!kelas.ok) throw new Error(kelas.pesan);
      let siswaPertama = 0;
      for (let i = 1; i <= 200; i++) {
        const siswa = await window.pundi.siswaSimpan({ nama: `Siswa Fiktif ${String(i).padStart(3, '0')}`, status: 'aktif', kelas_id: kelas.data.id });
        if (!siswa.ok) throw new Error(siswa.pesan);
        if (i === 1) siswaPertama = siswa.data.id;
      }
      const setoran = await window.pundi.transaksiSetor({ siswa_id: siswaPertama, nominal: 12000, tanggal: '2026-09-01' });
      if (!setoran.ok) throw new Error(setoran.pesan);
      return ta.data.id;
    }).then((id) => { tahunAjaranId = id; });
  });

  test.afterAll(async () => {
    await s.tutup();
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  test('rekap 200 siswa menghasilkan PDF multi-halaman dengan isi akhir dan total', async () => {
    const html = await s.page.evaluate(async (id) => {
      const res = await window.pundi.cetakLaporanHtml({ jenis: 'rekapSiswa', tahunAjaranId: id });
      if (!res.ok) throw new Error(res.pesan);
      return res.data.html;
    }, tahunAjaranId);
    expect(html).toContain('Siswa Fiktif 200');
    expect(html).toContain('TOTAL KESELURUHAN');
    expect(html).toContain('display: table-header-group');
    expect(html).toContain('counter(page)');

    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, targetPdf);
    const hasil = await s.page.evaluate(async (id) => window.pundi.cetakLaporanPdf({ jenis: 'rekapSiswa', tahunAjaranId: id }), tahunAjaranId);
    expect(hasil).toMatchObject({ ok: true, data: { nama_berkas: 'rekap-siswa.pdf' } });

    const pdf = fs.readFileSync(targetPdf);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const halaman = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
    expect(halaman.length).toBeGreaterThan(1);
  });

  test('tombol ekspor rekap kelas menghasilkan Excel dengan jumlah dan total yang cocok', async () => {
    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, targetXlsx);
    await s.page.locator('nav').getByRole('button', { name: 'Laporan' }).click();
    await s.page.getByRole('button', { name: 'Ekspor Excel' }).click();
    await expect(s.page.getByRole('status')).toContainText('Laporan disimpan sebagai rekap-kelas.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(targetXlsx);
    const sheet = workbook.getWorksheet('Rekap Tabungan Kelas')!;
    expect(sheet.getRow(2).getCell(1).value).toBe('7A');
    expect(sheet.getRow(2).getCell(3).value).toBe(200);
    expect(sheet.getRow(2).getCell(4).value).toBe(12000);
    expect(sheet.getRow(2).getCell(6).value).toBe(12000);
    expect(sheet.getRow(4).getCell(3).value).toBe(200);
    expect(sheet.getRow(4).getCell(6).value).toBe(12000);
  });
});
