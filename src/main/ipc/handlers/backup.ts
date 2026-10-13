import { dialog } from 'electron';
import {
  BackupBuatSchema,
  TokenBerkasSchema,
  PilihFileSchema,
} from '../../../shared/schemas.js';
import {
  mintToken,
  ambilJalurToken,
  hapusToken,
  bersihkanTokenCadangan,
  catatTokenCadangan,
} from '../token.js';
import type { IpcContext } from '../types.js';

export function registerBackupHandlers(ctx: IpcContext): void {
  const { handle, backup, integritas } = ctx;

  // --- INTEGRITAS & BACKUP ---
  handle('integritas.periksa', null, () => integritas.periksa());
  handle('backup.buat', BackupBuatSchema, (data) =>
    backup.buat(data.keterangan)
  );
  handle('backup.terakhir', null, () => backup.terakhir());

  // Folder tujuan dipilih lewat dialog di proses utama; renderer tidak pernah memegang jalur (NFR-07)
  handle<unknown, { nama_berkas: string; ukuran_bytes: number } | null>('backup.salinKeLuar', null, async () => {
    const pilihan = await dialog.showOpenDialog({
      title: 'Pilih folder tujuan salinan cadangan',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (pilihan.canceled || pilihan.filePaths.length === 0) return { ok: true, data: null };
    return backup.salinKeLuar(pilihan.filePaths[0]);
  });

  handle('backup.terakhirKeLuar', null, () => backup.terakhirKeLuar());

  handle('backup.daftar', null, () => {
    bersihkanTokenCadangan();
    const res = backup.daftar();
    if (!res.ok) return res;
    return {
      ok: true,
      data: res.data.map(({ jalur, ...item }) => {
        const token = mintToken(jalur);
        catatTokenCadangan(token);
        return { ...item, token };
      }),
    };
  });

  handle('backup.restore', TokenBerkasSchema, (data) => {
    const realPath = ambilJalurToken(data.tokenBerkas);
    if (!realPath) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Sesi berkas kadaluarsa. Silakan pilih kembali berkas cadangan.' };
    }
    hapusToken(data.tokenBerkas); // sekali pakai
    return backup.restore(realPath);
  });

  // --- DIALOG FILE (Tokenized - NFR-07) ---
  handle('dialog.pilihFile', PilihFileSchema, async (opsi) => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Data', extensions: opsi.ekstensi }],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { ok: true, data: null };
    }
    const realPath = res.filePaths[0];
    const token = mintToken(realPath);
    return {
      ok: true,
      data: { token, nama_berkas: realPath.split(/[\\/]/).pop() || 'berkas' },
    };
  });
}

