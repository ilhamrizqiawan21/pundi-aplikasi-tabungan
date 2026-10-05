import { getDb } from '../db/index.js';
import type { ItemAktivitas, Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

/** Riwayat aktivitas (hanya baca). `ringkasan` tidak memuat nama atau nominal (NFR-02), jadi aman ditampilkan. */
export class AuditService {
  public daftar(filter: { limit?: number; sebelumId?: number }): Result<ItemAktivitas[]> {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 200);
    try {
      const rows = getDb()
        .prepare(
          `SELECT id, waktu, aksi, entitas, entitas_id, ringkasan FROM audit_log
           ${filter.sebelumId ? 'WHERE id < ?' : ''}
           ORDER BY id DESC LIMIT ?`
        )
        .all(...(filter.sebelumId ? [filter.sebelumId, limit] : [limit])) as ItemAktivitas[];
      return { ok: true, data: rows };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
