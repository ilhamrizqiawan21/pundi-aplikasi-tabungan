import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../components/ui/index.js';
import './BantuanScreen.css';

interface PanduanAlur {
  judul: string;
  langkah: string[];
}

interface Pintasan {
  tombol: string;
  fungsi: string;
}

// Teks ditulis sendiri sesuai DESIGN §7a: bahasa sehari-hari, tanpa istilah teknis.
const PANDUAN: PanduanAlur[] = [
  {
    judul: 'Menyiapkan data pertama kali',
    langkah: [
      'Buka Pengaturan, lalu isi nama sekolah, kota, dan nama bendahara. Data ini tampil di struk dan laporan.',
      'Buka Tahun Ajaran & Kelas, buat tahun ajaran yang berjalan, lalu buat kelas-kelasnya.',
      'Tambahkan siswa satu per satu di menu Siswa, atau masukkan sekaligus lewat Impor Data (Excel atau CSV).',
    ],
  },
  {
    judul: 'Mencatat setoran atau penarikan',
    langkah: [
      'Buka Catat Transaksi. Ketik sebagian nama atau nomor siswa, lalu tekan Enter pada siswa yang dipilih.',
      'Ketik nominal. Tombol angka cepat di bawahnya menambah nominal dengan satu klik.',
      'Pilih Setoran atau Penarikan, periksa tanggal, lalu tekan Enter atau tombol Simpan transaksi.',
      'Penarikan ditolak bila melebihi saldo. Siswa yang sudah lulus atau keluar hanya bisa menarik sisa saldonya.',
    ],
  },
  {
    judul: 'Membatalkan transaksi yang salah',
    langkah: [
      'Transaksi yang sudah tersimpan tidak diubah atau dihapus. Pembatalan dilakukan dengan transaksi pembalik.',
      'Tekan Batalkan (Koreksi) pada keterangan transaksi terakhir, atau pilih baris transaksi di buku besar siswa.',
      'Tulis alasan koreksi (minimal 3 karakter). Alasan ini tercatat dan ikut tampil di laporan.',
    ],
  },
  {
    judul: 'Mencetak struk dan laporan',
    langkah: [
      'Setelah transaksi tersimpan, tekan Ctrl+P atau tombol Cetak Struk untuk melihat pratinjau lebih dulu.',
      'Laporan harian, per kelas, dan per siswa ada di menu Laporan. Hasilnya dapat dicetak atau diekspor ke Excel.',
      'Ukuran kertas struk diatur di Pengaturan.',
    ],
  },
  {
    judul: 'Menjaga data tetap aman',
    langkah: [
      'Pundi membuat cadangan otomatis sekali sehari saat aplikasi dibuka, selama pengaturannya aktif.',
      'Tekan Cadangkan sekarang kapan saja. Simpan salinan juga di flashdisk lewat menu Cadangan.',
      'Untuk mengembalikan data, buka menu Cadangan lalu pilih berkas cadangan. Data sekarang disimpan lebih dulu sebagai pengaman.',
      'Aplikasi dapat dikunci dengan PIN 6 angka di Pengaturan. Simpan kode pemulihan di tempat aman.',
    ],
  },
  {
    judul: 'Pergantian tahun ajaran',
    langkah: [
      'Buka Kenaikan Kelas, pilih kelas tujuan untuk tiap siswa, lalu tinjau sebelum menyimpan.',
      'Siswa kelas akhir ditandai lulus. Saldo semua siswa tidak berubah, dan riwayat kelas lama tetap tersimpan.',
    ],
  },
];

const PINTASAN: Pintasan[] = [
  { tombol: 'Ctrl + K', fungsi: 'Langsung ke Catat Transaksi dan mulai mencari siswa' },
  { tombol: 'Alt + 1 sampai Alt + 9', fungsi: 'Pindah ke menu sesuai urutannya di bilah samping' },
  { tombol: 'F1', fungsi: 'Membuka halaman Bantuan ini' },
  { tombol: '↑ / ↓ lalu Enter', fungsi: 'Memilih siswa dari hasil pencarian' },
  { tombol: 'S atau T', fungsi: 'Pada kolom nominal yang masih kosong: pilih Setoran (S) atau Penarikan (T)' },
  { tombol: 'Enter', fungsi: 'Menyimpan transaksi dari kolom nominal' },
  { tombol: 'Ctrl + P', fungsi: 'Mencetak struk transaksi terakhir' },
  { tombol: 'Esc', fungsi: 'Mundur satu langkah: dari siswa terpilih ke pencarian, lalu mengosongkan pencarian; menutup jendela dialog' },
];

/** Layar Bantuan dan Tentang (F9-3). Seluruhnya offline: tidak memuat apa pun dari jaringan. */
export function BantuanScreen() {
  return (
    <div className="bantuan-container">
      <Card>
        <CardHeader>
          <CardTitle>Panduan singkat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bantuan-panduan">
            {PANDUAN.map((alur, i) => (
              <details key={alur.judul} className="bantuan-alur" open={i === 1}>
                <summary>{alur.judul}</summary>
                <ol>
                  {alur.langkah.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pintasan keyboard</CardTitle>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <Table className="tabel-kartu">
              <TableHeader>
                <TableRow>
                  <TableHead>Tombol</TableHead>
                  <TableHead>Fungsi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PINTASAN.map((p) => (
                  <TableRow key={p.tombol}>
                    <TableCell data-label="Tombol">
                      <kbd className="bantuan-kbd">{p.tombol}</kbd>
                    </TableCell>
                    <TableCell data-label="Fungsi">{p.fungsi}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tentang Pundi</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="bantuan-tentang">
            <dt>Versi</dt>
            <dd>{__APP_VERSION__}</dd>
            <dt>Cara kerja</dt>
            <dd>Pundi bekerja sepenuhnya di komputer ini. Tidak ada data yang dikirim ke internet.</dd>
            <dt>Lokasi data</dt>
            <dd>Data tabungan dan cadangan tersimpan di komputer ini. Salin cadangan ke flashdisk secara berkala.</dd>
            <dt>Nama aplikasi</dt>
            <dd>Pundi (nama sementara).</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
