export const ZONA_WAKTU_WIB = 'Asia/Jakarta';

/** Tanggal hari ini menurut zona waktu Asia/Jakarta (WIB) dalam format YYYY-MM-DD. */
export function hariIniLokal(sekarang: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_WAKTU_WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(sekarang);
}

/** Format tanggal ke bahasa Indonesia dalam zona waktu Asia/Jakarta (WIB). */
export function formatTanggalIndonesia(
  tanggal: string | Date,
  opsi: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
): string {
  const d =
    typeof tanggal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tanggal)
      ? new Date(`${tanggal}T00:00:00+07:00`)
      : new Date(tanggal);

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONA_WAKTU_WIB,
    ...opsi,
  }).format(d);
}

/** Format tanggal dan waktu lengkap dalam zona waktu Asia/Jakarta (WIB). */
export function formatWaktuWib(
  tanggal: string | Date,
  opsi: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }
): string {
  const d = new Date(tanggal);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONA_WAKTU_WIB,
    ...opsi,
  }).format(d);
}

/** Format timestamp YYYYMMDD_HHmmss dalam zona waktu Asia/Jakarta (WIB) untuk penamaan berkas. */
export function timestampWib(sekarang: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_WAKTU_WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(sekarang);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}${get('month')}${get('day')}_${get('hour')}${get('minute')}${get('second')}`;
}
