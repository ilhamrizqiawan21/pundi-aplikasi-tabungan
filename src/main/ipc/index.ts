import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron';
import { LedgerService } from '../services/ledger.js';
import { SiswaService } from '../services/siswa.js';
import { AkademikService } from '../services/akademik.js';
import { PengaturanService } from '../services/pengaturan.js';
import { IntegritasService } from '../services/integritas.js';
import { BackupService } from '../services/backup.js';
import { LaporanService } from '../services/laporan.js';
import { ImporService } from '../services/impor.js';
import { KenaikanService } from '../services/kenaikan.js';
import {
  SiswaCariSchema,
  SiswaSimpanSchema,
  IdSchema,
  TokenBerkasSchema,
  TahunAjaranSimpanSchema,
  KelasSimpanSchema,
  KelasSalinSchema,
  KenaikanDaftarSchema,
  ImporOpsiSchema,
  KenaikanTerapkanSchema,
  TransaksiSetorSchema,
  TransaksiTarikSchema,
  TransaksiBalikSchema,
  TransaksiRiwayatSchema,
  ProfilSekolahSimpanSchema,
  PengaturanSimpanSchema,
  LaporanTransaksiSchema,
  LaporanEksporSchema,
  CetakLaporanSchema,
  CetakHtmlSchema,
  KasHarianSchema,
  TahunAjaranOpsionalSchema,
  RekapSiswaSchema,
  BackupBuatSchema,
  PilihFileSchema,
} from '../../shared/schemas.js';
import { ZodError } from 'zod';
import type { Result, CetakLaporanInput, Transaksi, ProfilSekolah } from '../../shared/types.js';
import { isTrustedSender } from '../security.js';
import { trustedConfig } from '../window.js';
import { getDb } from '../db/index.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { generateReceiptHtml } from '../print/receipt.js';
import {
  generateLaporanKelasHtml,
  generateLaporanSiswaHtml,
  generateLaporanTransaksiHtml,
  generateBukuBesarSiswaHtml,
} from '../print/laporan.js';
import { printHtml, savePdf } from '../print/printer.js';

// Token store untuk jalur file yang dipilih via dialog aman (NFR-07: renderer tidak menerima file path langsung)
// Token kedaluwarsa bila tak dipakai TOKEN_TTL_MS (diperpanjang tiap dipakai) agar tidak menumpuk selama aplikasi berjalan
const TOKEN_TTL_MS = 60 * 60 * 1000;
const fileTokenStore = new Map<string, { jalur: string; kedaluwarsa: number }>();
// Token milik daftar cadangan; dibuang setiap daftar diminta ulang agar tidak menumpuk
const daftarCadanganTokens = new Set<string>();

function mintToken(realPath: string): string {
  const sekarang = Date.now();
  for (const [t, v] of fileTokenStore) {
    if (v.kedaluwarsa <= sekarang) fileTokenStore.delete(t);
  }
  const token = `token_${randomUUID()}`;
  fileTokenStore.set(token, { jalur: realPath, kedaluwarsa: sekarang + TOKEN_TTL_MS });
  return token;
}

