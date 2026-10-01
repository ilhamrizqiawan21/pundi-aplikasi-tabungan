export type ErrorCode =
  | 'SALDO_TIDAK_CUKUP'
  | 'NOMINAL_TIDAK_VALID'
  | 'SISWA_TIDAK_DITEMUKAN'
  | 'KELAS_TIDAK_DITEMUKAN'
  | 'TAHUN_AJARAN_TIDAK_DITEMUKAN'
  | 'TRANSAKSI_TIDAK_DITEMUKAN'
  | 'TRANSAKSI_SUDAH_DIBALIK'
  | 'TRANSAKSI_PEMBALIK_DITOLAK'
  | 'ALASAN_KOREKSI_WAJIB'
  | 'SISWA_SUDAH_PUNYA_TRANSAKSI'
  | 'NOMOR_REKENING_DUPLIKAT'
  | 'DATA_DUPLIKAT'
  | 'MASIH_DIPAKAI'
  | 'VALIDASI_GAGAL'
  | 'DATABASE_ERROR'
  | 'BACKUP_GAGAL'
  | 'RESTORE_GAGAL'
  | 'FILE_TIDAK_VALID'
  | 'AKSES_DITOLAK'
  | 'INTERNAL_ERROR';

export interface AppError {
  kode: ErrorCode;
  pesan: string;
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  SALDO_TIDAK_CUKUP: 'Saldo tidak mencukupi untuk penarikan ini.',
  NOMINAL_TIDAK_VALID: 'Nominal harus berupa bilangan bulat positif.',
  SISWA_TIDAK_DITEMUKAN: 'Data siswa tidak ditemukan.',
  KELAS_TIDAK_DITEMUKAN: 'Data kelas tidak ditemukan.',
  TAHUN_AJARAN_TIDAK_DITEMUKAN: 'Data tahun ajaran tidak ditemukan.',
  TRANSAKSI_TIDAK_DITEMUKAN: 'Data transaksi tidak ditemukan.',
  TRANSAKSI_SUDAH_DIBALIK: 'Transaksi ini sudah pernah dibalik/dikoreksi sebelumnya.',
  TRANSAKSI_PEMBALIK_DITOLAK: 'Transaksi koreksi tidak dapat dibalik ulang.',
  ALASAN_KOREKSI_WAJIB: 'Alasan koreksi wajib diisi.',
  SISWA_SUDAH_PUNYA_TRANSAKSI: 'Siswa yang memiliki riwayat transaksi tidak dapat dihapus.',
  NOMOR_REKENING_DUPLIKAT: 'Nomor rekening sudah terdaftar.',
  DATA_DUPLIKAT: 'Data dengan nama yang sama sudah ada.',
  MASIH_DIPAKAI: 'Data ini masih dipakai sehingga tidak bisa dihapus.',
  VALIDASI_GAGAL: 'Data yang dimasukkan tidak valid.',
  DATABASE_ERROR: 'Terjadi kesalahan pada basis data.',
  BACKUP_GAGAL: 'Pembuatan berkas cadangan gagal.',
  RESTORE_GAGAL: 'Pemulihan data gagal. Berkas tidak sesuai atau rusak.',
  FILE_TIDAK_VALID: 'Berkas tidak sesuai format yang didukung.',
  AKSES_DITOLAK: 'Akses ke berkas atau operasi ditolak.',
  INTERNAL_ERROR: 'Terjadi kesalahan internal pada sistem.',
};
