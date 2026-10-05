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
  jumlah_siswa?: number;
}

export interface ItemKenaikan {
  siswa_id: number;
  nomor: string;
  nama: string;
  status: StatusSiswa;
  saldo: number;
  /** Kelas pada tahun ajaran tujuan bila siswa sudah dipindahkan. */
  kelas_tujuan_nama: string | null;
}

export type PerubahanKenaikan =
  | { siswa_id: number; tindakan: 'pindah'; kelas_tujuan_id: number }
  | { siswa_id: number; tindakan: 'lulus' }
  | { siswa_id: number; tindakan: 'keluar' };

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

/**
 * Pengaturan yang boleh dibaca/ditulis renderer. Jalur folder cadangan dan hash PIN sengaja tidak
 * termasuk: keduanya dikelola proses utama (NFR-07) dan tidak pernah dikirim ke renderer.
 */
export interface Pengaturan {
  tema: TemaAplikasi;
  backup_otomatis: boolean;
  ukuran_struk: UkuranStruk;
}

/** Isian profil dari renderer. Logo dikelola proses utama (jalur berkas tidak diterima dari renderer). */
export type ProfilSekolahInput = Partial<Omit<ProfilSekolah, 'id' | 'diubah_pada' | 'logo_rel_path'>>;

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
  /** Potongan biaya administrasi (bersih setelah koreksi); bukan arus kas. */
  total_biaya_adm: number;
  jumlah_transaksi: number;
  saldo_seluruh_siswa: number;
}

/** Satu lembar slip saldo siswa: saldo terkini dan beberapa transaksi terakhir (CAP-18). */
export interface ItemSlipSaldo {
  siswa_id: number;
  nomor: string;
  nama: string;
  kelas_nama: string | null;
  status: StatusSiswa;
  saldo: number;
  transaksi: { tanggal: string; jenis: JenisTransaksi; nilai: number; saldo_setelah: number }[];
}

/** Satu baris rekap bulanan (CAP-22). `saldo_akhir` = saldo seluruh siswa pada akhir bulan itu. */
export interface ItemRekapBulanan {
  bulan: string; // YYYY-MM
  setoran: number;
  penarikan: number;
  biaya_adm: number;
  jumlah_transaksi: number;
  saldo_akhir: number;
}

export interface HasilRekapBulanan {
  /** Saldo seluruh siswa tepat sebelum tanggal `dari`. */
  saldo_awal: number;
  baris: ItemRekapBulanan[];
}

/** Siswa aktif yang masih bersaldo tetapi lama tidak bertransaksi (CAP-22). */
export interface ItemSiswaPasif {
  siswa_id: number;
  nomor: string;
  nama: string;
  kelas_nama: string | null;
  saldo: number;
  transaksi_terakhir: string | null;
}

export interface ItemAktivitas {
  id: number;
  waktu: string;
  aksi: string;
  entitas: string;
  entitas_id: number | null;
  ringkasan: string;
}

