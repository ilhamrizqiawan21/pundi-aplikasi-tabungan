import type { IpcMainInvokeEvent } from 'electron';
import type { LedgerService } from '../services/ledger.js';
import type { SiswaService } from '../services/siswa.js';
import type { AkademikService } from '../services/akademik.js';
import type { PengaturanService } from '../services/pengaturan.js';
import type { IntegritasService } from '../services/integritas.js';
import type { BackupService } from '../services/backup.js';
import type { LaporanService } from '../services/laporan.js';
import type { ImporService } from '../services/impor.js';
import type { KenaikanService } from '../services/kenaikan.js';
import type { AuditService } from '../services/audit.js';
import type { KunciService } from '../services/kunci.js';
import type { FileLogger } from '../logger.js';
import type { Result } from '../../shared/types.js';

export interface IpcOptions {
  /** Folder cadangan, di dalam folder data pengguna. */
  backupDir: string;
  /** Folder data pengguna tempat berkas kunci PIN disimpan (di luar basis data). */
  kunciDir: string;
  /** Penulis log berkas lokal (NFR-02 & F7-2). */
  logger?: FileLogger;
}

export type HandleFn = <TInput, TOutput>(
  channel: string,
  schema: { parse: (val: unknown) => TInput } | null,
  handler: (input: TInput, event: IpcMainInvokeEvent) => Result<TOutput> | Promise<Result<TOutput>>
) => void;

export interface IpcContext {
  ledger: LedgerService;
  siswa: SiswaService;
  akademik: AkademikService;
  pengaturan: PengaturanService;
  integritas: IntegritasService;
  backup: BackupService;
  laporan: LaporanService;
  impor: ImporService;
  kenaikan: KenaikanService;
  audit: AuditService;
  kunci: KunciService;
  logger?: FileLogger;
  handle: HandleFn;
}

