import { describe, it, expect } from 'vitest';
import { generateReceiptHtml, esc } from './receipt.js';
import {
  generateLaporanKelasHtml,
  generateLaporanSiswaHtml,
  generateLaporanTransaksiHtml,
  generateBukuBesarSiswaHtml,
} from './laporan.js';
import type { ProfilSekolah, Siswa, Transaksi, ItemRekapKelas, ItemLaporanSiswa, ItemLaporanTransaksi } from '../../shared/types.js';

describe('Print & PDF HTML Generators', () => {
  const mockProfil: ProfilSekolah = {
    id: 1,
    nama: 'SDIT Pundi Harapan <script>alert("xss")</script>',
    alamat: 'Jl. Pemuda No. 10',
    kota: 'Jakarta',
    bendahara: 'Ustadzah Sarah & Tim',
    kepala: 'Ustadz Ahmad, M.Pd',
    logo_rel_path: null,
    diubah_pada: '2026-01-01T00:00:00Z',
  };

  const mockSiswa: Siswa = {
    id: 10,
    nomor: 'SIS-2026-000001',
    nis: 'NIS/001',
    nama: 'Budi Santoso & Partner',
    alamat: 'Jl. Merdeka',
    status: 'aktif',
    kelas_id: 1,
    kelas_nama: '1A',
    saldo: 250000,
    dibuat_pada: '2026-01-01T00:00:00Z',
  };

  const mockTransaksi: Transaksi = {
    id: 1,
    nomor_bukti: 'TRX-2026-000001',
    siswa_id: 10,
    kelas_id: 1,
    tanggal: '2026-10-01',
    jenis: 'setoran',
    nilai: 50000,
    saldo_setelah: 250000,
    keterangan: 'Tabungan awal <aman>',
    membalik_id: null,
    impor_id: null,
    dibuat_pada: '2026-10-01T08:00:00Z',
  };

  describe('esc() helper (XSS prevention - NFR-07)', () => {
    it('meng-escape karakter berbahaya HTML', () => {
      expect(esc('<script>alert("x") & \'test\'</script>')).toBe(
        '&lt;script&gt;alert(&quot;x&quot;) &amp; &#039;test&#039;&lt;/script&gt;'
      );
    });

    it('menangani nilai null dan undefined', () => {
      expect(esc(null)).toBe('');
      expect(esc(undefined)).toBe('');
    });
  });

  describe('generateReceiptHtml (CAP-09)', () => {
    it('menghasilkan HTML struk dengan data ter-escape dan nominal rupiah', () => {
      const html = generateReceiptHtml(mockTransaksi, mockSiswa, mockProfil, '80');
      expect(html).toContain('TRX-2026-000001');
      expect(html).toContain('Budi Santoso &amp; Partner');
      expect(html).toContain('Rp 50.000');
      expect(html).toContain('Rp 250.000');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('generateLaporanKelasHtml (CAP-11)', () => {
    it('menghasilkan HTML laporan rekap kelas beserta total', () => {
      const data: ItemRekapKelas[] = [
        { kelas_id: 1, kelas_nama: '1A', tingkat: 1, jumlah_siswa: 20, total_setoran: 1000000, total_penarikan: 200000, total_saldo: 800000 },
        { kelas_id: 2, kelas_nama: '1B', tingkat: 1, jumlah_siswa: 25, total_setoran: 1500000, total_penarikan: 500000, total_saldo: 1000000 },
      ];
      const html = generateLaporanKelasHtml(mockProfil, data, '2026/2027');
      expect(html).toContain('Kelas 1A');
      expect(html).toContain('Kelas 1B');
      expect(html).toContain('45'); // total siswa
      expect(html).toContain('Rp 1.800.000'); // total saldo
      expect(html).toContain('Ustadz Ahmad, M.Pd');
    });
  });

  describe('generateLaporanSiswaHtml (CAP-11)', () => {
    it('menghasilkan HTML laporan rekap siswa', () => {
      const data: ItemLaporanSiswa[] = [
        { siswa_id: 10, nomor: 'SIS-001', nis: '001', nama: 'Budi', kelas_nama: '1A', status: 'aktif', total_setoran: 100000, total_penarikan: 0, saldo_akhir: 100000 },
      ];
      const html = generateLaporanSiswaHtml(mockProfil, data, 'Kelas: 1A');
      expect(html).toContain('SIS-001');
      expect(html).toContain('Budi');
      expect(html).toContain('Rp 100.000');
    });
  });

  describe('generateLaporanTransaksiHtml (CAP-11)', () => {
    it('menghasilkan HTML laporan transaksi periode', () => {
      const data: ItemLaporanTransaksi[] = [
        { id: 1, nomor_bukti: 'TRX-001', tanggal: '2026-10-01', siswa_nama: 'Budi', siswa_nomor: 'SIS-001', kelas_nama: '1A', jenis: 'setoran', nilai: 50000, saldo_setelah: 50000, keterangan: null },
      ];
      const html = generateLaporanTransaksiHtml(mockProfil, data, '2026-10-01', '2026-10-01');
      expect(html).toContain('TRX-001');
      expect(html).toContain('Rp 50.000');
      expect(html).toContain('Periode:');
    });
  });

  describe('generateBukuBesarSiswaHtml (CAP-10)', () => {
    it('menghasilkan HTML buku besar statement siswa', () => {
      const trx: Transaksi[] = [
        mockTransaksi,
        {
          id: 2,
          nomor_bukti: 'TRX-2026-000002',
          siswa_id: 10,
          kelas_id: 1,
          tanggal: '2026-10-02',
          jenis: 'penarikan',
          nilai: -20000,
          saldo_setelah: 230000,
          keterangan: 'Beli buku',
          membalik_id: null,
          impor_id: null,
          dibuat_pada: '2026-10-02T08:00:00Z',
        },
      ];
      const html = generateBukuBesarSiswaHtml(mockProfil, mockSiswa, trx);
      expect(html).toContain('Buku Besar');
      expect(html).toContain('Budi Santoso &amp; Partner');
      expect(html).toContain('TRX-2026-000001');
      expect(html).toContain('TRX-2026-000002');
      expect(html).toContain('Rp 20.000');
    });
  });
});
