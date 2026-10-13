export interface SetorInput {
  siswa_id: number;
  nominal: number;
  tanggal?: string;
  keterangan?: string;
}

export interface SaldoAwalInput {
  siswa_id: number;
  nominal: number;
  tanggal: string;
  impor_id?: number | null;
  keterangan?: string;
}

export interface TarikInput {
  siswa_id: number;
  nominal: number;
  tanggal?: string;
  keterangan?: string;
}

export interface SetorMassalInput {
  tanggal?: string;
  keterangan?: string;
  baris: { siswa_id: number; nominal: number }[];
}

export interface HasilSetorMassal {
  jumlah: number;
  total: number;
  transaksi_ids: number[];
}

/** Dilempar di dalam transaksi SQL setoran massal agar semuanya dibatalkan bila satu baris gagal. */
export class GagalBarisMassal extends Error {
  constructor(public readonly hasil: { kode: string; pesan: string }, public readonly nomorBaris: number) {
    super('GAGAL_BARIS_MASSAL');
  }
}

export interface BiayaAdmInput {
  siswa_id: number;
  nominal: number;
  tanggal?: string;
  keterangan?: string;
}

export interface BiayaAdmMassalInput {
  kelas_id: number;
  nominal: number;
  /** Label periode bebas (mis. "Semester 1 2025/2026"); menjadi bagian keterangan dan kunci anti-ganda. */
  periode: string;
  tanggal?: string;
}

export interface RencanaBiayaAdm {
  keterangan: string;
  dipotong: { siswa_id: number; nomor: string; nama: string; saldo: number }[];
  dilewati: { siswa_id: number; nomor: string; nama: string; alasan: string }[];
}

export interface HasilBiayaAdmMassal {
  jumlah: number;
  total: number;
  dilewati: RencanaBiayaAdm['dilewati'];
}

export interface BalikInput {
  transaksi_id: number;
  alasan: string;
}

export interface RiwayatFilter {
  siswa_id?: number;
  tanggal?: string;
  dari_tanggal?: string;
  sampai_tanggal?: string;
  kelas_id?: number;
  limit?: number;
  /** Tanpa batas baris (untuk cetak buku besar yang totalnya harus mencakup seluruh riwayat). Hanya dari main, bukan dari IPC. */
  semua?: boolean;
}

