/**
 * Utilitas format dan parsing Rupiah (NFR-03, NFR-09)
 * Nominal selalu bilangan bulat (integer), tidak pernah float/desimal.
 */

/**
 * Format bilangan bulat rupiah menjadi teks "Rp 1.250.000" atau "-Rp 50.000"
 */
export function formatRupiah(amount: number): string {
  if (!Number.isInteger(amount)) {
    amount = Math.round(amount);
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Format bilangan bulat rupiah untuk tabel/laporan angka murni (mis. "1.250.000")
 */
export function formatAngkaRibuan(amount: number): string {
  if (!Number.isInteger(amount)) {
    amount = Math.round(amount);
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse teks masukan pengguna menjadi bilangan bulat rupiah.
 * Mengabaikan "Rp", spasi, dan titik ribuan.
 * Mengembalikan 0 jika tidak ada angka valid.
 */
export function parseRupiah(input: string | number): number {
  if (typeof input === 'number') {
    return Number.isInteger(input) ? input : Math.round(input);
  }
  if (!input || typeof input !== 'string') {
    return 0;
  }
  // Bersihkan karakter selain digit dan tanda minus
  const cleaned = input.replace(/[^\d-]/g, '');
  if (!cleaned || cleaned === '-') {
    return 0;
  }
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Memastikan nilai adalah nominal uang yang valid:
 * Bilangan bulat positif > 0 dan di bawah batas aman integer (2^53 - 1)
 */
export function isValidNominal(amount: unknown): amount is number {
  return (
    typeof amount === 'number' &&
    Number.isInteger(amount) &&
    amount > 0 &&
    amount <= Number.MAX_SAFE_INTEGER
  );
}

export type HasilParseRupiah = { ok: true; nilai: number } | { ok: false; alasan: string };

/**
 * Pengurai nominal ketat untuk data dari berkas (impor): menolak pecahan, negatif, dan format yang meragukan
 * alih-alih menebak. Kosong atau "-" dianggap 0. Menerima angka Excel, "1250000", "Rp 1.250.000", "1,250,000",
 * serta ",00"/".00" di belakang. Berbeda dengan parseRupiah yang longgar (mis. "1.250,50" menjadi 125050).
 */
export function parseRupiahKetat(input: unknown): HasilParseRupiah {
  if (input === null || input === undefined) return { ok: true, nilai: 0 };

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return { ok: false, alasan: 'Nominal tidak valid' };
    const bulat = Math.round(input);
    if (Math.abs(input - bulat) > 1e-6) return { ok: false, alasan: 'Nominal harus bilangan bulat rupiah (tanpa sen)' };
    if (bulat < 0) return { ok: false, alasan: 'Nominal tidak boleh negatif' };
    if (bulat > Number.MAX_SAFE_INTEGER) return { ok: false, alasan: 'Nominal terlalu besar' };
    return { ok: true, nilai: bulat };
  }

  if (typeof input !== 'string') return { ok: false, alasan: 'Nominal tidak dikenali' };

  let s = input.replace(/ /g, ' ').trim().replace(/^rp\.?\s*/i, '').trim();
  if (s === '' || s === '-') return { ok: true, nilai: 0 };
  if (/^[-(]/.test(s)) return { ok: false, alasan: 'Nominal tidak boleh negatif' };

  s = s.replace(/[,.]0{1,2}$/, ''); // ",00" atau ".00" di belakang

  let digit: string;
  if (/^\d+$/.test(s)) digit = s;
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) digit = s.replace(/\./g, '');
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) digit = s.replace(/,/g, '');
  else return { ok: false, alasan: `Format nominal tidak dikenali: "${input.trim()}"` };

  const nilai = Number(digit);
  if (!Number.isSafeInteger(nilai)) return { ok: false, alasan: 'Nominal terlalu besar' };
  return { ok: true, nilai };
}
