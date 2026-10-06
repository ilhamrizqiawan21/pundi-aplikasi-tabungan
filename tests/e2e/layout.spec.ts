import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { jalankanApp, type AppSesi } from './launch';

// Ketepatan tata letak: semua layar, data sintetis yang cukup banyak dengan nama panjang, beberapa ukuran jendela.
// Tangkapan layar ditulis ke folder yang diberikan lewat PUNDI_SHOT_DIR (opsional) untuk ditinjau manual.
const MENU = ['Beranda', 'Catat Transaksi', 'Siswa', 'Laporan', 'Tahun Ajaran & Kelas', 'Kenaikan Kelas', 'Impor Data', 'Cadangan', 'Pengaturan'];
const UKURAN: Array<[number, number]> = [
  [1024, 680],
  [1100, 680],
  [1280, 720],
  [1366, 768],
  [1536, 864],
  [1920, 1080],
];
const SHOT = process.env.PUNDI_SHOT_DIR;

test.describe('ketepatan tata letak', () => {
  let s: AppSesi;
  test.beforeAll(async () => {
    s = await jalankanApp();
    await s.page.evaluate(async () => {
      const p = window.pundi;
      const ta = await p.tahunAjaranSimpan({ nama: '2025/2026', mulai: '2025-07-01', selesai: '2026-06-30', aktif: true });
      if (!ta.ok) throw new Error(ta.pesan);
      const nama = ['Muhammad Alfarizqi Nur Rahmatullah Hidayat', 'Ani Fiktif', 'Siti Nurhaliza Putri Ramadhani', 'Budi Fiktif', 'Citra Fiktif'];
      let n = 0;
      for (const [tingkat, label] of [[7, '7A'], [8, '8B'], [9, '9C']] as const) {
        const k = await p.kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: label, tingkat, urutan: tingkat });
        if (!k.ok) throw new Error(k.pesan);
        for (let i = 0; i < 12; i++) {
          const r = await p.siswaSimpan({ nama: `${nama[(n + i) % nama.length]} ${n + i + 1}`, status: 'aktif', kelas_id: k.data.id });
          if (!r.ok) throw new Error(r.pesan);
          await p.transaksiSetor({ siswa_id: r.data.id, nominal: 1234567 + i * 1000, tanggal: '2026-01-05' });
        }
        n += 12;
      }
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

  // Temuan tata letak pada halaman yang sedang tampil.
  const periksa = () =>
    s.page.evaluate(() => {
      const nama = (e: Element) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''}:${(e.textContent ?? '').trim().slice(0, 30)}`;
      const dalamGulir = (e: Element) => {
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
        }
        return false;
      };
      const semua = Array.from(document.querySelectorAll('body *')).filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const keluarKanan = semua.filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !dalamGulir(e)).map(nama);
      // teks terpotong tanpa elipsis: pengguna kehilangan informasi tanpa petunjuk
      const terpotong = semua
        .filter((e) => {
          const c = getComputedStyle(e);
          return (c.overflowX === 'hidden' || c.overflowX === 'clip') && c.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && !e.classList.contains('rail-hide-visually') && e.children.length === 0 && (e.textContent ?? '').trim() !== '';
        })
        .map(nama);
      // tombol dan kolom isian yang teksnya meluber dari kotaknya sendiri
      const meluber = semua
        .filter((e) => /^(BUTTON|INPUT|SELECT|TH|TD|LABEL)$/.test(e.tagName) && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && e.tagName !== 'INPUT' && e.tagName !== 'SELECT')
        .map(nama);
      // elemen interaktif yang tertimpa elemen lain di titik tengahnya (bukan leluhur/keturunannya)
      const tertimpa = semua
        .filter((e) => /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(e.tagName))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
          const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
          const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
          const atas = document.elementFromPoint(x, y);
          return !!atas && atas !== e && !e.contains(atas) && !atas.contains(e);
        })
        .map(nama);
      const d = document.documentElement;
      return { gulirMendatar: d.scrollWidth > d.clientWidth, keluarKanan: keluarKanan.slice(0, 5), terpotong: terpotong.slice(0, 5), meluber: meluber.slice(0, 5), tertimpa: tertimpa.slice(0, 5) };
    });

  const foto = async (nama: string) => {
    if (!SHOT) return;
    fs.mkdirSync(SHOT, { recursive: true });
    await s.page.screenshot({ path: path.join(SHOT, `${nama}.png`) });
  };

  for (const [w, h] of UKURAN) {
    test(`semua layar utuh pada ${w}x${h}`, async () => {
      await ukur(w, h);
      for (const m of MENU) {
        await s.page.locator('nav').getByRole('button', { name: m }).click();
        await s.page.waitForTimeout(250);
        await foto(`${w}x${h}-${m.replace(/\W+/g, '-')}`);
        expect.soft(await periksa(), `${m} @${w}x${h}`).toEqual({ gulirMendatar: false, keluarKanan: [], terpotong: [], meluber: [], tertimpa: [] });
      }
    });
  }

  for (const [w, h] of [[1024, 680], [1280, 720], [1366, 768]] as Array<[number, number]>) {
    test(`Catat Transaksi pada ${w}x${h}: judul kolom satu baris dan tombol Simpan terlihat tanpa menggulir`, async () => {
      await ukur(w, h);
      await s.page.locator('nav').getByRole('button', { name: 'Catat Transaksi' }).click();
      await s.page.waitForTimeout(250);
      const kiri = s.page.locator('.catat-kiri');
      for (const nama of ['Pilih siswa', 'Setoran per Kelas', 'Biaya Adm']) {
        const tinggi = await kiri.getByText(nama, { exact: true }).first().evaluate((e) => e.getBoundingClientRect().height);
        expect(tinggi, `${nama} tidak terlipat`).toBeLessThan(36);
      }
      const simpan = await s.page.getByRole('button', { name: 'Simpan transaksi' }).boundingBox();
      expect(simpan).not.toBeNull();
      if (h <= 760) expect(simpan!.y + simpan!.height, 'Simpan di dalam jendela').toBeLessThanOrEqual(h);
    });
  }

  const BERSIH = { gulirMendatar: false, keluarKanan: [], terpotong: [], meluber: [], tertimpa: [] };

  for (const [w, h] of [[1024, 680], [1366, 768]] as Array<[number, number]>) {
    test(`Beranda pada ${w}x${h}: nominal miliaran tetap utuh di dalam kartunya`, async () => {
      await s.page.evaluate(async () => {
        const r = await window.pundi.transaksiSetor({ siswa_id: 1, nominal: 8_765_432_100, tanggal: '2026-01-06' });
        if (!r.ok) throw new Error(r.pesan);
      });
      await ukur(w, h);
      await s.page.locator('nav').getByRole('button', { name: 'Siswa' }).click();
      await s.page.locator('nav').getByRole('button', { name: 'Beranda' }).click();
      await s.page.waitForTimeout(400);
      await foto(`beranda-miliaran-${w}x${h}`);
      const hasil = await s.page.evaluate(() =>
        Array.from(document.querySelectorAll('.nilai-uang')).map((e) => {
          const kartu = e.closest('.kartu-metrik') ?? e.parentElement!;
          const a = e.getBoundingClientRect();
          const k = kartu.getBoundingClientRect();
          return { teks: e.textContent, baris: Math.round(a.height), keluarKartu: a.right > k.right - 8, terpotong: e.scrollWidth > e.clientWidth + 1 };
        })
      );
      expect(hasil.some((x) => (x.teks ?? '').length >= 14), 'nominal miliaran tampil').toBe(true);
      for (const x of hasil) expect(x, x.teks ?? '').toMatchObject({ keluarKartu: false, terpotong: false });
    });
  }

  for (const [w, h] of [[1024, 680], [1366, 768]] as Array<[number, number]>) {
    test(`Laporan pada ${w}x${h}: setiap tab utuh`, async () => {
      await ukur(w, h);
      await s.page.locator('nav').getByRole('button', { name: 'Laporan' }).click();
      for (const tab of ['Rekap per Kelas', 'Rekap per Siswa', 'Transaksi', 'Rekap Bulanan', 'Slip Saldo', 'Tutup Kas']) {
        await s.page.getByRole('button', { name: tab, exact: true }).click();
        await s.page.waitForTimeout(400);
        await foto(`laporan-${tab.replace(/\W+/g, '-')}-${w}x${h}`);
        expect.soft(await periksa(), `Laporan/${tab} @${w}x${h}`).toEqual(BERSIH);
      }
    });
  }

  // Bagian bawah halaman: jendela dipanjangkan supaya seluruh isi layar terlihat dan terperiksa.
  for (const w of [1024, 1366]) {
    test(`isi penuh setiap layar pada lebar ${w}`, async () => {
      await ukur(w, 2400);
      for (const m of MENU) {
        await s.page.locator('nav').getByRole('button', { name: m }).click();
        await s.page.waitForTimeout(400);
        await foto(`penuh-${w}-${m.replace(/\W+/g, '-')}`);
        expect.soft(await periksa(), `${m} penuh @${w}`).toEqual(BERSIH);
      }
    });
  }

  // Laptop 1366x768 pada skala Windows 125%/150%: ruang efektif lebih kecil dari minimum jendela.
  // Minimum jendela dilepas hanya di uji ini agar ukuran efektif itu bisa ditiru.
  for (const [w, h, ket] of [[1093, 560, '1366x768 @125%'], [1024, 520, '1366x768 @133% (tinggi terpakai taskbar)']] as Array<[number, number, string]>) {
    test(`ruang efektif ${ket}: tidak ada yang rusak`, async () => {
      await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setMinimumSize(0, 0));
      await ukur(w, h);
      for (const m of ['Beranda', 'Catat Transaksi', 'Siswa', 'Laporan', 'Pengaturan']) {
        await s.page.locator('nav').getByRole('button', { name: m }).click();
        await s.page.waitForTimeout(300);
        await foto(`skala-${w}x${h}-${m.replace(/\W+/g, '-')}`);
        expect.soft(await periksa(), `${m} @${ket}`).toEqual(BERSIH);
      }
      await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setMinimumSize(1024, 680));
    });
  }

  // Modal harus muat di tinggi jendela terpendek dan tombol aksinya tetap terjangkau.
  const MODAL: Array<[string, string, string]> = [
    ['Catat Transaksi', 'Setoran per Kelas', 'Setoran per Kelas'],
    ['Siswa', 'Tambah Siswa', 'Tambah Siswa Baru'],
  ];
  test('modal menjebak fokus keyboard dan mengembalikannya ke pemicu saat ditutup', async () => {
    await s.page.locator('nav').getByRole('button', { name: 'Siswa' }).click();
    const pemicu = s.page.getByRole('button', { name: 'Tambah Siswa' }).first();
    await pemicu.focus();
    await pemicu.press('Enter');
    const dialog = s.page.getByRole('dialog', { name: 'Tambah Siswa Baru' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i++) {
      await s.page.keyboard.press(i % 2 === 0 ? 'Tab' : 'Shift+Tab');
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 25; i++) {
      await s.page.keyboard.press('Tab');
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    }
    await s.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(pemicu).toBeFocused();
  });

  for (const [w, h] of [[1024, 680], [1366, 768]] as Array<[number, number]>) {
    for (const [layar, tombol, judul] of MODAL) {
      test(`modal ${judul} muat pada ${w}x${h}`, async () => {
        await ukur(w, h);
        await s.page.locator('nav').getByRole('button', { name: layar }).click();
        await s.page.getByRole('button', { name: tombol }).first().click();
        const dialog = s.page.getByRole('dialog', { name: judul });
        await expect(dialog).toBeVisible();
        await foto(`modal-${judul.replace(/\W+/g, '-')}-${w}x${h}`);
        const kotak = await dialog.evaluate((e) => {
          const r = e.getBoundingClientRect();
          return { atas: r.top, bawah: r.bottom, kiri: r.left, kanan: r.right, vw: innerWidth, vh: innerHeight };
        });
        expect(kotak.atas).toBeGreaterThanOrEqual(0);
        expect(kotak.bawah).toBeLessThanOrEqual(kotak.vh);
        expect(kotak.kiri).toBeGreaterThanOrEqual(0);
        expect(kotak.kanan).toBeLessThanOrEqual(kotak.vw);
        // tombol di dalam dialog dapat digulir ke tampilan dan tidak tertimpa
        const tombolDialog = dialog.getByRole('button');
        const jumlah = await tombolDialog.count();
        for (let i = 0; i < jumlah; i++) {
          const b = tombolDialog.nth(i);
          await b.scrollIntoViewIfNeeded();
          const r = await b.boundingBox();
          expect(r, 'tombol punya kotak').not.toBeNull();
          expect(r!.y + r!.height).toBeLessThanOrEqual(h);
        }
        await s.page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      });
    }
  }
});
