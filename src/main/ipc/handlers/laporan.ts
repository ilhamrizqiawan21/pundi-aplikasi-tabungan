import path from 'node:path';
import { dialog } from 'electron';
import {
  KasHarianSchema,
  RekapBulananSchema,
  SiswaPasifSchema,
  AuditDaftarSchema,
  TahunAjaranOpsionalSchema,
  RekapSiswaSchema,
  LaporanTransaksiSchema,
  LaporanEksporSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';

export function registerLaporanHandlers(ctx: IpcContext): void {
  const { handle, laporan, audit } = ctx;

  handle('laporan.kasHarian', KasHarianSchema, (data) =>
    laporan.kasHarian(data.tanggal)
  );
  handle('laporan.rekapKelas', TahunAjaranOpsionalSchema, (data) =>
    laporan.rekapKelas(data.tahunAjaranId ?? undefined)
  );
  handle('laporan.rekapSiswa', RekapSiswaSchema, (data) =>
    laporan.rekapSiswa({ tahunAjaranId: data.tahunAjaranId ?? undefined, kelasId: data.kelasId ?? undefined })
  );

  handle('laporan.rekapBulanan', RekapBulananSchema, (data) => laporan.rekapBulanan(data));
  handle('laporan.siswaPasif', SiswaPasifSchema, (data) => laporan.siswaPasif(data.bulan));
  handle('audit.daftar', AuditDaftarSchema, (data) => audit.daftar({ sebelumId: data.sebelumId }));

  handle('laporan.transaksi', LaporanTransaksiSchema, (data) => laporan.transaksi(data));

  // Berkas ekspor dipilih lewat dialog simpan di proses utama; renderer tidak pernah memegang jalur (NFR-07)
  handle('laporan.ekspor', LaporanEksporSchema, async (data) => {
    const judul =
      data.jenis === 'transaksi'
        ? `transaksi_${data.dari}_${data.sampai}`
        : data.jenis === 'rekapBulanan'
          ? `rekap_bulanan_${data.dari}_${data.sampai}`
          : 'rekap_siswa';
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
        : data.jenis === 'rekapBulanan'
          ? await laporan.eksporRekapBulanan(pilihan.filePath, { dari: data.dari, sampai: data.sampai })
          : await laporan.eksporRekapSiswa(pilihan.filePath, {
              tahunAjaranId: data.tahunAjaranId,
              kelasId: data.kelasId,
            });
    if (!hasil.ok) return hasil;
    return { ok: true, data: { nama_berkas: path.basename(pilihan.filePath) } };
  });
}

