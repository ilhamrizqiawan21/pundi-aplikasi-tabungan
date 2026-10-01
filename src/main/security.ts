// Penentuan URL yang sah untuk halaman aplikasi (NFR-07). Sengaja tidak mengimpor electron agar mudah diuji.
import { pathToFileURL } from 'node:url';

export interface TrustedConfig {
  /** Berkas index.html aplikasi (mode terpaket). */
  indexFile: string;
  /** URL server Vite; hanya diisi saat pengembangan. */
  devServerUrl?: string;
}

function stripQueryHash(u: URL): string {
  return `${u.origin === 'null' ? u.protocol + '//' : u.origin}${u.pathname}`;
}

export function isTrustedUrl(url: string, cfg: TrustedConfig): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'file:') {
    // Hanya index.html aplikasi, bukan sembarang berkas lokal.
    return stripQueryHash(parsed) === stripQueryHash(pathToFileURL(cfg.indexFile));
  }

  if (parsed.protocol === 'pundi-app:') {
    return true;
  }

  if (cfg.devServerUrl) {
    try {
      return parsed.origin === new URL(cfg.devServerUrl).origin;
    } catch {
      return false;
    }
  }

  return false;
}

/** Pengirim IPC sah bila berasal dari frame teratas yang memuat halaman aplikasi. */
export function isTrustedSender(
  frame: { url: string; parent: unknown } | null | undefined,
  cfg: TrustedConfig
): boolean {
  if (!frame) return false;
  if (frame.parent) return false;
  return isTrustedUrl(frame.url, cfg);
}
