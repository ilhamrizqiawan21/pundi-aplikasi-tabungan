import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// CAP-22: rekap bulanan dan saldo mengendap; riwayat aktivitas di Pengaturan. Data awal lewat API; tampilan lewat UI.
test.describe.serial('analitik dan riwayat aktivitas', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      const p = window.pundi;
      const ta = await p.tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
      if (!ta.ok) throw new Error(ta.pesan);
      const k = await p.kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
      if (!k.ok) throw new Error(k.pesan);
      const ani = await p.siswaSimpan({ nama: 'Ani Fiktif', status: 'aktif', kelas_id: k.data.id });
      if (!ani.ok) throw new Error(ani.pesan);
      await p.transaksiSetor({ siswa_id: ani.data.id, nominal: 40000, tanggal: '2026-01-05' });
      await p.transaksiSetor({ siswa_id: ani.data.id, nominal: 10000, tanggal: '2026-02-10' });
      await p.transaksiTarik({ siswa_id: ani.data.id, nominal: 5000, tanggal: '2026-02-20' });
    });
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();

  test('rekap bulanan: tabel per bulan memuat total dan saldo akhir', async () => {
    await menu('Laporan');
    await s.page.getByRole('button', { name: 'Rekap Bulanan' }).click();
    await s.page.getByLabel('Periode', { exact: true }).selectOption({ label: 'T.A. 2025/2026 (Aktif)' });

    const februari = s.page.getByRole('row', { name: /^Februari 2026/ });
    await expect(februari).toContainText('Rp 10.000'); // setoran
    await expect(februari).toContainText('Rp 5.000'); // penarikan
    await expect(februari).toContainText('Rp 45.000'); // saldo akhir (40.000 + 10.000 - 5.000)
    await expect(s.page.getByRole('row', { name: /^Maret 2026/ })).toContainText('Rp 45.000'); // bulan kosong, saldo ikut
    await expect(s.page.getByRole('img', { name: /Grafik setoran dan penarikan/ })).toBeVisible();
  });

  test('saldo mengendap menampilkan siswa yang lama tidak bertransaksi', async () => {
    const bagian = s.page.getByRole('region', { name: 'Saldo mengendap' });
    await expect(bagian.getByRole('row', { name: /Ani Fiktif/ })).toContainText('Rp 45.000');
    await s.page.getByLabel('Lama tidak bertransaksi').selectOption('12');
    await expect(bagian.getByText(/Tidak ada siswa bersaldo yang diam selama 12 bulan/)).toBeVisible();
  });

  test('pratinjau cetak rekap bulanan memuat nama bulan', async () => {
    await s.page.getByRole('button', { name: 'Cetak / PDF' }).click();
    const dialog = s.page.getByRole('dialog', { name: 'Pratinjau Cetak: Rekap Bulanan' });
    await expect(dialog).toBeVisible();
    const html = await dialog.locator('iframe').getAttribute('srcdoc');
    expect(html).toContain('Februari 2026');
    await s.page.keyboard.press('Escape');
  });

  test('riwayat aktivitas di Pengaturan mencatat transaksi tanpa nama atau nominal', async () => {
    await menu('Pengaturan');
    const bagian = s.page.getByRole('region', { name: 'Riwayat aktivitas' });
    await expect(bagian.getByRole('row', { name: /Setoran/ }).first()).toBeVisible();
    await expect(bagian.getByRole('row', { name: /Penarikan/ }).first()).toBeVisible();
    await expect(bagian).not.toContainText('Ani Fiktif');
  });
});
