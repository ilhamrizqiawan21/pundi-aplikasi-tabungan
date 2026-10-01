import { describe, it, expect } from 'vitest';
import { formatRupiah, formatAngkaRibuan, parseRupiah, isValidNominal } from './rupiah.js';

describe('shared/rupiah', () => {
  describe('formatRupiah', () => {
    it('memformat bilangan positif dengan benar', () => {
      expect(formatRupiah(0)).toBe('Rp 0');
      expect(formatRupiah(50000)).toBe('Rp 50.000');
      expect(formatRupiah(1250000)).toBe('Rp 1.250.000');
      expect(formatRupiah(10000000)).toBe('Rp 10.000.000');
    });

    it('memformat bilangan negatif dengan benar', () => {
      expect(formatRupiah(-50000)).toBe('-Rp 50.000');
      expect(formatRupiah(-1250000)).toBe('-Rp 1.250.000');
    });

    it('membulatkan angka jika desimal tidak sengaja masuk', () => {
      expect(formatRupiah(50000.75)).toBe('Rp 50.001');
    });
  });

  describe('formatAngkaRibuan', () => {
    it('memformat angka murni tanpa awalan Rp', () => {
      expect(formatAngkaRibuan(1250000)).toBe('1.250.000');
      expect(formatAngkaRibuan(-50000)).toBe('-50.000');
    });
  });

  describe('parseRupiah', () => {
    it('mem-parse teks berformat dengan benar', () => {
      expect(parseRupiah('Rp 1.250.000')).toBe(1250000);
      expect(parseRupiah('50.000')).toBe(50000);
      expect(parseRupiah('Rp 50000')).toBe(50000);
      expect(parseRupiah('-Rp 50.000')).toBe(-50000);
      expect(parseRupiah('')).toBe(0);
      expect(parseRupiah('abc')).toBe(0);
      expect(parseRupiah(1250000)).toBe(1250000);
    });
  });

  describe('isValidNominal', () => {
    it('memvalidasi nominal yang sah', () => {
      expect(isValidNominal(10000)).toBe(true);
      expect(isValidNominal(1)).toBe(true);
      expect(isValidNominal(0)).toBe(false);
      expect(isValidNominal(-5000)).toBe(false);
      expect(isValidNominal(5000.5)).toBe(false);
      expect(isValidNominal('50000')).toBe(false);
      expect(isValidNominal(null)).toBe(false);
      expect(isValidNominal(undefined)).toBe(false);
    });
  });
});

import { parseRupiahKetat } from './rupiah.js';

describe('parseRupiahKetat (impor saldo)', () => {
  it('menerima bentuk yang wajar dan menghasilkan bilangan bulat', () => {
    const ok = (x: unknown) => parseRupiahKetat(x);
    expect(ok(1250000)).toEqual({ ok: true, nilai: 1250000 });
    expect(ok('1250000')).toEqual({ ok: true, nilai: 1250000 });
    expect(ok('Rp 1.250.000')).toEqual({ ok: true, nilai: 1250000 });
    expect(ok('Rp. 50.000,00')).toEqual({ ok: true, nilai: 50000 });
    expect(ok('1,250,000')).toEqual({ ok: true, nilai: 1250000 });
    expect(ok(' 75.000 ')).toEqual({ ok: true, nilai: 75000 });
    expect(ok(5000.0000001)).toEqual({ ok: true, nilai: 5000 });
  });

  it('kosong, nol, dan strip dianggap 0', () => {
    for (const v of [null, undefined, '', '  ', '-', 0, 'Rp 0']) {
      expect(parseRupiahKetat(v)).toEqual({ ok: true, nilai: 0 });
    }
  });

  it('menolak pecahan, negatif, dan format meragukan alih-alih menebak', () => {
    for (const v of [1250.5, '1.250,50', '1.25', '12.34.56', '-1.000', '(1.000)', 'abc', 'Rp seribu', -5, NaN, Infinity, {}, true]) {
      expect(parseRupiahKetat(v).ok).toBe(false);
    }
  });

  it('menolak angka di atas batas aman', () => {
    expect(parseRupiahKetat('9999999999999999999').ok).toBe(false);
    expect(parseRupiahKetat(Number.MAX_SAFE_INTEGER + 2).ok).toBe(false);
  });
});
