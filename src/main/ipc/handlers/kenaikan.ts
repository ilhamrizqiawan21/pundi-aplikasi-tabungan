import {
  KenaikanDaftarSchema,
  KenaikanTerapkanSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';

export function registerKenaikanHandlers(ctx: IpcContext): void {
  const { handle, kenaikan } = ctx;

  handle('kenaikan.daftar', KenaikanDaftarSchema, (data) =>
    kenaikan.daftar(data.kelas_asal_id, data.tahun_ajaran_tujuan_id)
  );
  handle('kenaikan.terapkan', KenaikanTerapkanSchema, (data) => kenaikan.terapkan(data));
}