/** Keadaan kunci PIN aplikasi (CAP-16). `tunggu_detik` > 0 berarti percobaan sedang dijeda. */
export interface StatusKunci {
  aktif: boolean;
  terbuka: boolean;
  tunggu_detik: number;
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

export interface FilterLaporanTransaksi {
  dari: string; // YYYY-MM-DD
  sampai: string; // YYYY-MM-DD
  jenis?: JenisTransaksi;
  kelasId?: number;
}

export interface ItemLaporanTransaksi {
  id: number;
  tanggal: string;
  nomor_bukti: string;
  siswa_nama: string;
  siswa_nomor: string;
  kelas_nama: string | null;
  jenis: JenisTransaksi;
  nilai: number; // bertanda
  saldo_setelah: number;
  keterangan: string | null;
}

export interface HasilLaporanTransaksi {
  baris: ItemLaporanTransaksi[];
  /** Jumlah seluruh transaksi yang cocok (bisa lebih banyak dari baris yang dikirim). */
  jumlah: number;
  total_masuk: number; // jumlah nilai positif
  total_keluar: number; // jumlah nilai negatif, sebagai bilangan positif
  terpotong: boolean;
}

export type PermintaanEkspor =
  | { jenis: 'transaksi'; dari: string; sampai: string; kelasId?: number; jenisTransaksi?: JenisTransaksi }
  | { jenis: 'rekapSiswa'; tahunAjaranId?: number; kelasId?: number }
  | { jenis: 'rekapBulanan'; dari: string; sampai: string };

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

/** Indeks kolom berkas (mulai 0) untuk tiap isian; -1 berarti tidak dipakai. */
export interface PemetaanKolom {
  nama: number;
  nis: number;
  kelas: number;
  alamat: number;
  saldo: number;
}

export interface OpsiImpor {
  /** Bila kosong, pemetaan ditebak dari judul kolom. */
  pemetaan?: PemetaanKolom;
  /** Tanggal pencatatan saldo awal; bawaan hari ini. */
  tanggal_saldo_awal?: string;
  /** Angka dari aplikasi lama untuk dicocokkan sebelum disimpan (CAP-14). */
  kontrol?: { jumlah_siswa?: number; total_saldo?: number };
}

export interface BarisImpor {
  nomor_baris: number;
  nama: string;
  nis: string | null;
  kelas: string | null;
  alamat: string | null;
  saldo: number | null;
  valid: boolean;
  alasan_galat?: string;
  catatan?: string;
}

export interface HasilPratinjauImpor {
  kolom: string[];
  baris_header: number;
  pemetaan: PemetaanKolom;
  contoh: string[][];
  total_baris: number;
  valid_count: number;
  invalid_count: number;
  total_saldo: number;
  jumlah_dengan_saldo: number;
  kelas_baru: string[];
  peringatan: string[];
  baris: BarisImpor[];
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
  /** Membuka dialog simpan lalu menulis berkas contoh; null bila dibatalkan. */
  imporContoh: () => Promise<Result<{ nama_berkas: string } | null>>;
  imporPratinjau: (tokenBerkas: string, opsi?: OpsiImpor) => Promise<Result<HasilPratinjauImpor>>;
  imporTerapkan: (
    tokenBerkas: string,
    opsi?: OpsiImpor
  ) => Promise<Result<{ jumlah_diimpor: number; jumlah_saldo_awal: number; total_saldo: number }>>;

  // Akademik
  tahunAjaranDaftar: () => Promise<Result<TahunAjaran[]>>;
  tahunAjaranSimpan: (data: {
    id?: number;
    nama: string;
    mulai: string;
    selesai: string;
    aktif: boolean;
  }) => Promise<Result<TahunAjaran>>;
  tahunAjaranHapus: (id: number) => Promise<Result<{ id: number }>>;
  kelasDaftar: (tahunAjaranId?: number) => Promise<Result<Kelas[]>>;
  kelasHapus: (id: number) => Promise<Result<{ id: number }>>;
  kelasSalin: (dariId: number, keId: number) => Promise<Result<{ disalin: number; dilewati: number }>>;
  kelasSimpan: (data: {
    id?: number;
    tahun_ajaran_id: number;
    nama: string;
    tingkat: number;
    urutan: number;
  }) => Promise<Result<Kelas>>;

  // Kenaikan Kelas
  kenaikanDaftar: (kelasAsalId: number, tahunTujuanId: number) => Promise<Result<ItemKenaikan[]>>;
  kenaikanTerapkan: (data: {
    kelas_asal_id: number;
    tahun_ajaran_tujuan_id: number;
    perubahan: PerubahanKenaikan[];
  }) => Promise<Result<{ dipindah: number; lulus: number; keluar: number }>>;

  // Transaksi & Buku Besar
  transaksiSetor: (data: {
    siswa_id: number;
    nominal: number;
    tanggal?: string;
    keterangan?: string;
  }) => Promise<Result<Transaksi>>;
  /** Setoran banyak siswa sekaligus; semua tersimpan atau tidak sama sekali (CAP-19). */
  transaksiSetorMassal: (data: {
    tanggal?: string;
    keterangan?: string;
    baris: { siswa_id: number; nominal: number }[];
  }) => Promise<Result<{ jumlah: number; total: number; transaksi_ids: number[] }>>;
  /** Pratinjau potongan biaya administrasi satu kelas (CAP-08); tidak menulis apa pun. */
  biayaAdmRencana: (data: { kelas_id: number; nominal: number; periode: string }) => Promise<
    Result<{
      keterangan: string;
      dipotong: { siswa_id: number; nomor: string; nama: string; saldo: number }[];
      dilewati: { siswa_id: number; nomor: string; nama: string; alasan: string }[];
    }>
  >;
  /** Memotong biaya administrasi satu kelas sekaligus; semua tersimpan atau tidak sama sekali. */
  biayaAdmTerapkan: (data: { kelas_id: number; nominal: number; periode: string; tanggal?: string }) => Promise<
    Result<{
      jumlah: number;
      total: number;
      dilewati: { siswa_id: number; nomor: string; nama: string; alasan: string }[];
    }>
  >;
  kunciStatus: () => Promise<Result<StatusKunci>>;
  kunciBuka: (pin: string) => Promise<Result<null>>;
  kunciKunciSekarang: () => Promise<Result<null>>;
  /** Mengaktifkan PIN; kode pemulihan hanya dikembalikan sekali. */
  kunciAtur: (pin: string) => Promise<Result<{ kode_pemulihan: string }>>;
  kunciUbah: (pinLama: string, pinBaru: string) => Promise<Result<null>>;
  kunciMatikan: (pin: string) => Promise<Result<null>>;
  kunciPulihkan: (kode: string, pinBaru: string) => Promise<Result<{ kode_pemulihan: string }>>;
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

