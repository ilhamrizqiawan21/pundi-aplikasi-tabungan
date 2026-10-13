import { randomUUID } from 'node:crypto';

// Token store untuk jalur file yang dipilih via dialog aman (NFR-07: renderer tidak menerima file path langsung)
// Token kedaluwarsa bila tak dipakai TOKEN_TTL_MS (diperpanjang tiap dipakai) agar tidak menumpuk selama aplikasi berjalan
const TOKEN_TTL_MS = 60 * 60 * 1000;
const fileTokenStore = new Map<string, { jalur: string; kedaluwarsa: number }>();
// Token milik daftar cadangan; dibuang setiap daftar diminta ulang agar tidak menumpuk
const daftarCadanganTokens = new Set<string>();

export function mintToken(realPath: string): string {
  const sekarang = Date.now();
  for (const [t, v] of fileTokenStore) {
    if (v.kedaluwarsa <= sekarang) fileTokenStore.delete(t);
  }
  const token = `token_${randomUUID()}`;
  fileTokenStore.set(token, { jalur: realPath, kedaluwarsa: sekarang + TOKEN_TTL_MS });
  return token;
}

/** Jalur untuk token yang masih berlaku (masa berlaku diperpanjang), atau undefined bila tak dikenal/kedaluwarsa. */
export function ambilJalurToken(token: string): string | undefined {
  const v = fileTokenStore.get(token);
  if (!v) return undefined;
  if (v.kedaluwarsa <= Date.now()) {
    fileTokenStore.delete(token);
    return undefined;
  }
  v.kedaluwarsa = Date.now() + TOKEN_TTL_MS;
  return v.jalur;
}

/** Menghapus token dari store (mis. setelah berkas restore diproses). */
export function hapusToken(token: string): void {
  fileTokenStore.delete(token);
}

/** Mengosongkan token daftar cadangan yang lama sebelum menghasilkan token baru. */
export function bersihkanTokenCadangan(): void {
  for (const t of daftarCadanganTokens) {
    fileTokenStore.delete(t);
  }
  daftarCadanganTokens.clear();
}

/** Mencatat token baru sebagai token cadangan. */
export function catatTokenCadangan(token: string): void {
  daftarCadanganTokens.add(token);
}

