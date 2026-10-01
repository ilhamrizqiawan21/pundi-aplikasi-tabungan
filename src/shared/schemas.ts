import { z } from 'zod';

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
  mulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  selesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
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

const Tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD');
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
    jenis: z.literal('rekapSiswa'),
    tahunAjaranId: z.number().int().positive().optional(),
    kelasId: z.number().int().positive().optional(),
  }),
]);

// Transaksi (NFR-03: nominal bilangan bulat positif)
export const TransaksiSetorSchema = z.object({
  siswa_id: z.number().int().positive('ID Siswa tidak valid'),
  nominal: z.number().int().positive('Nominal setoran harus lebih dari 0'),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD').optional(),
  keterangan: z.string().trim().max(255).optional(),
});

export const TransaksiTarikSchema = z.object({
  siswa_id: z.number().int().positive('ID Siswa tidak valid'),
  nominal: z.number().int().positive('Nominal penarikan harus lebih dari 0'),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD').optional(),
  keterangan: z.string().trim().max(255).optional(),
});

export const TransaksiBalikSchema = z.object({
  transaksi_id: z.number().int().positive('ID Transaksi tidak valid'),
  alasan: z.string().trim().min(3, 'Alasan koreksi minimal 3 karakter').max(255),
});

export const TransaksiRiwayatSchema = z.object({
  siswa_id: z.number().int().positive().optional(),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dari_tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sampai_tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  logo_rel_path: z.string().nullable().optional(),
});

export const PengaturanSimpanSchema = z.object({
  tema: TemaAplikasiSchema.optional(),
  folder_backup: z.string().optional(),
  backup_otomatis: z.boolean().optional(),
  ukuran_struk: UkuranStrukSchema.optional(),
  pin_hash: z.string().nullable().optional(),
});
