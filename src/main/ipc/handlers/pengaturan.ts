import {
  ProfilSekolahSimpanSchema,
  PengaturanSimpanSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';

export function registerPengaturanHandlers(ctx: IpcContext): void {
  const { handle, pengaturan } = ctx;

  handle('pengaturan.profilBaca', null, () => pengaturan.profilBaca());
  handle('pengaturan.profilSimpan', ProfilSekolahSimpanSchema, (data) =>
    pengaturan.profilSimpan(data)
  );
  handle('pengaturan.baca', null, () => pengaturan.pengaturanBaca());
  handle('pengaturan.simpan', PengaturanSimpanSchema, (data) =>
    pengaturan.pengaturanSimpan(data)
  );
}