/** Jalur untuk token yang masih berlaku (masa berlaku diperpanjang), atau undefined bila tak dikenal/kedaluwarsa. */
function ambilJalurToken(token: string): string | undefined {
  const v = fileTokenStore.get(token);
  if (!v) return undefined;
  if (v.kedaluwarsa <= Date.now()) {
    fileTokenStore.delete(token);
    return undefined;
  }
  v.kedaluwarsa = Date.now() + TOKEN_TTL_MS;
  return v.jalur;
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
  const kenaikan = new KenaikanService();

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
        if (err instanceof ZodError) {
          return { ok: false, kode: 'VALIDASI_GAGAL', pesan: err.issues[0]?.message ?? 'Parameter tidak valid.' };
        }
        // Galat tak terduga: pesan mentah (bisa memuat SQL/jalur) tidak dikirim ke renderer; log hanya kode (NFR-02)
        console.error(`ipc ${channel} gagal:`, (err as { code?: string }).code ?? 'TAK_DIKENAL');
        return { ok: false, kode: 'DATABASE_ERROR', pesan: 'Terjadi kesalahan pada aplikasi.' };
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
  handle('akademik.tahunAjaranHapus', IdSchema, (data) => akademik.tahunAjaranHapus(data.id));
  handle('akademik.kelasDaftar', TahunAjaranOpsionalSchema, (data) =>
    akademik.kelasDaftar(data.tahunAjaranId ?? undefined)
  );
  handle('akademik.kelasSimpan', KelasSimpanSchema, (data) =>
    akademik.kelasSimpan(data)
  );
  handle('akademik.kelasSalin', KelasSalinSchema, (data) => akademik.kelasSalin(data.dari_id, data.ke_id));
  handle('akademik.kelasHapus', IdSchema, (data) => akademik.kelasHapus(data.id));

  // --- KENAIKAN KELAS ---
  handle('kenaikan.daftar', KenaikanDaftarSchema, (data) =>
    kenaikan.daftar(data.kelas_asal_id, data.tahun_ajaran_tujuan_id)
  );
  handle('kenaikan.terapkan', KenaikanTerapkanSchema, (data) => kenaikan.terapkan(data));

  // --- TRANSAKSI & BUKU BESAR ---
  handle('transaksi.setor', TransaksiSetorSchema, (data) => ledger.setor(data));
  handle('transaksi.tarik', TransaksiTarikSchema, (data) => ledger.tarik(data));
  handle('transaksi.balik', TransaksiBalikSchema, (data) => ledger.balik(data));
  handle('transaksi.riwayat', TransaksiRiwayatSchema, (data) => ledger.riwayat(data));

  // --- LAPORAN ---
  handle('laporan.kasHarian', KasHarianSchema, (data) =>
    laporan.kasHarian(data.tanggal)
  );
  handle('laporan.rekapKelas', TahunAjaranOpsionalSchema, (data) =>
    laporan.rekapKelas(data.tahunAjaranId ?? undefined)
  );
  handle('laporan.rekapSiswa', RekapSiswaSchema, (data) =>
    laporan.rekapSiswa({ tahunAjaranId: data.tahunAjaranId ?? undefined, kelasId: data.kelasId ?? undefined })
  );

  handle('laporan.transaksi', LaporanTransaksiSchema, (data) => laporan.transaksi(data));

  // Berkas ekspor dipilih lewat dialog simpan di proses utama; renderer tidak pernah memegang jalur (NFR-07)
  handle('laporan.ekspor', LaporanEksporSchema, async (data) => {
    const judul = data.jenis === 'transaksi' ? `transaksi_${data.dari}_${data.sampai}` : 'rekap_siswa';
    const pilihan = await dialog.showSaveDialog({
      defaultPath: `${judul}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (pilihan.canceled || !pilihan.filePath) return { ok: true, data: null };

    const hasil =
      data.jenis === 'transaksi'
        ? await laporan.eksporTransaksi(pilihan.filePath, {
            dari: data.dari,
            sampai: data.sampai,
            kelasId: data.kelasId,
            jenis: data.jenisTransaksi,
          })
        : await laporan.eksporRekapSiswa(pilihan.filePath, {
            tahunAjaranId: data.tahunAjaranId,
            kelasId: data.kelasId,
          });
    if (!hasil.ok) return hasil;
    return { ok: true, data: { nama_berkas: path.basename(pilihan.filePath) } };
  });

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

  // --- INTEGRITAS & BACKUP ---
  handle('integritas.periksa', null, () => integritas.periksa());
  handle('backup.buat', BackupBuatSchema, (data) =>
    backup.buat(data.keterangan)
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
    const realPath = ambilJalurToken(data.tokenBerkas);
    if (!realPath) {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Sesi berkas kadaluarsa. Silakan pilih kembali berkas cadangan.' };
    }
    fileTokenStore.delete(data.tokenBerkas); // sekali pakai
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

  // --- CETAK & PDF (CAP-09, CAP-10, CAP-11) ---
  async function ambilDataStruk(transaksiId: number): Promise<Result<{ html: string; nomor_bukti: string }>> {
    const db = getDb();
    const trx = db.prepare('SELECT * FROM transaksi WHERE id = ?').get(transaksiId) as Transaksi | undefined;
    if (!trx) return { ok: false, kode: 'TRANSAKSI_TIDAK_DITEMUKAN', pesan: 'Transaksi tidak ditemukan.' };

    const siswaRes = siswa.detail(trx.siswa_id);
    if (!siswaRes.ok) return siswaRes;

    const defaultProfil: ProfilSekolah = {
      id: 1,
      nama: 'TABUNGAN SISWA',
      alamat: null,
      kota: null,
      bendahara: null,
      kepala: null,
      logo_rel_path: null,
      diubah_pada: new Date().toISOString(),
    };

    const profilRes = pengaturan.profilBaca();
    const profil = profilRes.ok ? profilRes.data : defaultProfil;

    const setRes = pengaturan.pengaturanBaca();
    const ukuran = setRes.ok ? setRes.data.ukuran_struk : '80';

    const html = generateReceiptHtml(trx, siswaRes.data, profil, ukuran);
    return { ok: true, data: { html, nomor_bukti: trx.nomor_bukti } };
  }

  async function bangunLaporanHtml(input: CetakLaporanInput): Promise<Result<{ html: string; judul: string }>> {
    const defaultProfil: ProfilSekolah = {
      id: 1,
      nama: 'TABUNGAN SISWA',
      alamat: null,
      kota: null,
      bendahara: null,
      kepala: null,
      logo_rel_path: null,
      diubah_pada: new Date().toISOString(),
    };

    const profilRes = pengaturan.profilBaca();
    const profil = profilRes.ok ? profilRes.data : defaultProfil;

    if (input.jenis === 'rekapKelas') {
      const dataRes = laporan.rekapKelas(input.tahunAjaranId);
      if (!dataRes.ok) return dataRes;
      let taNama: string | undefined;
      if (input.tahunAjaranId) {
        const taList = akademik.tahunAjaranDaftar();
        if (taList.ok) {
          const ta = taList.data.find((t) => t.id === input.tahunAjaranId);
          if (ta) taNama = ta.nama;
        }
      }
      const html = generateLaporanKelasHtml(profil, dataRes.data, taNama);
      return { ok: true, data: { html, judul: `rekap_kelas_${taNama?.replace(/\//g, '_') || 'semua'}` } };
    }

    if (input.jenis === 'rekapSiswa') {
      const dataRes = laporan.rekapSiswa({
        tahunAjaranId: input.tahunAjaranId,
        kelasId: input.kelasId,
      });
      if (!dataRes.ok) return dataRes;
      const parts: string[] = [];
      if (input.tahunAjaranId) {
        const taList = akademik.tahunAjaranDaftar();
        if (taList.ok) {
          const ta = taList.data.find((t) => t.id === input.tahunAjaranId);
          if (ta) parts.push(`Tahun Ajaran: ${ta.nama}`);
        }
      }
      if (input.kelasId) {
        const kelasList = akademik.kelasDaftar(input.tahunAjaranId);
        if (kelasList.ok) {
          const k = kelasList.data.find((item) => item.id === input.kelasId);
          if (k) parts.push(`Kelas: ${k.nama}`);
        }
      }
      const html = generateLaporanSiswaHtml(profil, dataRes.data, parts.join(' | '));
      return { ok: true, data: { html, judul: 'rekap_siswa' } };
    }

    if (input.jenis === 'transaksi') {
      const dari = input.dari || hariIniLokal();
      const sampai = input.sampai || hariIniLokal();
      const dataRes = laporan.transaksi({
        dari,
        sampai,
        kelasId: input.kelasId,
        jenis: input.jenisTransaksi,
      });
      if (!dataRes.ok) return dataRes;
      const filterInfo = input.jenisTransaksi ? `Jenis: ${input.jenisTransaksi.toUpperCase()}` : undefined;
      const html = generateLaporanTransaksiHtml(profil, dataRes.data.baris, dari, sampai, filterInfo);
      return { ok: true, data: { html, judul: `transaksi_${dari}_${sampai}` } };
    }

    if (input.jenis === 'bukuBesar') {
      if (!input.siswaId) {
        return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'ID Siswa diperlukan untuk buku besar.' };
      }
      const siswaRes = siswa.detail(input.siswaId);
      if (!siswaRes.ok) return siswaRes;
      const riwayatRes = ledger.riwayat({ siswa_id: input.siswaId });
      if (!riwayatRes.ok) return riwayatRes;
      const html = generateBukuBesarSiswaHtml(profil, siswaRes.data, riwayatRes.data);
      return { ok: true, data: { html, judul: `buku_besar_${siswaRes.data.nomor}` } };
    }

    return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Jenis laporan tidak dikenali.' };
  }

  handle('cetak.struk', IdSchema, async (data) => {
    const res = await ambilDataStruk(data.id);
    if (!res.ok) return res;
    return printHtml(res.data.html);
  });

  handle('cetak.strukHtml', IdSchema, async (data) => {
    return ambilDataStruk(data.id);
  });

  handle('cetak.laporanHtml', CetakLaporanSchema, async (data) => {
    return bangunLaporanHtml(data);
  });

  handle('cetak.laporanPdf', CetakLaporanSchema, async (data) => {
    const res = await bangunLaporanHtml(data);
    if (!res.ok) return res;
    return savePdf(res.data.html, `${res.data.judul}.pdf`, { pageSize: 'A4' });
  });

  handle('cetak.html', CetakHtmlSchema, async (data) => {
    return printHtml(data.html);
  });
}

