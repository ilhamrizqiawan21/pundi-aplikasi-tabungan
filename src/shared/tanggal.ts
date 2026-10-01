/** Tanggal hari ini menurut jam komputer pengguna (YYYY-MM-DD), bukan UTC. */
export function hariIniLokal(sekarang: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${sekarang.getFullYear()}-${p(sekarang.getMonth() + 1)}-${p(sekarang.getDate())}`;
}
