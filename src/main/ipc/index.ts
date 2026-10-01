import { randomUUID } from 'node:crypto';
import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron';
import { LedgerService } from '../services/ledger.js';
import { SiswaService } from '../services/siswa.js';
import { AkademikService } from '../services/akademik.js';
import { PengaturanService } from '../services/pengaturan.js';
import { IntegritasService } from '../services/integritas.js';
import { BackupService } from '../services/backup.js';
import { LaporanService } from '../services/laporan.js';
import { ImporService } from '../services/impor.js';
import {
  SiswaCariSchema,
  SiswaSimpanSchema,
  IdSchema,
  TokenBerkasSchema,
  TahunAjaranSimpanSchema,
  KelasSimpanSchema,
  TransaksiSetorSchema,
  TransaksiTarikSchema,
  TransaksiBalikSchema,
  TransaksiRiwayatSchema,
  ProfilSekolahSimpanSchema,
  PengaturanSimpanSchema,
} from '../../shared/schemas.js';
import type { Result } from '../../shared/types.js';
import { isTrustedSender } from '../security.js';
import { trustedConfig } from '../window.js';

// Token store untuk jalur file yang dipilih via dialog aman (NFR-07: renderer tidak menerima file path langsung)
const fileTokenStore = new Map<string, string>();
// Token milik daftar cadangan; dibuang setiap daftar diminta ulang agar tidak menumpuk
const daftarCadanganTokens = new Set<string>();

function mintToken(realPath: string): string {
  const token = `token_${randomUUID()}`;
  fileTokenStore.set(token, realPath);
  return token;
}

export interface IpcOptions {
  /** Folder cadangan, di dalam folder data pengguna. */
  backupDir: string;
}

function verifySender(event: IpcMainInvokeEvent): boolean {
  return isTrustedSender(event.senderFrame, trustedConfig());
}

