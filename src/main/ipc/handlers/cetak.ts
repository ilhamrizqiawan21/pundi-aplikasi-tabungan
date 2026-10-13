import {
  IdSchema,
  CetakLaporanSchema,
  CetakHtmlSchema,
} from '../../../shared/schemas.js';
import type { Result, CetakLaporanInput, Transaksi, ProfilSekolah } from '../../../shared/types.js';
import { getDb } from '../../db/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hariIniLokal } from '../../../shared/tanggal.js';
import { generateReceiptHtml } from '../../print/receipt.js';
import {
  generateLaporanKelasHtml,
  generateLaporanSiswaHtml,
  generateLaporanTransaksiHtml,
  generateBukuBesarSiswaHtml,
  generateSlipSaldoHtml,
  generateTutupKasHtml,
  generateRekapBulananHtml,
} from '../../print/laporan.js';
import { printHtml, savePdf } from '../../print/printer.js';
import type { IpcContext } from '../types.js';

export function registerCetakHandlers(ctx: IpcContext): void {
  const { handle, siswa, akademik, ledger, laporan, pengaturan } = ctx;

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

  async function profilUntukCetak(): Promise<ProfilSekolah> {
    const result = pengaturan.profilBaca();
    if (!result.ok || !result.data.logo_rel_path) return result.ok ? result.data : defaultProfil;
    const target = path.resolve(ctx.dataDir, result.data.logo_rel_path);
    const assetDir = path.resolve(ctx.dataDir, 'assets');
    if (path.dirname(target) !== assetDir || !/^logo-[\w-]+\.(png|jpg)$/.test(path.basename(target))) return result.data;
    try {
      const image = await fs.readFile(target);
      if (image.length > 2 * 1024 * 1024) return result.data;
      const tipe = path.extname(target) === '.png' ? 'image/png' : 'image/jpeg';
      return { ...result.data, logo_rel_path: `data:${tipe};base64,${image.toString('base64')}` };
    } catch {
      return result.data;
    }
  }

  async function ambilDataStruk(transaksiId: number): Promise<Result<{ html: string; nomor_bukti: string }>> {
    const db = getDb();
    const trx = db.prepare('SELECT * FROM transaksi WHERE id = ?').get(transaksiId) as Transaksi | undefined;
    if (!trx) return { ok: false, kode: 'TRANSAKSI_TIDAK_DITEMUKAN', pesan: 'Transaksi tidak ditemukan.' };

    const siswaRes = siswa.detail(trx.siswa_id);
    if (!siswaRes.ok) return siswaRes;

    const profil = await profilUntukCetak();

    const setRes = pengaturan.pengaturanBaca();
    const ukuran = setRes.ok ? setRes.data.ukuran_struk : '80';

    const html = generateReceiptHtml(trx, siswaRes.data, profil, ukuran);
    return { ok: true, data: { html, nomor_bukti: trx.nomor_bukti } };
  }

  async function bangunLaporanHtml(input: CetakLaporanInput): Promise<Result<{ html: string; judul: string }>> {
    const profil = await profilUntukCetak();

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
      // Cetak memuat seluruh baris (tanpa batas tampilan layar) agar total di kertas sama dengan total sebenarnya
      const dataRes = laporan.transaksi(
        {
          dari,
          sampai,
          kelasId: input.kelasId,
          jenis: input.jenisTransaksi,
        },
        null
      );
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
      const riwayatRes = ledger.riwayat({
        siswa_id: input.siswaId,
        semua: true,
        dari_tanggal: input.dari,
        sampai_tanggal: input.sampai,
      });
      if (!riwayatRes.ok) return riwayatRes;
      const html = generateBukuBesarSiswaHtml(
        profil,
        siswaRes.data,
        riwayatRes.data,
        input.dari,
        input.sampai
      );
      const suffixPeriode = input.dari || input.sampai ? `_${input.dari || 'awal'}_${input.sampai || 'kini'}` : '';
      return { ok: true, data: { html, judul: `buku_besar_${siswaRes.data.nomor}${suffixPeriode}` } };
    }

    if (input.jenis === 'slipSaldo') {
      if (!input.kelasId && !input.siswaId) {
        return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Pilih kelas atau siswa untuk slip saldo.' };
      }
      const dataRes = laporan.slipSaldo({ kelasId: input.kelasId, siswaId: input.siswaId });
      if (!dataRes.ok) return dataRes;
      const namaKelas = dataRes.data[0]?.kelas_nama ?? 'siswa';
      const html = generateSlipSaldoHtml(profil, dataRes.data, namaKelas);
      return { ok: true, data: { html, judul: `slip_saldo_${namaKelas.replace(/[^\w-]+/g, '_')}` } };
    }

    if (input.jenis === 'tutupKas') {
      const kasRes = laporan.kasHarian(input.tanggal);
      if (!kasRes.ok) return kasRes;
      const html = generateTutupKasHtml(profil, kasRes.data, input.kasAwal ?? 0, input.uangFisik ?? 0);
      return { ok: true, data: { html, judul: `tutup_kas_${kasRes.data.tanggal}` } };
    }

    if (input.jenis === 'rekapBulanan') {
      if (!input.dari || !input.sampai) {
        return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Rentang tanggal diperlukan untuk rekap bulanan.' };
      }
      const dataRes = laporan.rekapBulanan({ dari: input.dari, sampai: input.sampai });
      if (!dataRes.ok) return dataRes;
      const html = generateRekapBulananHtml(profil, dataRes.data, input.dari, input.sampai);
      return { ok: true, data: { html, judul: `rekap_bulanan_${input.dari}_${input.sampai}` } };
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

