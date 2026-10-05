import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Result, StatusKunci } from '../../shared/types.js';
import { galatPin } from '../../shared/pin.js';

interface Rahasia {
  salt: string;
  hash: string;
}

interface BerkasKunci {
  versi: 1;
  pin: Rahasia;
  pemulihan: Rahasia;
  /** Salah berturut-turut sejak percobaan benar terakhir (PIN maupun kode pemulihan). */
  gagal: number;
  /** Epoch ms sampai kapan percobaan ditolak; 0 bila tidak sedang dikunci sementara. */
  kunci_sampai: number;
}

// Setelah 5 kali salah, jeda 30 detik lalu berlipat ganda per kesalahan, maksimal 15 menit.
const BATAS_GRATIS = 5;
const JEDA_AWAL_DETIK = 30;
const JEDA_MAKS_DETIK = 15 * 60;
const ABJAD_PEMULIHAN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I, O, 0, 1 agar mudah dibaca

function hashRahasia(teks: string, saltHex?: string): Rahasia {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(teks, salt, 32);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

function cocok(teks: string, r: Rahasia): boolean {
  const kandidat = Buffer.from(hashRahasia(teks, r.salt).hash, 'hex');
  const asli = Buffer.from(r.hash, 'hex');
  return kandidat.length === asli.length && crypto.timingSafeEqual(kandidat, asli);
}

/** 16 karakter acak (80 bit) dalam empat kelompok, mis. "ABCD-EFGH-JKLM-NPQR". */
function buatKodePemulihan(): string {
  const bytes = crypto.randomBytes(16);
  let kode = '';
  for (let i = 0; i < 16; i++) kode += ABJAD_PEMULIHAN[bytes[i] % ABJAD_PEMULIHAN.length];
  return kode.match(/.{4}/g)!.join('-');
}

const normalisasiKode = (kode: string) => kode.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Kunci aplikasi dengan PIN (CAP-16, ARCHITECTURE A-08). Hash PIN dan kode pemulihan disimpan di berkas
 * `kunci.json` di folder data pengguna (di luar basis data, jadi memulihkan cadangan tidak mengubahnya).
 * Status "terbuka" hanya ada di memori proses utama; setiap aplikasi dibuka, keadaannya terkunci.
 */
export class KunciService {
  private readonly berkas: string;
  private terbuka = false;

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.berkas = path.join(dir, 'kunci.json');
  }

  /** null = PIN tidak aktif; 'rusak' = berkas ada tetapi tidak terbaca (dianggap terkunci, tidak dibuka diam-diam). */
  private baca(): BerkasKunci | null | 'rusak' {
    if (!fs.existsSync(this.berkas)) return null;
    try {
      const b = JSON.parse(fs.readFileSync(this.berkas, 'utf8')) as BerkasKunci;
      if (b.versi !== 1 || !b.pin?.hash || !b.pemulihan?.hash) return 'rusak';
      return b;
    } catch {
      return 'rusak';
    }
  }

  private tulis(b: BerkasKunci): void {
    const sementara = `${this.berkas}.tmp`;
    fs.writeFileSync(sementara, JSON.stringify(b), { mode: 0o600 });
    fs.renameSync(sementara, this.berkas);
  }

  public terkunci(): boolean {
    return this.baca() !== null && !this.terbuka;
  }

  public status(): Result<StatusKunci> {
    const b = this.baca();
    const aktif = b !== null;
    const tunggu = b && b !== 'rusak' ? Math.max(0, Math.ceil((b.kunci_sampai - Date.now()) / 1000)) : 0;
    return { ok: true, data: { aktif, terbuka: !aktif || this.terbuka, tunggu_detik: tunggu } };
  }

  /** Mengunci kembali sekarang (hanya berarti bila PIN aktif). */
  public kunciSekarang(): Result<null> {
    this.terbuka = false;
    return { ok: true, data: null };
  }

  /** Mengaktifkan PIN. Mengembalikan kode pemulihan sekali ini saja; tidak dapat dilihat lagi. */
  public atur(pin: string): Result<{ kode_pemulihan: string }> {
    if (this.baca() !== null) {
      return { ok: false, kode: 'PIN_SUDAH_AKTIF', pesan: 'PIN sudah aktif. Gunakan Ubah PIN.' };
    }
    const g = galatPin(pin);
    if (g) return { ok: false, kode: 'PIN_TIDAK_VALID', pesan: g };
    const kode = buatKodePemulihan();
    this.tulis({ versi: 1, pin: hashRahasia(pin), pemulihan: hashRahasia(normalisasiKode(kode)), gagal: 0, kunci_sampai: 0 });
    this.terbuka = true;
    return { ok: true, data: { kode_pemulihan: kode } };
  }

  /**
   * Memeriksa rahasia dengan pembatasan percobaan. Berhasil: hitungan salah direset. Salah: hitungan naik dan,
   * mulai kesalahan ke-5, percobaan berikutnya ditolak selama jeda yang makin panjang.
   */
  private periksa(
    teks: string,
    ambil: (b: BerkasKunci) => Rahasia,
    pesanSalah: string,
    kodeSalah: string
  ): Result<BerkasKunci> {
    const b = this.baca();
    if (b === null) return { ok: false, kode: 'PIN_TIDAK_AKTIF', pesan: 'PIN belum diaktifkan.' };
    if (b === 'rusak') {
      return { ok: false, kode: 'KUNCI_RUSAK', pesan: 'Berkas kunci rusak. Pulihkan cadangan folder data atau hubungi pengembang.' };
    }
    const sisa = Math.ceil((b.kunci_sampai - Date.now()) / 1000);
    if (sisa > 0) {
      return { ok: false, kode: 'TERKUNCI_SEMENTARA', pesan: `Terlalu banyak percobaan salah. Coba lagi dalam ${sisa} detik.` };
    }
    if (cocok(teks, ambil(b))) {
      if (b.gagal !== 0 || b.kunci_sampai !== 0) {
        b.gagal = 0;
        b.kunci_sampai = 0;
        this.tulis(b);
      }
      return { ok: true, data: b };
    }
    b.gagal += 1;
    if (b.gagal >= BATAS_GRATIS) {
      const jeda = Math.min(JEDA_AWAL_DETIK * 2 ** (b.gagal - BATAS_GRATIS), JEDA_MAKS_DETIK);
      b.kunci_sampai = Date.now() + jeda * 1000;
    }
    this.tulis(b);
    const sisaGratis = BATAS_GRATIS - b.gagal;
    return {
      ok: false,
      kode: kodeSalah,
      pesan: sisaGratis > 0 ? `${pesanSalah} Sisa percobaan sebelum dijeda: ${sisaGratis}.` : `${pesanSalah} Percobaan berikutnya dijeda.`,
    };
  }

  public buka(pin: string): Result<null> {
    const r = this.periksa(pin, (b) => b.pin, 'PIN salah.', 'PIN_SALAH');
    if (!r.ok) return r;
    this.terbuka = true;
    return { ok: true, data: null };
  }

  public ubah(pinLama: string, pinBaru: string): Result<null> {
    const g = galatPin(pinBaru);
    if (g) return { ok: false, kode: 'PIN_TIDAK_VALID', pesan: g };
    const r = this.periksa(pinLama, (b) => b.pin, 'PIN lama salah.', 'PIN_SALAH');
    if (!r.ok) return r;
    this.tulis({ ...r.data, pin: hashRahasia(pinBaru) });
    return { ok: true, data: null };
  }

  /** Mematikan PIN setelah PIN benar dimasukkan. */
  public matikan(pin: string): Result<null> {
    const r = this.periksa(pin, (b) => b.pin, 'PIN salah.', 'PIN_SALAH');
    if (!r.ok) return r;
    fs.unlinkSync(this.berkas);
    this.terbuka = true;
    return { ok: true, data: null };
  }

  /** Lupa PIN: kode pemulihan membuka kunci dan menetapkan PIN baru; kode lama hangus dan diganti kode baru. */
  public pulihkan(kode: string, pinBaru: string): Result<{ kode_pemulihan: string }> {
    const g = galatPin(pinBaru);
    if (g) return { ok: false, kode: 'PIN_TIDAK_VALID', pesan: g };
    const r = this.periksa(normalisasiKode(kode), (b) => b.pemulihan, 'Kode pemulihan salah.', 'KODE_SALAH');
    if (!r.ok) return r;
    const kodeBaru = buatKodePemulihan();
    this.tulis({ versi: 1, pin: hashRahasia(pinBaru), pemulihan: hashRahasia(normalisasiKode(kodeBaru)), gagal: 0, kunci_sampai: 0 });
    this.terbuka = true;
    return { ok: true, data: { kode_pemulihan: kodeBaru } };
  }
}
