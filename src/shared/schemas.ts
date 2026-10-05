import { z } from 'zod';
import { tanggalKalenderValid } from './tanggal.js';
import { galatPin } from './pin.js';

/** Tanggal YYYY-MM-DD yang benar-benar ada di kalender. */
const TanggalKalender = z
  .string()
  .refine(tanggalKalenderValid, { message: 'Tanggal tidak valid (format YYYY-MM-DD).' });

/** Nominal rupiah: bilangan bulat positif yang aman (NFR-03). */
const NominalRupiah = (pesan: string) => z.number().int().safe().positive(pesan);

export const StatusSiswaSchema = z.enum(['aktif', 'lulus', 'keluar']);
export const JenisTransaksiSchema = z.enum([
  'setoran',
  'penarikan',
  'biaya_adm',
  'pembalik',
  'saldo_awal',
]);
export const TemaAplikasiSchema = z.enum([
  'putih',
  'hijau',
  'biru',
  'ungu',
  'grafit',
]);
export const UkuranStrukSchema = z.enum(['58', '80', 'a6']);

// Siswa
export const SiswaCariSchema = z.object({
  query: z.string().default(''),
  kelasId: z.number().int().positive().optional(),
  status: StatusSiswaSchema.optional(),
});

export const SiswaSimpanSchema = z.object({
  id: z.number().int().positive().optional(),
  nis: z.string().trim().max(50).nullable().optional(),
  nama: z.string().trim().min(1, 'Nama siswa wajib diisi').max(200),
  alamat: z.string().trim().max(500).nullable().optional(),
  status: StatusSiswaSchema.default('aktif'),
  kelas_id: z.number().int().positive().nullable().optional(),
});

export const TokenBerkasSchema = z.object({
  tokenBerkas: z.string().min(1).max(100),
});

export const IdSchema = z.object({
  id: z.number().int().positive(),
});

// Akademik
export const TahunAjaranSimpanSchema = z.object({
  id: z.number().int().positive().optional(),
  nama: z.string().trim().min(1).max(50),
  mulai: TanggalKalender,
  selesai: TanggalKalender,
  aktif: z.boolean().default(false),
});

export const KelasSimpanSchema = z.object({
  id: z.number().int().positive().optional(),
  tahun_ajaran_id: z.number().int().positive(),
  nama: z.string().trim().min(1).max(50),
  tingkat: z.number().int().min(1).max(20),
  urutan: z.number().int().default(1),
});

export const KelasSalinSchema = z.object({
  dari_id: z.number().int().positive(),
  ke_id: z.number().int().positive(),
});

export const KenaikanDaftarSchema = z.object({
  kelas_asal_id: z.number().int().positive(),
  tahun_ajaran_tujuan_id: z.number().int().positive(),
});

export const KenaikanTerapkanSchema = z.object({
  kelas_asal_id: z.number().int().positive(),
  tahun_ajaran_tujuan_id: z.number().int().positive(),
  perubahan: z
    .array(
      z.discriminatedUnion('tindakan', [
        z.object({ siswa_id: z.number().int().positive(), tindakan: z.literal('pindah'), kelas_tujuan_id: z.number().int().positive() }),
        z.object({ siswa_id: z.number().int().positive(), tindakan: z.literal('lulus') }),
        z.object({ siswa_id: z.number().int().positive(), tindakan: z.literal('keluar') }),
      ])
    )
    .min(1, 'Pilih minimal satu siswa')
    .max(5000),
});

const Tanggal = TanggalKalender;
const JenisTrx = z.enum(['setoran', 'penarikan', 'biaya_adm', 'pembalik', 'saldo_awal']);

const IndeksKolom = z.number().int().min(-1).max(200);

export const ImporOpsiSchema = z.object({
  tokenBerkas: z.string().min(1).max(100),
  pemetaan: z
    .object({ nama: IndeksKolom, nis: IndeksKolom, kelas: IndeksKolom, alamat: IndeksKolom, saldo: IndeksKolom })
    .optional(),
  tanggal_saldo_awal: Tanggal.optional(),
  kontrol: z
    .object({
      jumlah_siswa: z.number().int().min(0).optional(),
      total_saldo: z.number().int().min(0).optional(),
    })
    .optional(),
});

export const LaporanTransaksiSchema = z
  .object({
    dari: Tanggal,
    sampai: Tanggal,
    jenis: JenisTrx.optional(),
    kelasId: z.number().int().positive().optional(),
  })
  .refine((v) => v.sampai >= v.dari, { message: 'Tanggal akhir tidak boleh sebelum tanggal awal.' });

export const LaporanEksporSchema = z.discriminatedUnion('jenis', [
  z.object({
    jenis: z.literal('transaksi'),
    dari: Tanggal,
    sampai: Tanggal,
    kelasId: z.number().int().positive().optional(),
    // jenis transaksi disaring lewat kolom terpisah agar tidak bentrok dengan diskriminator
    jenisTransaksi: JenisTrx.optional(),
  }),
  z.object({
    jenis: z.literal('rekapBulanan'),
    dari: Tanggal,
    sampai: Tanggal,
  }),
  z.object({
    jenis: z.literal('rekapSiswa'),
    tahunAjaranId: z.number().int().positive().optional(),
    kelasId: z.number().int().positive().optional(),
  }),
]);

// Transaksi (NFR-03: nominal bilangan bulat positif)
export const TransaksiSetorSchema = z.object({
  siswa_id: z.number().int().positive('ID Siswa tidak valid'),
  nominal: NominalRupiah('Nominal setoran harus lebih dari 0'),
  tanggal: TanggalKalender.optional(),
  keterangan: z.string().trim().max(255).optional(),
});

