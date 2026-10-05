/** Aturan PIN aplikasi (CAP-16): tepat 6 angka, bukan pola yang mudah ditebak. Dipakai proses utama dan layar. */
export const PANJANG_PIN = 6;

export function galatPin(pin: string): string | null {
  if (!new RegExp(`^\\d{${PANJANG_PIN}}$`).test(pin)) return `PIN harus ${PANJANG_PIN} angka.`;
  if (/^(\d)\1+$/.test(pin)) return 'PIN terlalu mudah ditebak (angka sama semua).';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'PIN terlalu mudah ditebak (angka berurutan).';
  return null;
}
