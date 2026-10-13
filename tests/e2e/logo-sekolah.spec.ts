import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jalankanApp, type AppSesi } from './launch';

test.describe.serial('logo sekolah (CAP-01)', () => {
  let s: AppSesi;
  let tmpDir: string;
  let logoPath: string;
  let svgPath: string;

  test.beforeAll(async () => {
    s = await jalankanApp();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-logo-'));
    logoPath = path.join(tmpDir, 'logo-sintetis.png');
    fs.writeFileSync(logoPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ6kAAAAASUVORK5CYII=', 'base64'));
    svgPath = path.join(tmpDir, 'bukan-logo.svg');
    fs.writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  });

  test.afterAll(async () => {
    await s.tutup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('logo dipilih melalui dialog main, tidak membocorkan jalur, dan masuk ke keluaran cetak', async () => {
    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, logoPath);
    await s.page.locator('nav').getByRole('button', { name: 'Pengaturan' }).click();
    await s.page.getByLabel('Nama Sekolah / Lembaga').fill('Sekolah Sintetis');
    await s.page.getByRole('button', { name: 'Simpan Pengaturan' }).click();
    await expect(s.page.getByRole('status')).toContainText('Pengaturan dan profil sekolah berhasil disimpan');
    const profilTersimpan = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(profilTersimpan).toMatchObject({ ok: true, data: { nama: 'Sekolah Sintetis' } });

    await s.page.getByRole('button', { name: 'Pilih Logo' }).click();
    await expect(s.page.getByRole('status')).toContainText('Logo sekolah diperbarui');

    const profil = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(profil).toMatchObject({ ok: true, data: { logo_tersedia: true } });
    expect(profil.ok && 'logo_rel_path' in profil.data).toBe(false);

    const cetak = await s.page.evaluate(() => window.pundi.cetakLaporanHtml({ jenis: 'rekapKelas' }));
    expect(cetak.ok && cetak.data.html).toContain('data:image/png;base64,');
    expect(cetak.ok && cetak.data.html).not.toContain(logoPath);

    const keluaran = await s.page.evaluate(async () => {
      const p = window.pundi;
      const simpanProfil = await p.profilSekolahSimpan({ nama: 'Sekolah Sintetis', alamat: '<Jl. Fiktif>', kota: 'Kota Uji', bendahara: 'Bendahara Uji', kepala: 'Kepala Uji' });
      if (!simpanProfil.ok) throw new Error(simpanProfil.pesan);
      const ta = await p.tahunAjaranSimpan({ nama: '2026/2027', mulai: '2026-07-01', selesai: '2027-06-30', aktif: true });
      if (!ta.ok) throw new Error(ta.pesan);
      const kelas = await p.kelasSimpan({ tahun_ajaran_id: ta.data.id, nama: '7A', tingkat: 7, urutan: 1 });
      if (!kelas.ok) throw new Error(kelas.pesan);
      const siswa = await p.siswaSimpan({ nama: 'Siswa Sintetis', status: 'aktif', kelas_id: kelas.data.id });
      if (!siswa.ok) throw new Error(siswa.pesan);
      const trx = await p.transaksiSetor({ siswa_id: siswa.data.id, nominal: 5000, tanggal: '2026-10-12' });
      if (!trx.ok) throw new Error(trx.pesan);
      const jenis = [
        { jenis: 'rekapKelas', tahunAjaranId: ta.data.id },
        { jenis: 'rekapSiswa', tahunAjaranId: ta.data.id },
        { jenis: 'transaksi', dari: '2026-10-12', sampai: '2026-10-12' },
        { jenis: 'bukuBesar', siswaId: siswa.data.id },
        { jenis: 'slipSaldo', kelasId: kelas.data.id },
        { jenis: 'tutupKas', tanggal: '2026-10-12' },
        { jenis: 'rekapBulanan', dari: '2026-10-01', sampai: '2026-10-31' },
      ] as const;
      const laporan = [];
      for (const input of jenis) {
        const r = await p.cetakLaporanHtml(input);
        if (!r.ok) throw new Error(`${input.jenis}: ${r.pesan}`);
        laporan.push(r.data.html);
      }
      const struk = await p.cetakStrukHtml(trx.data.id);
      if (!struk.ok) throw new Error(struk.pesan);
      return [...laporan, struk.data.html];
    });
    for (const html of keluaran) {
      expect(html).toContain('Sekolah Sintetis');
      expect(html).toMatch(/&lt;Jl\. Fiktif&gt;(?: - |, )Kota Uji/);
      expect(html).toContain('data:image/png;base64,');
      expect(html).not.toContain(logoPath);
      expect(html).not.toContain('<Jl. Fiktif>');
    }

    await s.page.getByRole('button', { name: 'Hapus Logo' }).click();
    await expect(s.page.getByRole('status')).toContainText('Logo sekolah dihapus');
    const sesudah = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(sesudah).toMatchObject({ ok: true, data: { logo_tersedia: false } });

    await s.app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, svgPath);
    await s.page.getByRole('button', { name: 'Pilih Logo' }).click();
    await expect(s.page.getByRole('alert')).toContainText('Pilih gambar PNG atau JPEG yang valid');
    const tetapKosong = await s.page.evaluate(() => window.pundi.profilSekolahBaca());
    expect(tetapKosong).toMatchObject({ ok: true, data: { logo_tersedia: false } });
  });
});
