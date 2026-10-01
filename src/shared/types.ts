/**
 * Tipe data domain Pundi (ERD §2 & ARCHITECTURE §5)
 */

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kode: string; pesan: string };

export type StatusSiswa = 'aktif' | 'lulus' | 'keluar';

export type JenisTransaksi =
  | 'setoran'
  | 'penarikan'
  | 'biaya_adm'
  | 'pembalik'
  | 'saldo_awal';

export type TemaAplikasi = 'putih' | 'hijau' | 'biru' | 'ungu' | 'grafit';
export type UkuranStruk = '58' | '80' | 'a6';

export interface TahunAjaran {
  id: number;
  nama: string; // e.g. "2025/2026"
  mulai: string; // YYYY-MM-DD
  selesai: string; // YYYY-MM-DD
  aktif: number; // 0 | 1
}

export interface Kelas {
  id: number;
  tahun_ajaran_id: number;
  nama: string; // e.g. "7A"
  tingkat: number; // e.g. 7
  urutan: number;
  tahun_ajaran_nama?: string;
}

export interface Siswa {
  id: number;
  nomor: string; // "T-000123"
  nis: string | null;
  nama: string;
  alamat: string | null;
  status: StatusSiswa;
  dibuat_pada: string;
  // Metadata gabungan untuk tampilan
  kelas_id?: number | null;
  kelas_nama?: string | null;
  saldo?: number;
}

export interface Penempatan {
  id: number;
  siswa_id: number;
  kelas_id: number;
  tahun_ajaran_id: number;
}

export interface Transaksi {
  id: number;
  nomor_bukti: string; // "TRX-2026-000045"
  siswa_id: number;
  kelas_id: number | null;
  tanggal: string; // YYYY-MM-DD
  jenis: JenisTransaksi;
  nilai: number; // bertanda rupiah (+/-)
  saldo_setelah: number;
  keterangan: string | null;
  membalik_id: number | null;
  impor_id: number | null;
  dibuat_pada: string;
  // Metadata join untuk tampilan
  siswa_nama?: string;
  siswa_nomor?: string;
  kelas_nama?: string;
}

export interface ProfilSekolah {
  id: number; // Selalu 1
  nama: string;
  alamat: string | null;
  kota: string | null;
  bendahara: string | null;
  kepala: string | null;
  logo_rel_path: string | null;
  diubah_pada: string;
}

export interface Pengaturan {
  tema: TemaAplikasi;
  folder_backup: string;
  backup_otomatis: boolean;
  ukuran_struk: UkuranStruk;
  pin_hash: string | null;
}

export interface AuditLog {
  id: number;
  waktu: string;
  aksi: string;
  entitas: string;
  entitas_id: number | null;
  ringkasan: string;
}

export interface SchemaMigration {
  version: number;
  name: string;
  applied_at: string;
}

// Laporan & Ringkasan
export interface RingkasanKasHarian {
  tanggal: string;
  total_setoran: number;
  total_penarikan: number;
  jumlah_transaksi: number;
  saldo_seluruh_siswa: number;
}

export interface ItemRekapKelas {
  kelas_id: number;
  kelas_nama: string;
  tingkat: number;
  jumlah_siswa: number;
  total_setoran: number;
  total_penarikan: number;
  total_saldo: number;
}

export interface ItemLaporanSiswa {
  siswa_id: number;
  nomor: string;
  nis: string | null;
  nama: string;
  kelas_nama: string | null;
  status: StatusSiswa;
  total_setoran: number;
  total_penarikan: number;
  saldo_akhir: number;
}

export interface HasilPeriksaIntegritas {
  apakah_seimbang: boolean;
  total_siswa_diperiksa: number;
  total_transaksi_diperiksa: number;
  selisih: Array<{
    siswa_id: number;
    nomor: string;
    nama: string;
    saldo_tercatat: number;
    saldo_kalkulasi: number;
    selisih: number;
  }>;
}

export interface HasilPratinjauImpor {
  total_baris: number;
  valid_count: number;
  invalid_count: number;
  baris: Array<{
    nomor_baris: number;
    nama: string;
    nis: string | null;
    kelas: string | null;
    alamat: string | null;
    valid: boolean;
    alasan_galat?: string;
  }>;
}

