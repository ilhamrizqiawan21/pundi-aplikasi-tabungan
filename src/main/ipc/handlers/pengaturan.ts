import { dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ProfilSekolahSimpanSchema,
  PengaturanSimpanSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';
import type { ProfilSekolah, ProfilSekolahTampilan, Result } from '../../../shared/types.js';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function profilUntukRenderer(result: Result<ProfilSekolah>): Result<ProfilSekolahTampilan> {
  if (!result.ok) return result;
  const { logo_rel_path, ...profil } = result.data;
  return { ok: true, data: { ...profil, logo_tersedia: Boolean(logo_rel_path) } };
}

function ekstensiLogo(data: Buffer): 'png' | 'jpg' | null {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length >= png.length && data.subarray(0, png.length).equals(png)) return 'png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg';
  return null;
}

async function hapusLogoLama(dataDir: string, relativePath: string | null): Promise<void> {
  if (!relativePath) return;
  const assetDir = path.resolve(dataDir, 'assets');
  const target = path.resolve(dataDir, relativePath);
  if (path.dirname(target) !== assetDir || !/^logo-[\w-]+\.(png|jpg)$/.test(path.basename(target))) return;
  await fs.unlink(target).catch(() => undefined);
}

export function registerPengaturanHandlers(ctx: IpcContext): void {
  const { handle, pengaturan } = ctx;

  handle('pengaturan.profilBaca', null, () => profilUntukRenderer(pengaturan.profilBaca()));
  handle('pengaturan.profilSimpan', ProfilSekolahSimpanSchema, (data) =>
    profilUntukRenderer(pengaturan.profilSimpan(data))
  );
  handle('pengaturan.logoPilih', null, async () => {
    const pilihan = await dialog.showOpenDialog({
      title: 'Pilih logo sekolah',
      properties: ['openFile'],
      filters: [{ name: 'Gambar PNG atau JPEG', extensions: ['png', 'jpg', 'jpeg'] }],
    });
    if (pilihan.canceled || !pilihan.filePaths[0]) return { ok: true, data: null };

    const stat = await fs.stat(pilihan.filePaths[0]);
    if (stat.size > LOGO_MAX_BYTES) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Ukuran logo maksimal 2 MB.' };
    }
    const sumber = await fs.readFile(pilihan.filePaths[0]);
    if (sumber.length > LOGO_MAX_BYTES) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Ukuran logo maksimal 2 MB.' };
    }
    const ekstensi = ekstensiLogo(sumber);
    if (!ekstensi) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Pilih gambar PNG atau JPEG yang valid.' };
    }

    const nama = `logo-${randomUUID()}.${ekstensi}`;
    const relativePath = path.join('assets', nama);
    const targetDir = path.join(ctx.dataDir, 'assets');
    const target = path.join(targetDir, nama);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(target, sumber, { flag: 'wx' });

    const lama = pengaturan.profilBaca();
    const simpan = pengaturan.profilLogoSimpan(relativePath);
    if (!simpan.ok) {
      await fs.unlink(target).catch(() => undefined);
      return simpan;
    }
    if (lama.ok) await hapusLogoLama(ctx.dataDir, lama.data.logo_rel_path);
    return { ok: true, data: { nama_berkas: path.basename(pilihan.filePaths[0]) } };
  });
  handle('pengaturan.logoHapus', null, async () => {
    const lama = pengaturan.profilBaca();
    const simpan = pengaturan.profilLogoSimpan(null);
    if (!simpan.ok) return simpan;
    if (lama.ok) await hapusLogoLama(ctx.dataDir, lama.data.logo_rel_path);
    return { ok: true, data: { dihapus: true } };
  });
  handle('pengaturan.baca', null, () => pengaturan.pengaturanBaca());
  handle('pengaturan.simpan', PengaturanSimpanSchema, (data) =>
    pengaturan.pengaturanSimpan(data)
  );
}

