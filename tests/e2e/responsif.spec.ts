import { test, expect } from '@playwright/test';
import { jalankanApp, type AppSesi } from './launch';

// Tata letak harus tetap utuh saat jendela diubah ukurannya (jendela minimum 1024 px, lihat DESIGN §5a).
const MENU = ['Beranda', 'Catat Transaksi', 'Siswa', 'Laporan', 'Tahun Ajaran & Kelas', 'Kenaikan Kelas', 'Impor Data', 'Cadangan', 'Pengaturan'];
const UKURAN: Array<[number, number]> = [
  [1024, 680],
  [1180, 720],
  [1366, 768],
  [1600, 900],
];

test.describe.serial('responsivitas', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      await window.pundi.tahunAjaranSimpan({ nama: '2026/2027', mulai: '2026-07-01', selesai: '2027-06-30', aktif: true });
      await window.pundi.siswaSimpan({ nama: 'Ani Permata (Contoh)', status: 'aktif' });
    });
  });
  test.afterAll(async () => {
    await s.tutup();
  });

  const ukur = async (w: number, h: number) => {
    await s.app.evaluate(({ BrowserWindow }, [lebar, tinggi]) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setSize(lebar, tinggi);
    }, [w, h]);
    await s.page.waitForTimeout(300);
  };

  for (const [w, h] of UKURAN) {
    test(`tidak ada elemen keluar dari jendela pada ${w}x${h}`, async () => {
      await ukur(w, h);
      const lebar = await s.page.evaluate(() => innerWidth);
      for (const m of MENU) {
        await s.page.locator('nav').getByRole('button', { name: m }).click();
        await s.page.waitForTimeout(150);
        const hasil = await s.page.evaluate(() => {
          const d = document.documentElement;
          const keluar = Array.from(document.querySelectorAll('body *'))
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.right > innerWidth + 1;
            })
            .map((e) => (e.className && typeof e.className === 'string' ? e.className : e.tagName).slice(0, 40));
          return { melebar: d.scrollWidth > d.clientWidth, keluar: keluar.slice(0, 5) };
        });
        expect(hasil, `${m} @${lebar}px`).toEqual({ melebar: false, keluar: [] });
      }
    });
  }

  test('bilah samping menciut menjadi rel ikon di bawah 1100 px dan nama menu tetap terbaca pembaca layar', async () => {
    await ukur(1024, 680);
    const sempit = await s.page.locator('aside').evaluate((e) => e.getBoundingClientRect().width);
    expect(sempit).toBeLessThan(100);
    // nama menu tetap ada sebagai nama aksesibel meski tidak tampak
    await expect(s.page.locator('nav').getByRole('button', { name: 'Catat Transaksi' })).toBeVisible();
    await ukur(1366, 768);
    const lebar = await s.page.locator('aside').evaluate((e) => e.getBoundingClientRect().width);
    expect(lebar).toBe(240);
  });

  test('Catat Transaksi: tiga kolom di layar lebar, dua kolom (ringkasan di bawah form) di layar sedang', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Catat Transaksi' }).click();
    await ukur(1600, 900);
    const tiga = await s.page.evaluate(() => {
      const k = document.querySelectorAll('.grid-catat > section');
      return Array.from(k).map((e) => Math.round(e.getBoundingClientRect().top));
    });
    expect(new Set(tiga).size).toBe(1); // sejajar
    await ukur(1180, 720);
    const dua = await s.page.evaluate(() => {
      const [kiri, tengah, kanan] = Array.from(document.querySelectorAll('.grid-catat > section')).map((e) => e.getBoundingClientRect());
      return { kananDiBawahTengah: kanan.top >= tengah.bottom - 1, kolomSama: Math.abs(kanan.left - tengah.left) < 1, kiriDiKiri: kiri.right <= tengah.left };
    });
    expect(dua).toEqual({ kananDiBawahTengah: true, kolomSama: true, kiriDiKiri: true });
  });

  test('Data Siswa: dua kolom di layar lebar, satu kolom di layar sedang; filter kelas tampil utuh; inisial tanpa tanda kurung', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Siswa' }).click();
    await ukur(1600, 900);
    const sejajar = await s.page.evaluate(() => Array.from(document.querySelectorAll('.grid-siswa > section')).map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(sejajar).size).toBe(1);
    await ukur(1180, 720);
    const bertumpuk = await s.page.evaluate(() => {
      const [daftar, detail] = Array.from(document.querySelectorAll('.grid-siswa > section')).map((e) => e.getBoundingClientRect());
      return detail.top >= daftar.bottom - 1;
    });
    expect(bertumpuk).toBe(true);
    // baris filter (Semua kelas / 7 / 8 / 9 / Aktif) tidak boleh menyusut jadi gumpalan
    const tinggi = await s.page.getByRole('button', { name: 'Semua kelas' }).evaluate((e) => e.getBoundingClientRect().height);
    expect(tinggi).toBeGreaterThan(18);
    await expect(s.page.locator('.grid-siswa').getByText('AP', { exact: true }).first()).toBeVisible();
    await expect(s.page.locator('.grid-siswa').getByText('A(', { exact: true })).toHaveCount(0);
  });

  test('Beranda: angka uang tidak terpecah menjadi dua baris pada layar sempit', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Beranda' }).click();
    await ukur(1024, 680);
    const terpecah = await s.page.evaluate(() =>
      Array.from(document.querySelectorAll('.nilai-uang')).filter((e) => e.getBoundingClientRect().height > 40).length
    );
    expect(terpecah).toBe(0);
  });

  test('bilah samping jujur soal cadangan: belum ada -> peringatan; setelah cadangan -> data aman', async () => {
    await ukur(1366, 768);
    const kartu = s.page.locator('.sidebar-backup-card');
    await expect(kartu).toContainText('Belum ada cadangan');
    await expect(kartu).not.toContainText('07:30');
    await s.page.getByRole('button', { name: 'Cadangkan cepat' }).click();
    await expect(kartu).toContainText('Data aman');
    await expect(kartu).toContainText('Cadangan terakhir:');
  });
});
