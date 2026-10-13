import path from 'node:path';
import { dialog } from 'electron';
import { ImporOpsiSchema } from '../../../shared/schemas.js';
import { ambilJalurToken } from '../token.js';
import type { IpcContext } from '../types.js';

export function registerImporHandlers(ctx: IpcContext): void {
  const { handle, impor } = ctx;

  handle('impor.contoh', null, async () => {
    const pilihan = await dialog.showSaveDialog({
      defaultPath: 'format_impor_siswa.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (pilihan.canceled || !pilihan.filePath) return { ok: true, data: null };
    const hasil = await impor.buatContoh(pilihan.filePath);
    if (!hasil.ok) return hasil;
    return { ok: true, data: { nama_berkas: path.basename(pilihan.filePath) } };
  });

  const sesiBerkasKadaluarsa = {
    ok: false as const,
    kode: 'FILE_TIDAK_VALID' as const,
    pesan: 'Sesi berkas kadaluarsa. Silakan pilih kembali berkas Anda.',
  };

  handle('impor.pratinjau', ImporOpsiSchema, async ({ tokenBerkas, ...opsi }) => {
    const realPath = ambilJalurToken(tokenBerkas);
    return realPath ? impor.pratinjau(realPath, opsi) : sesiBerkasKadaluarsa;
  });

  handle('impor.terapkan', ImporOpsiSchema, async ({ tokenBerkas, ...opsi }) => {
    const realPath = ambilJalurToken(tokenBerkas);
    return realPath ? impor.terapkan(realPath, opsi) : sesiBerkasKadaluarsa;
  });
}

