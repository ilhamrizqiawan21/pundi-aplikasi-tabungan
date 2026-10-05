import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { KunciService } from './kunci.js';
import { galatPin } from '../../shared/pin.js';
import { KunciAturSchema, KunciPinSchema } from '../../shared/schemas.js';

// CAP-16: kunci aplikasi dengan PIN 6 angka
describe('KunciService (PIN)', () => {
  let dir: string;
  let kunci: KunciService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-kunci-test-'));
    kunci = new KunciService(dir);
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const aktifkan = (pin = '482913') => {
    const r = kunci.atur(pin);
    if (!r.ok) throw new Error(r.pesan);
    return r.data.kode_pemulihan;
  };
  const statusSaatIni = () => {
    const r = kunci.status();
    if (!r.ok) throw new Error('status gagal');
    return r.data;
  };
  const berkas = () => path.join(dir, 'kunci.json');

  it('bawaan: PIN tidak aktif dan aplikasi tidak terkunci', () => {
    expect(statusSaatIni()).toEqual({ aktif: false, terbuka: true, tunggu_detik: 0 });
    expect(kunci.terkunci()).toBe(false);
  });

  it('aturan PIN: tepat 6 angka, bukan angka sama atau berurutan', () => {
    expect(galatPin('482913')).toBeNull();
    for (const buruk of ['12345', '1234567', '12345a', '', '111111', '000000', '123456', '234567', '987654', '654321']) {
      expect(galatPin(buruk), buruk).not.toBeNull();
    }
    expect(KunciAturSchema.safeParse({ pin: '123456' }).success).toBe(false);
    expect(KunciAturSchema.safeParse({ pin: '482913' }).success).toBe(true);
    expect(KunciPinSchema.safeParse({ pin: 'abcdef' }).success).toBe(false);
  });

  it('mengaktifkan PIN: berkas hanya memuat hash, tidak PIN maupun kode pemulihan; sesi langsung terbuka', () => {
    const kode = aktifkan('482913');
    expect(kode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    const isi = fs.readFileSync(berkas(), 'utf8');
    expect(isi).not.toContain('482913');
    expect(isi).not.toContain(kode);
    expect(isi).not.toContain(kode.replace(/-/g, ''));
    expect(statusSaatIni()).toMatchObject({ aktif: true, terbuka: true });
    expect(kunci.atur('591827').ok).toBe(false); // sudah aktif
  });

  it('PIN lemah ditolak saat mengaktifkan, dan PIN tidak jadi aktif', () => {
    const r = kunci.atur('111111');
    expect(r.ok).toBe(false);
    expect(statusSaatIni().aktif).toBe(false);
  });

  it('terkunci setiap aplikasi dibuka (instans baru); PIN benar membuka, salah menolak', () => {
    aktifkan('482913');
    const baru = new KunciService(dir); // seperti aplikasi dibuka ulang
    expect(baru.terkunci()).toBe(true);
    expect(baru.buka('000001').ok).toBe(false);
    expect(baru.terkunci()).toBe(true);
    expect(baru.buka('482913').ok).toBe(true);
    expect(baru.terkunci()).toBe(false);
    baru.kunciSekarang();
    expect(baru.terkunci()).toBe(true);
  });

  it('5 kali salah memicu jeda yang makin panjang, bertahan setelah aplikasi dibuka ulang, lalu reda', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    aktifkan('482913');
    const baru = new KunciService(dir);
    for (let i = 0; i < 5; i++) expect(baru.buka('000001').ok).toBe(false);

    const dijeda = baru.buka('482913'); // benar pun ditolak selama jeda
    expect(dijeda.ok).toBe(false);
    expect(!dijeda.ok && dijeda.kode).toBe('TERKUNCI_SEMENTARA');
    expect(new KunciService(dir).status()).toMatchObject({ ok: true, data: { tunggu_detik: 30 } });

    vi.setSystemTime(new Date('2026-10-05T10:00:31Z'));
    expect(baru.buka('000001').ok).toBe(false); // salah ke-6: jeda 60 detik
    expect(baru.status()).toMatchObject({ data: { tunggu_detik: 60 } });

    vi.setSystemTime(new Date('2026-10-05T10:02:00Z'));
    expect(baru.buka('482913').ok).toBe(true);
    expect(baru.status()).toMatchObject({ data: { tunggu_detik: 0 } });
    // Setelah berhasil, hitungan salah mulai dari nol lagi
    baru.kunciSekarang();
    for (let i = 0; i < 4; i++) baru.buka('000001');
    expect(baru.buka('482913').ok).toBe(true);
  });

  it('jeda tidak melewati 15 menit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    aktifkan('482913');
    for (let i = 0; i < 30; i++) {
      kunci.buka('000001');
      vi.setSystemTime(new Date(Date.now() + 16 * 60 * 1000));
    }
    kunci.buka('000001');
    expect(statusSaatIni().tunggu_detik).toBeLessThanOrEqual(900);
  });

  it('ubah PIN: perlu PIN lama yang benar; PIN lama berhenti berlaku', () => {
    aktifkan('482913');
    expect(kunci.ubah('000001', '591827').ok).toBe(false);
    expect(kunci.ubah('482913', '111111').ok).toBe(false); // baru lemah
    expect(kunci.ubah('482913', '591827').ok).toBe(true);
    const baru = new KunciService(dir);
    expect(baru.buka('482913').ok).toBe(false);
    expect(baru.buka('591827').ok).toBe(true);
  });

  it('matikan PIN: perlu PIN benar, berkas dihapus, aplikasi tidak lagi terkunci', () => {
    aktifkan('482913');
    expect(kunci.matikan('000001').ok).toBe(false);
    expect(fs.existsSync(berkas())).toBe(true);
    expect(kunci.matikan('482913').ok).toBe(true);
    expect(fs.existsSync(berkas())).toBe(false);
    expect(new KunciService(dir).terkunci()).toBe(false);
  });

  it('lupa PIN: kode pemulihan (huruf besar/kecil, tanda hubung bebas) menetapkan PIN baru dan diganti kode baru', () => {
    const kode = aktifkan('482913');
    const baru = new KunciService(dir);
    expect(baru.pulihkan('SALAH-SALAH-SALAH-SALAH', '591827').ok).toBe(false);
    expect(baru.pulihkan(kode, '123456').ok).toBe(false); // PIN baru lemah, kode tidak terpakai

    const r = baru.pulihkan(kode.toLowerCase().replace(/-/g, ' '), '591827');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.kode_pemulihan).not.toBe(kode);
    expect(baru.terkunci()).toBe(false);

    const lagi = new KunciService(dir);
    expect(lagi.buka('482913').ok).toBe(false);
    expect(lagi.buka('591827').ok).toBe(true);
    // Kode lama sudah hangus
    expect(lagi.pulihkan(kode, '374918').ok).toBe(false);
    expect(lagi.pulihkan(r.data.kode_pemulihan, '374918').ok).toBe(true);
  });

  it('percobaan kode pemulihan ikut dibatasi (tidak bisa ditebak tanpa batas)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    const kode = aktifkan('482913');
    for (let i = 0; i < 5; i++) kunci.pulihkan('SALAH-SALAH-SALAH-SALAH', '591827');
    const r = kunci.pulihkan(kode, '591827');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.kode).toBe('TERKUNCI_SEMENTARA');
  });

  it('berkas kunci rusak dianggap terkunci dan tidak dibuka diam-diam', () => {
    aktifkan('482913');
    fs.writeFileSync(berkas(), '{ rusak');
    const baru = new KunciService(dir);
    expect(baru.terkunci()).toBe(true);
    const r = baru.buka('482913');
    expect(!r.ok && r.kode).toBe('KUNCI_RUSAK');
    expect(baru.terkunci()).toBe(true);
  });
});