export function registerIpcHandlers(opts: IpcOptions): void {
  const ledger = new LedgerService();
  const siswa = new SiswaService();
  const akademik = new AkademikService();
  const pengaturan = new PengaturanService();
  const integritas = new IntegritasService();
  const backup = new BackupService(opts.backupDir);
  const laporan = new LaporanService();
  const impor = new ImporService();

  // Helper pembungkus handler aman
  function handle<TInput, TOutput>(
    channel: string,
    schema: { parse: (val: unknown) => TInput } | null,
    handler: (input: TInput, event: IpcMainInvokeEvent) => Result<TOutput> | Promise<Result<TOutput>>
  ) {
    ipcMain.handle(channel, async (event, rawInput) => {
      if (!verifySender(event)) {
        return { ok: false, kode: 'AKSES_DITOLAK', pesan: 'Pengirim IPC tidak diizinkan.' };
      }

      try {
        const validated = schema ? schema.parse(rawInput) : (rawInput as TInput);
        return await handler(validated, event);
      } catch (err: unknown) {
        return {
          ok: false,
          kode: 'VALIDASI_GAGAL',
          pesan: err instanceof Error ? err.message : 'Parameter tidak valid.',
        };
      }
    });
  }

  // --- SISWA ---
  handle('siswa.cari', SiswaCariSchema, (data) =>
    siswa.cari(data.query, data.kelasId, data.status)
  );
  handle('siswa.detail', IdSchema, (data) => siswa.detail(data.id));
  handle('siswa.simpan', SiswaSimpanSchema, (data) => siswa.simpan(data));
  handle('siswa.hapus', IdSchema, (data) => siswa.hapus(data.id));

  // --- AKADEMIK ---
  handle('akademik.tahunAjaranDaftar', null, () => akademik.tahunAjaranDaftar());
  handle('akademik.tahunAjaranSimpan', TahunAjaranSimpanSchema, (data) =>
    akademik.tahunAjaranSimpan(data)
  );
  handle('akademik.kelasDaftar', null, (data: { tahunAjaranId?: number }) =>
    akademik.kelasDaftar(data?.tahunAjaranId)
  );
  handle('akademik.kelasSimpan', KelasSimpanSchema, (data) =>
    akademik.kelasSimpan(data)
  );

  // --- TRANSAKSI & BUKU BESAR ---
  handle('transaksi.setor', TransaksiSetorSchema, (data) => ledger.setor(data));
  handle('transaksi.tarik', TransaksiTarikSchema, (data) => ledger.tarik(data));
  handle('transaksi.balik', TransaksiBalikSchema, (data) => ledger.balik(data));
  handle('transaksi.riwayat', TransaksiRiwayatSchema, (data) => ledger.riwayat(data));

  // --- LAPORAN ---
  handle('laporan.kasHarian', null, (data: { tanggal?: string }) =>
    laporan.kasHarian(data?.tanggal)
  );
  handle('laporan.rekapKelas', null, (data: { tahunAjaranId?: number }) =>
    laporan.rekapKelas(data?.tahunAjaranId)
  );
  handle('laporan.rekapSiswa', null, (data: { tahunAjaranId?: number; kelasId?: number }) =>
    laporan.rekapSiswa(data || {})
  );

  // --- PENGATURAN & PROFIL ---
  handle('pengaturan.profilBaca', null, () => pengaturan.profilBaca());
  handle('pengaturan.profilSimpan', ProfilSekolahSimpanSchema, (data) =>
    pengaturan.profilSimpan(data)
  );
  handle('pengaturan.baca', null, () => pengaturan.pengaturanBaca());
  handle('pengaturan.simpan', PengaturanSimpanSchema, (data) =>
    pengaturan.pengaturanSimpan(data)
  );

  // --- IMPOR DATA (Tokenized) ---
  ipcMain.handle('impor.pratinjau', async (event, data: { tokenBerkas: string }) => {
    if (!verifySender(event)) {
      return { ok: false, kode: 'AKSES_DITOLAK', pesan: 'Akses ditolak.' };
    }
    const realPath = fileTokenStore.get(data.tokenBerkas);
    if (!realPath) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Sesi berkas kadaluarsa. Silakan pilih kembali berkas Anda.' };
    }
    return impor.pratinjau(realPath);
  });

  ipcMain.handle('impor.terapkan', async (event, data: { tokenBerkas: string }) => {
    if (!verifySender(event)) {
      return { ok: false, kode: 'AKSES_DITOLAK', pesan: 'Akses ditolak.' };
    }
    const realPath = fileTokenStore.get(data.tokenBerkas);
    if (!realPath) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Sesi berkas kadaluarsa. Silakan pilih kembali berkas Anda.' };
    }
    return impor.terapkan(realPath);
  });

  // --- INTEGRITAS & BACKUP ---
  handle('integritas.periksa', null, () => integritas.periksa());
  handle('backup.buat', null, (data: { keterangan?: string }) =>
    backup.buat(data?.keterangan)
  );
  handle('backup.daftar', null, () => {
    for (const t of daftarCadanganTokens) fileTokenStore.delete(t);
    daftarCadanganTokens.clear();
    const res = backup.daftar();
    if (!res.ok) return res;
    return {
      ok: true,
      data: res.data.map(({ jalur, ...item }) => {
        const token = mintToken(jalur);
        daftarCadanganTokens.add(token);
        return { ...item, token };
      }),
    };
  });
  handle('backup.restore', TokenBerkasSchema, (data) => {
    const realPath = fileTokenStore.get(data.tokenBerkas);
    if (!realPath) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Sesi berkas kadaluarsa. Silakan pilih kembali berkas cadangan.' };
    }
    fileTokenStore.delete(data.tokenBerkas); // sekali pakai
    return backup.restore(realPath);
  });

  // --- DIALOG FILE (Tokenized - NFR-07) ---
  ipcMain.handle('dialog.pilihFile', async (event, opsi: { ekstensi: string[] }) => {
    if (!verifySender(event)) {
      return { ok: false, kode: 'AKSES_DITOLAK', pesan: 'Akses ditolak.' };
    }
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Data', extensions: opsi.ekstensi || ['xlsx', 'csv'] }],
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
