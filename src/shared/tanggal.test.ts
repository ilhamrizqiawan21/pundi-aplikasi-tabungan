import { describe, it, expect, afterEach } from 'vitest';
import { hariIniLokal } from './tanggal.js';

describe('hariIniLokal', () => {
  const tzAwal = process.env.TZ;
  afterEach(() => {
    if (tzAwal === undefined) delete process.env.TZ;
    else process.env.TZ = tzAwal;
  });

  it('memakai tanggal lokal: pukul 03.30 WIB masih tanggal yang sama dengan jam dinding, bukan tanggal UTC', () => {
    process.env.TZ = 'Asia/Jakarta';
    const dini = new Date('2026-03-01T20:30:00Z'); // 2 Maret 2026 03.30 WIB
    expect(dini.toISOString().substring(0, 10)).toBe('2026-03-01'); // perilaku lama yang keliru
    expect(hariIniLokal(dini)).toBe('2026-03-02');
  });

  it('memberi angka nol di depan bulan dan hari', () => {
    process.env.TZ = 'Asia/Jakarta';
    expect(hariIniLokal(new Date('2026-01-05T05:00:00Z'))).toBe('2026-01-05');
  });
});
