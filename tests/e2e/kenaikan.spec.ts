import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// CAP-12: kenaikan kelas dan kelulusan. Data awal disiapkan lewat API (bukan yang diuji); alurnya lewat UI.
test.describe.serial('kenaikan kelas', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();
  const baris = (nama: RegExp) => s.page.getByRole('row', { name: nama });

  test('tanpa tahun ajaran baru, layar menuntun ke menu Tahun Ajaran & Kelas', async () => {
    await menu('Kenaikan Kelas');
    await expect(s.page.getByText(/Buat tahun ajaran baru beserta kelasnya/)).toBeVisible();
  });

  test('naik kelas, lulus, dan saldo ikut tanpa berubah', async () => {
    await s.page.evaluate(async () => {
      const p = window.pundi;
      const lama = await p.tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
      if (!lama.ok) throw new Error(lama.pesan);
      const k7 = await p.kelasSimpan({ tahun_ajaran_id: lama.data.id, nama: '7A', tingkat: 7, urutan: 1 });
      if (!k7.ok) throw new Error(k7.pesan);
      const ids: number[] = [];
      for (const nama of ['Ani Fiktif', 'Budi Fiktif', 'Citra Fiktif']) {
        const r = await p.siswaSimpan({ nama, status: 'aktif', kelas_id: k7.data.id });
        if (!r.ok) throw new Error(r.pesan);
        ids.push(r.data.id);
      }
      await p.transaksiSetor({ siswa_id: ids[0], nominal: 100000 });
      const baru = await p.tahunAjaranSimpan({ nama: '2026/2027', mulai: '2026-07-01', selesai: '2027-06-30', aktif: true });
      if (!baru.ok) throw new Error(baru.pesan);
      await p.kelasSimpan({ tahun_ajaran_id: baru.data.id, nama: '8A', tingkat: 8, urutan: 1 });
    });

    await menu('Siswa'); // muat ulang layar dengan data baru
    await menu('Kenaikan Kelas');
    await expect(s.page.getByLabel('Tahun ajaran asal')).toHaveValue(/\d+/);
    await s.page.getByLabel('Kelas asal').selectOption({ label: '7A (3 siswa)' });

    await expect(baris(/Ani Fiktif/)).toBeVisible();
    await expect(s.page.getByLabel('Kelas tujuan', { exact: true })).toHaveValue(/\d+/); // saran: tingkat berikutnya (8A)
    await s.page.getByLabel('Tindakan untuk Citra Fiktif').selectOption('lulus');

    await s.page.getByRole('button', { name: 'Tinjau Perubahan' }).click();
    await expect(s.page.getByText(/siswa naik ke kelas/)).toContainText('2');
    await expect(s.page.getByText(/siswa lulus/)).toContainText('1');
    await expect(s.page.getByText(/tidak berubah/)).toContainText('Rp 100.000');
    await s.page.getByRole('button', { name: 'Terapkan', exact: true }).click();

    await expect(s.page.getByRole('status')).toContainText('2 siswa naik kelas, 1 lulus, 0 keluar');
    await expect(baris(/Ani Fiktif/)).toContainText('Sudah di kelas 8A');
    await expect(s.page.getByRole('checkbox', { name: 'Pilih Ani Fiktif' })).not.toBeChecked();

    await menu('Siswa');
    const ani = baris(/Ani Fiktif/);
    await expect(ani).toContainText('8A');
    await expect(ani).toContainText('Rp 100.000');

    const integritas = await s.page.evaluate(async () => {
      const r = await window.pundi.integritasPeriksa();
      return r.ok ? r.data.apakah_seimbang : null;
    });
    expect(integritas).toBe(true);
    expect(s.galat).toEqual([]);
  });
});