export const TransaksiSetorMassalSchema = z
  .object({
    tanggal: TanggalKalender.optional(),
    keterangan: z.string().trim().max(255).optional(),
    baris: z
      .array(
        z.object({
          siswa_id: z.number().int().positive('ID Siswa tidak valid'),
          nominal: NominalRupiah('Nominal setoran harus lebih dari 0'),
        })
      )
      .min(1, 'Isi minimal satu setoran.')
      .max(500, 'Terlalu banyak baris sekaligus (maksimal 500).'),
  })
  .refine((d) => new Set(d.baris.map((b) => b.siswa_id)).size === d.baris.length, {
    message: 'Satu siswa tidak boleh muncul dua kali dalam satu setoran massal.',
  });

export const BiayaAdmRencanaSchema = z.object({
  kelas_id: z.number().int().positive('Kelas tidak valid'),
  nominal: NominalRupiah('Nominal biaya harus lebih dari 0'),
  periode: z.string().trim().min(3, 'Periode minimal 3 karakter').max(40, 'Periode maksimal 40 karakter'),
});
export const BiayaAdmTerapkanSchema = BiayaAdmRencanaSchema.extend({ tanggal: TanggalKalender.optional() });

export const TransaksiTarikSchema = z.object({
  siswa_id: z.number().int().positive('ID Siswa tidak valid'),
  nominal: NominalRupiah('Nominal penarikan harus lebih dari 0'),
  tanggal: TanggalKalender.optional(),
  keterangan: z.string().trim().max(255).optional(),
});

export const TransaksiBalikSchema = z.object({
  transaksi_id: z.number().int().positive('ID Transaksi tidak valid'),
  alasan: z.string().trim().min(3, 'Alasan koreksi minimal 3 karakter').max(255),
});

export const TransaksiRiwayatSchema = z.object({
  siswa_id: z.number().int().positive().optional(),
  tanggal: TanggalKalender.optional(),
  dari_tanggal: TanggalKalender.optional(),
  sampai_tanggal: TanggalKalender.optional(),
  kelas_id: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

// Pengaturan & Profil
export const ProfilSekolahSimpanSchema = z.object({
  nama: z.string().trim().min(1, 'Nama sekolah wajib diisi').max(200),
  alamat: z.string().trim().max(500).nullable().optional(),
  kota: z.string().trim().max(100).nullable().optional(),
  bendahara: z.string().trim().max(100).nullable().optional(),
  kepala: z.string().trim().max(100).nullable().optional(),
});

export const PengaturanSimpanSchema = z.object({
  tema: TemaAplikasiSchema.optional(),
  backup_otomatis: z.boolean().optional(),
  ukuran_struk: UkuranStrukSchema.optional(),
});

// Cetak & PDF
export const CetakLaporanSchema = z.object({
  jenis: z.enum(['rekapKelas', 'rekapSiswa', 'transaksi', 'bukuBesar', 'slipSaldo', 'tutupKas', 'rekapBulanan']),
  tahunAjaranId: z.number().int().positive().optional(),
  tanggal: TanggalKalender.optional(),
  kasAwal: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  uangFisik: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  kelasId: z.number().int().positive().optional(),
  siswaId: z.number().int().positive().optional(),
  dari: TanggalKalender.optional(),
  sampai: TanggalKalender.optional(),
  jenisTransaksi: z.enum(['setoran', 'penarikan', 'pembalik']).optional(),
});

export const CetakHtmlSchema = z.object({
  html: z.string().min(1, 'Konten HTML tidak boleh kosong'),
});


// Handler yang sebelumnya menerima masukan tanpa skema
export const RekapBulananSchema = z.object({ dari: TanggalKalender, sampai: TanggalKalender });
export const SiswaPasifSchema = z.object({ bulan: z.number().int().min(1).max(24) });
export const AuditDaftarSchema = z.object({ sebelumId: z.number().int().positive().optional() }).default({});
const PinBaru = z.string().superRefine((v, ctx) => {
  const g = galatPin(v);
  if (g) ctx.addIssue({ code: 'custom', message: g });
});
// PIN yang dimasukkan untuk membuka/mematikan hanya dicek bentuknya; kebenarannya dicek di layanan kunci
const PinMasuk = z.string().regex(/^\d{6}$/, 'PIN harus 6 angka.');
export const KunciPinSchema = z.object({ pin: PinMasuk });
export const KunciAturSchema = z.object({ pin: PinBaru });
export const KunciUbahSchema = z.object({ pinLama: PinMasuk, pinBaru: PinBaru });
export const KunciPulihkanSchema = z.object({ kode: z.string().trim().min(8).max(40), pinBaru: PinBaru });
export const KasHarianSchema = z.object({ tanggal: TanggalKalender.optional() }).default({});
export const TahunAjaranOpsionalSchema = z.object({ tahunAjaranId: z.number().int().positive().nullish() }).default({});
export const RekapSiswaSchema = z
  .object({ tahunAjaranId: z.number().int().positive().optional(), kelasId: z.number().int().positive().optional() })
  .default({});
export const BackupBuatSchema = z.object({ keterangan: z.string().trim().max(40).optional() }).default({});
export const PilihFileSchema = z.object({
  ekstensi: z.array(z.enum(['xlsx', 'csv', 'sqlite'])).min(1).max(3),
});
