import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// CAP-18 sampai CAP-21: rutinitas harian bendahara. Data awal lewat API (bukan yang diuji); alurnya lewat UI.
test.describe.serial('rutinitas harian', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      const p = window.pundi;
      const ta = await p.tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
      if (!ta.ok) throw new Error(ta.pesan);
      const k = await p.kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
      if (!k.ok) throw new Error(k.pesan);
      for (const nama of ['Ani Fiktif', 'Budi Fiktif', 'Citra Fiktif']) {
        const r = await p.siswaSimpan({ nama, status: 'aktif', kelas_id: k.data.id });
        if (!r.ok) throw new Error(r.pesan);
      }
    });
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();

  test('Beranda mengingatkan salinan ke flashdisk dan dapat ditutup', async () => {
    await menu('Beranda');
    const pengingat = s.page.getByRole('region', { name: 'Pengingat salinan cadangan' });
    await expect(pengingat).toBeVisible();
    await pengingat.getByRole('button', { name: 'Nanti saja' }).click();
    await expect(pengingat).toBeHidden();
  });

  test('setoran per kelas: isi dengan keyboard, simpan sekaligus, saldo ikut', async () => {
    await menu('Catat Transaksi');
    await s.page.getByRole('button', { name: 'Setoran per Kelas' }).click();
    const dialog = s.page.getByRole('dialog', { name: 'Setoran per Kelas' });
    await dialog.getByLabel('Kelas', { exact: true }).selectOption({ label: '7A' });

    const ani = dialog.getByLabel('Setoran untuk Ani Fiktif');
    await ani.fill('10000');
    await ani.press('Enter'); // pindah ke baris berikutnya
    await expect(dialog.getByLabel('Setoran untuk Budi Fiktif')).toBeFocused();
    await dialog.getByLabel('Setoran untuk Budi Fiktif').fill('abc');
    await expect(dialog.getByText(/Format nominal tidak dikenali/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Simpan 1 Setoran/ })).toBeDisabled();
    await dialog.getByLabel('Setoran untuk Budi Fiktif').fill('25.000');

    await expect(dialog.getByRole('button', { name: 'Simpan 2 Setoran' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Simpan 2 Setoran' }).click();
    await expect(dialog.getByRole('status')).toContainText('2 setoran');
    await expect(dialog.getByRole('row', { name: /Budi Fiktif/ })).toContainText('Rp 25.000');
    await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();
  });

  test('slip saldo: pratinjau memuat nama siswa dan saldonya', async () => {
    await menu('Laporan');
    await s.page.getByRole('button', { name: 'Slip Saldo' }).click();
    await s.page.getByLabel('Kelas', { exact: true }).selectOption({ label: '7A' });
    await s.page.getByRole('button', { name: 'Pratinjau Slip' }).click();
    const dialog = s.page.getByRole('dialog', { name: 'Pratinjau Cetak: Slip Saldo Siswa' });
    await expect(dialog).toBeVisible();
    const html = await dialog.locator('iframe').getAttribute('srcdoc');
    expect(html).toContain('Ani Fiktif');
    expect(html).toContain('Rp 10.000');
    expect(html).toContain('Citra Fiktif');
  });

  test('tutup kas: selisih dihitung dari kas awal, setoran, dan uang fisik', async () => {
    await s.page.keyboard.press('Escape'); // tutup pratinjau slip
    await s.page.getByRole('button', { name: 'Tutup Kas' }).click();
    await s.page.getByLabel(/Kas awal di laci/).fill('100000');
    await s.page.getByLabel(/Uang fisik hasil hitung/).fill('130000');
    // Setoran hari ini 35.000 (10.000 + 25.000): seharusnya 135.000, fisik 130.000
    await expect(s.page.getByText('Selisih Kurang: Rp 5.000')).toBeVisible();
    await s.page.getByLabel(/Uang fisik hasil hitung/).fill('135000');
    await expect(s.page.getByText('Kas sesuai. Tidak ada selisih.')).toBeVisible();
  });
});
