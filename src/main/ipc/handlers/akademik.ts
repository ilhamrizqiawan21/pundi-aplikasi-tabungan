import {
  IdSchema,
  TahunAjaranSimpanSchema,
  KelasSimpanSchema,
  KelasSalinSchema,
  TahunAjaranOpsionalSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';

export function registerAkademikHandlers(ctx: IpcContext): void {
  const { handle, akademik } = ctx;

  handle('akademik.tahunAjaranDaftar', null, () => akademik.tahunAjaranDaftar());
  handle('akademik.tahunAjaranSimpan', TahunAjaranSimpanSchema, (data) =>
    akademik.tahunAjaranSimpan(data)
  );
  handle('akademik.tahunAjaranHapus', IdSchema, (data) => akademik.tahunAjaranHapus(data.id));
  handle('akademik.kelasDaftar', TahunAjaranOpsionalSchema, (data) =>
    akademik.kelasDaftar(data.tahunAjaranId ?? undefined)
  );
  handle('akademik.kelasSimpan', KelasSimpanSchema, (data) =>
    akademik.kelasSimpan(data)
  );
  handle('akademik.kelasSalin', KelasSalinSchema, (data) => akademik.kelasSalin(data.dari_id, data.ke_id));
  handle('akademik.kelasHapus', IdSchema, (data) => akademik.kelasHapus(data.id));
}