  laporanRekapBulanan: (dari: string, sampai: string) => Promise<Result<HasilRekapBulanan>>;
  /** Siswa aktif bersaldo yang tidak bertransaksi selama `bulan` bulan terakhir. */
  laporanSiswaPasif: (bulan: number) => Promise<Result<ItemSiswaPasif[]>>;
  /** Riwayat aktivitas terbaru lebih dulu; `sebelumId` untuk halaman berikutnya. */
  auditDaftar: (sebelumId?: number) => Promise<Result<ItemAktivitas[]>>;
  laporanTransaksi: (filter: FilterLaporanTransaksi) => Promise<Result<HasilLaporanTransaksi>>;
  /** Membuka dialog simpan lalu menulis berkas Excel; mengembalikan null bila dibatalkan. */
  laporanEkspor: (data: PermintaanEkspor) => Promise<Result<{ nama_berkas: string } | null>>;

  // Pengaturan & Profil
  profilSekolahBaca: () => Promise<Result<ProfilSekolah>>;
  profilSekolahSimpan: (data: ProfilSekolahInput) => Promise<Result<ProfilSekolah>>;
  pengaturanBaca: () => Promise<Result<Pengaturan>>;
  pengaturanSimpan: (data: Partial<Pengaturan>) => Promise<Result<Pengaturan>>;

  // Integritas & Backup
  integritasPeriksa: () => Promise<Result<HasilPeriksaIntegritas>>;
  backupBuat: (keterangan?: string) => Promise<Result<{ berkas: string; ukuran_bytes: number }>>;
  /** Membuka dialog folder lalu menyalin cadangan ke sana; null bila dibatalkan (CAP-21). */
  backupSalinKeLuar: () => Promise<Result<{ nama_berkas: string; ukuran_bytes: number } | null>>;
  /** Waktu ISO salinan luar terakhir, atau null bila belum pernah. */
  backupTerakhirKeLuar: () => Promise<Result<string | null>>;
  backupTerakhir: () => Promise<Result<{ tanggal: string; jenis: 'manual' | 'otomatis' | 'pre-restore' } | null>>;
  backupDaftar: () => Promise<
    Result<Array<{ nama: string; token: string; jenis: 'manual' | 'otomatis' | 'pre-restore'; ukuran: number; tanggal: string }>>
  >;
  backupRestore: (tokenBerkas: string) => Promise<Result<{ sukses: boolean }>>;

  // Utilitas Jendela & Dialog Main
  dialogPilihFile: (opsi: { ekstensi: string[] }) => Promise<Result<{ token: string; nama_berkas: string } | null>>;

  // Cetak & PDF (CAP-09, CAP-10, CAP-11)
  cetakStruk: (transaksiId: number) => Promise<Result<{ sukses: boolean }>>;
  cetakStrukHtml: (transaksiId: number) => Promise<Result<{ html: string; nomor_bukti: string }>>;
  cetakLaporanHtml: (input: CetakLaporanInput) => Promise<Result<{ html: string; judul: string }>>;
  cetakLaporanPdf: (input: CetakLaporanInput) => Promise<Result<{ nama_berkas: string } | null>>;
  cetakHtml: (html: string) => Promise<Result<{ sukses: boolean }>>;
}

export interface CetakLaporanInput {
  jenis: 'rekapKelas' | 'rekapSiswa' | 'transaksi' | 'bukuBesar' | 'slipSaldo' | 'tutupKas' | 'rekapBulanan';
  tahunAjaranId?: number;
  /** Tanggal kas yang ditutup (jenis `tutupKas`); bawaan hari ini. */
  tanggal?: string;
  /** Uang tunai di laci saat pembukaan dan hasil hitung fisik (jenis `tutupKas`), rupiah bulat. */
  kasAwal?: number;
  uangFisik?: number;
  kelasId?: number;
  siswaId?: number;
  dari?: string;
  sampai?: string;
  jenisTransaksi?: JenisTransaksi;
}

declare global {
  interface Window {
    pundi: PundiApi;
  }
}
