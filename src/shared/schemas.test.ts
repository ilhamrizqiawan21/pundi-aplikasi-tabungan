import { describe, it, expect } from 'vitest';
import {
  TransaksiSetorSchema,
  LaporanTransaksiSchema,
  KasHarianSchema,
  BackupBuatSchema,
  PilihFileSchema,
} from './schemas.js';
import { tanggalKalenderValid } from './tanggal.js';

describe('tanggalKalenderValid', () => {
  it('menerima tanggal nyata termasuk 29 Februari kabisat', () => {
    expect(tanggalKalenderValid('2026-10-04')).toBe(true);
    expect(tanggalKalenderValid('2028-02-29')).toBe(true);
  });
  it('menolak tanggal yang tidak ada atau salah format', () => {
    for (const v of ['2026-02-29', '2026-02-30', '2026-00-10', '2026-13-01', '2026-1-1', '', '2026-10-04T00:00', '1999-12-31']) {
      expect(tanggalKalenderValid(v), v).toBe(false);
    }
  });
});

describe('skema IPC', () => {
  it('setoran: nominal harus bilangan bulat aman positif, tanggal harus ada di kalender', () => {
    const ok = { siswa_id: 1, nominal: 5000, tanggal: '2026-03-01' };
    expect(TransaksiSetorSchema.safeParse(ok).success).toBe(true);
    expect(TransaksiSetorSchema.safeParse({ ...ok, nominal: 1.5 }).success).toBe(false);
    expect(TransaksiSetorSchema.safeParse({ ...ok, nominal: 0 }).success).toBe(false);
    expect(TransaksiSetorSchema.safeParse({ ...ok, nominal: 2 ** 60 }).success).toBe(false);
    expect(TransaksiSetorSchema.safeParse({ ...ok, tanggal: '2026-02-30' }).success).toBe(false);
  });
  it('laporan transaksi menolak rentang terbalik dan tanggal fiktif', () => {
    expect(LaporanTransaksiSchema.safeParse({ dari: '2026-03-02', sampai: '2026-03-01' }).success).toBe(false);
    expect(LaporanTransaksiSchema.safeParse({ dari: '2026-02-30', sampai: '2026-03-01' }).success).toBe(false);
  });
  it('handler yang dulu tanpa skema kini memvalidasi masukan', () => {
    expect(KasHarianSchema.safeParse(undefined).success).toBe(true);
    expect(KasHarianSchema.safeParse({ tanggal: 'bukan tanggal' }).success).toBe(false);
    expect(BackupBuatSchema.safeParse({ keterangan: 'x'.repeat(41) }).success).toBe(false);
    expect(PilihFileSchema.safeParse({ ekstensi: ['*'] }).success).toBe(false);
    expect(PilihFileSchema.safeParse({ ekstensi: ['xlsx', 'csv'] }).success).toBe(true);
  });
});