// Tipe Antarmuka IPC Renderer
export interface PundiApi {
  // Siswa
  siswaCari: (query: string, kelasId?: number, status?: StatusSiswa) => Promise<Result<Siswa[]>>;
  siswaDetail: (id: number) => Promise<Result<Siswa>>;
  siswaSimpan: (data: {
    id?: number;
    nis?: string | null;
    nama: string;
    alamat?: string | null;
    status: StatusSiswa;
    kelas_id?: number | null;
  }) => Promise<Result<Siswa>>;
  siswaHapus: (id: number) => Promise<Result<{ sukses: boolean }>>;

  // Impor
  imporPratinjau: (tokenBerkas: string) => Promise<Result<HasilPratinjauImpor>>;
  imporTerapkan: (tokenBerkas: string) => Promise<Result<{ jumlah_diimpor: number }>>;

  // Akademik
  tahunAjaranDaftar: () => Promise<Result<TahunAjaran[]>>;
  tahunAjaranSimpan: (data: {
    id?: number;
    nama: string;
    mulai: string;
    selesai: string;
    aktif: boolean;
  }) => Promise<Result<TahunAjaran>>;
  kelasDaftar: (tahunAjaranId?: number) => Promise<Result<Kelas[]>>;
  kelasSimpan: (data: {
    id?: number;
    tahun_ajaran_id: number;
    nama: string;
    tingkat: number;
    urutan: number;
  }) => Promise<Result<Kelas>>;

  // Transaksi & Buku Besar
  transaksiSetor: (data: {
    siswa_id: number;
    nominal: number;
    tanggal?: string;
    keterangan?: string;
  }) => Promise<Result<Transaksi>>;
  transaksiTarik: (data: {
    siswa_id: number;
    nominal: number;
    tanggal?: string;
    keterangan?: string;
  }) => Promise<Result<Transaksi>>;
  transaksiBalik: (data: {
    transaksi_id: number;
    alasan: string;
  }) => Promise<Result<Transaksi>>;
  transaksiRiwayat: (filter: {
    siswa_id?: number;
    tanggal?: string;
    dari_tanggal?: string;
    sampai_tanggal?: string;
    kelas_id?: number;
    limit?: number;
  }) => Promise<Result<Transaksi[]>>;

  // Laporan & Dasbor
  laporanKasHarian: (tanggal?: string) => Promise<Result<RingkasanKasHarian>>;
  laporanRekapKelas: (tahunAjaranId?: number) => Promise<Result<ItemRekapKelas[]>>;
  laporanRekapSiswa: (filter: {
    tahunAjaranId?: number;
    kelasId?: number;
  }) => Promise<Result<ItemLaporanSiswa[]>>;

  // Pengaturan & Profil
  profilSekolahBaca: () => Promise<Result<ProfilSekolah>>;
  profilSekolahSimpan: (data: Partial<ProfilSekolah>) => Promise<Result<ProfilSekolah>>;
  pengaturanBaca: () => Promise<Result<Pengaturan>>;
  pengaturanSimpan: (data: Partial<Pengaturan>) => Promise<Result<Pengaturan>>;

  // Integritas & Backup
  integritasPeriksa: () => Promise<Result<HasilPeriksaIntegritas>>;
  backupBuat: (keterangan?: string) => Promise<Result<{ berkas: string; ukuran_bytes: number }>>;
  backupDaftar: () => Promise<Result<Array<{ nama: string; jalur: string; ukuran: number; tanggal: string }>>>;
  backupRestore: (tokenBerkas: string) => Promise<Result<{ sukses: boolean }>>;

  // Utilitas Jendela & Dialog Main
  dialogPilihFile: (opsi: { ekstensi: string[] }) => Promise<Result<{ token: string; nama_berkas: string } | null>>;
  dialogPilihFolder: () => Promise<Result<{ token: string; jalur_tampilan: string } | null>>;
}

declare global {
  interface Window {
    pundi: PundiApi;
  }
}
