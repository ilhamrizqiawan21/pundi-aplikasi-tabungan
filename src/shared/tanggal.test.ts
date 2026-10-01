import { describe, it, expect } from 'vitest';
import {
  hariIniLokal,
  formatTanggalIndonesia,
  formatWaktuWib,
  timestampWib,
  ZONA_WAKTU_WIB,
} from './tanggal.js';

describe('Utilitas Tanggal & Waktu (Asia/Jakarta / WIB)', () => {
  it('zona waktu terdefinisi sebagai Asia/Jakarta', () => {
    expect(ZONA_WAKTU_WIB).toBe('Asia/Jakarta');
  });

  describe('hariIniLokal', () => {
    it('memakai tanggal WIB: pukul 03.30 WIB tanggal 2 Maret (UTC 20.30 1 Maret)', () => {
      const dini = new Date('2026-03-01T20:30:00Z'); // 2 Maret 2026 03.30 WIB
      expect(dini.toISOString().substring(0, 10)).toBe('2026-03-01'); // UTC
      expect(hariIniLokal(dini)).toBe('2026-03-02'); // WIB
    });

    it('memberi angka nol di depan bulan dan hari', () => {
      expect(hariIniLokal(new Date('2026-01-05T05:00:00Z'))).toBe('2026-01-05');
    });
  });

  describe('formatTanggalIndonesia', () => {
    it('memformat tanggal string YYYY-MM-DD ke teks bahasa Indonesia', () => {
      expect(formatTanggalIndonesia('2026-10-01')).toBe('1 Oktober 2026');
    });

    it('memformat Date objek menurut WIB', () => {
      const date = new Date('2026-03-01T20:30:00Z'); // 2 Maret 2026 WIB
      expect(formatTanggalIndonesia(date)).toBe('2 Maret 2026');
    });
  });

  describe('formatWaktuWib', () => {
    it('memformat tanggal dan waktu dalam WIB', () => {
      const date = new Date('2026-10-01T01:07:23Z'); // 08:07:23 WIB
      const hasil = formatWaktuWib(date);
      expect(hasil).toContain('2026');
      expect(hasil).toContain('08');
      expect(hasil).toContain('07');
    });
  });

  describe('timestampWib', () => {
    it('menghasilkan format YYYYMMDD_HHmmss sesuai WIB', () => {
      const date = new Date('2026-03-01T20:30:45Z'); // 2 Maret 2026 03:30:45 WIB
      expect(timestampWib(date)).toBe('20260302_033045');
    });
  });
});
