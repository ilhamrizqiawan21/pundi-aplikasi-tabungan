import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ZodError } from 'zod';
import { LedgerService } from '../services/ledger.js';
import { SiswaService } from '../services/siswa.js';
import { AkademikService } from '../services/akademik.js';
import { PengaturanService } from '../services/pengaturan.js';
import { IntegritasService } from '../services/integritas.js';
import { BackupService } from '../services/backup.js';
import { LaporanService } from '../services/laporan.js';
import { ImporService } from '../services/impor.js';
import { KenaikanService } from '../services/kenaikan.js';
import { AuditService } from '../services/audit.js';
import { KunciService } from '../services/kunci.js';
import { isTrustedSender } from '../security.js';
import { trustedConfig } from '../window.js';
import type { IpcOptions, HandleFn, IpcContext } from './types.js';

import { registerKunciHandlers } from './handlers/kunci.js';
import { registerSiswaHandlers } from './handlers/siswa.js';
import { registerAkademikHandlers } from './handlers/akademik.js';
import { registerKenaikanHandlers } from './handlers/kenaikan.js';
import { registerTransaksiHandlers } from './handlers/transaksi.js';
import { registerLaporanHandlers } from './handlers/laporan.js';
import { registerPengaturanHandlers } from './handlers/pengaturan.js';
import { registerImporHandlers } from './handlers/impor.js';
import { registerBackupHandlers } from './handlers/backup.js';
import { registerCetakHandlers } from './handlers/cetak.js';

export type { IpcOptions } from './types.js';

// Saat aplikasi terkunci, hanya saluran ini yang boleh dipanggil renderer (CAP-16)
const SALURAN_BEBAS_KUNCI = new Set(['kunci.status', 'kunci.buka', 'kunci.pulihkan']);

function verifySender(event: IpcMainInvokeEvent): boolean {
  return isTrustedSender(event.senderFrame, trustedConfig());
}

export function registerIpcHandlers(opts: IpcOptions): void {
  const kunci = new KunciService(opts.kunciDir);

  const handle: HandleFn = (channel, schema, handler) => {
    ipcMain.handle(channel, async (event, rawInput) => {
      if (!verifySender(event)) {
        return { ok: false, kode: 'AKSES_DITOLAK', pesan: 'Pengirim IPC tidak diizinkan.' };
      }
      // Gerbang kunci di proses utama, bukan hanya di layar: renderer yang terkunci tidak bisa membaca atau menulis data
      if (kunci.terkunci() && !SALURAN_BEBAS_KUNCI.has(channel)) {
        return { ok: false, kode: 'TERKUNCI', pesan: 'Aplikasi terkunci. Masukkan PIN terlebih dahulu.' };
      }

      try {
        const validated = schema ? schema.parse(rawInput) : rawInput;
        return await handler(validated, event);
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          return { ok: false, kode: 'VALIDASI_GAGAL', pesan: err.issues[0]?.message ?? 'Parameter tidak valid.' };
        }
        // Galat tak terduga: pesan mentah (bisa memuat SQL/jalur) tidak dikirim ke renderer; log hanya kode (NFR-02)
        const errCode = (err as { code?: string }).code ?? 'TAK_DIKENAL';
        if (opts.logger) {
          opts.logger.error('IPC_ERROR', { kode: channel, keterangan: errCode });
        }
        console.error(`ipc ${channel} gagal:`, errCode);
        return { ok: false, kode: 'DATABASE_ERROR', pesan: 'Terjadi kesalahan pada aplikasi.' };
      }
    });
  };

  const ctx: IpcContext = {
    ledger: new LedgerService(),
    siswa: new SiswaService(),
    akademik: new AkademikService(),
    pengaturan: new PengaturanService(),
    integritas: new IntegritasService(),
    backup: new BackupService(opts.backupDir),
    laporan: new LaporanService(),
    impor: new ImporService(),
    kenaikan: new KenaikanService(),
    audit: new AuditService(),
    kunci,
    logger: opts.logger,
    handle,
  };

  registerKunciHandlers(ctx);
  registerSiswaHandlers(ctx);
  registerAkademikHandlers(ctx);
  registerKenaikanHandlers(ctx);
  registerTransaksiHandlers(ctx);
  registerLaporanHandlers(ctx);
  registerPengaturanHandlers(ctx);
  registerImporHandlers(ctx);
  registerBackupHandlers(ctx);
  registerCetakHandlers(ctx);
}
