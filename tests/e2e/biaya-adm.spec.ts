import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// CAP-08 (keputusan D-06): biaya administrasi per kelas. Data awal lewat API; alurnya lewat UI.
test.describe.serial('biaya administrasi', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      const p = window.pundi;
      const ta = await p.tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
      if (!ta.ok) throw new Error(ta.pesan);
      const k = await p.kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
      if (!k.ok) throw new Error(k.pesan);
      const saldoPerSiswa: [string, number][] = [['Ani Fiktif', 50000], ['Budi Fiktif', 3000]];
      for (const [nama, saldo] of saldoPerSiswa) {
        const r = await p.siswaSimpan({ nama, status: 'aktif', kelas_id: k.data.id });
        if (!r.ok) throw new Error(r.pesan);
        await p.transaksiSetor({ siswa_id: r.data.id, nominal: saldo });
      }
    });
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const menu = (label: string) => s.page.locator('nav').getByRole('button', { name: label }).click();

  test('tinjau menunjukkan siapa dipotong dan dilewati, terapkan menyimpan sekaligus', async () => {
    await menu('Catat Transaksi');
    await s.page.getByRole('button', { name: 'Biaya Adm', exact: true }).click();
    const dialog = s.page.getByRole('dialog', { name: 'Biaya Administrasi per Kelas' });
    await dialog.getByLabel('Kelas', { exact: true }).selectOption({ label: '7A' });
    await dialog.getByLabel('Periode', { exact: true }).fill('Semester 1');
    await dialog.getByLabel(/Biaya per siswa/).fill('5000');

    await expect(dialog.getByRole('button', { name: 'Terapkan Potongan' })).toBeDisabled(); // belum ditinjau
    await dialog.getByRole('button', { name: 'Tinjau' }).click();
    const hasil = dialog.getByLabel('Hasil tinjauan');
    await expect(hasil).toContainText('1 siswa akan dipotong');
    await expect(hasil.getByRole('row', { name: /Budi Fiktif/ })).toContainText('Saldo kurang dari biaya');

    await dialog.getByRole('button', { name: 'Terapkan Potongan' }).click();
    await expect(dialog.getByRole('status')).toContainText('1 siswa dipotong, total Rp 5.000');

    // Mengulang periode yang sama tidak memotong lagi
    await dialog.getByRole('button', { name: 'Tinjau' }).click();
    await expect(dialog.getByLabel('Hasil tinjauan')).toContainText('0 siswa akan dipotong');
    await expect(dialog.getByRole('button', { name: 'Terapkan Potongan' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();
  });

  test('potongan tidak dihitung sebagai penarikan pada tutup kas', async () => {
    await menu('Laporan');
    await s.page.getByRole('button', { name: 'Tutup Kas' }).click();
    const kas = s.page.getByRole('region', { name: 'Tutup kas harian' });
    await expect(kas.getByText('Biaya administrasi (tidak memengaruhi kas)')).toBeVisible();
    await s.page.getByLabel(/Uang fisik hasil hitung/).fill('53000'); // setoran 50.000 + 3.000, tanpa pengurangan biaya
    await expect(s.page.getByText('Kas sesuai. Tidak ada selisih.')).toBeVisible();
  });
});
