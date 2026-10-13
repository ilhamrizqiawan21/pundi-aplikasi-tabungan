import {
  SiswaCariSchema,
  SiswaSimpanSchema,
  IdSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';

export function registerSiswaHandlers(ctx: IpcContext): void {
  const { handle, siswa } = ctx;

  handle('siswa.cari', SiswaCariSchema, (data) =>
    siswa.cari(data.query, data.kelasId, data.status)
  );
  handle('siswa.detail', IdSchema, (data) => siswa.detail(data.id));
  handle('siswa.simpan', SiswaSimpanSchema, (data) => siswa.simpan(data));
  handle('siswa.hapus', IdSchema, (data) => siswa.hapus(data.id));
}

