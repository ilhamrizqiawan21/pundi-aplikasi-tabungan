# DESIGN — Pundi

Status: Draf 0.1 — 30 September 2026. Antarmuka untuk [PRD](PRD.md). Semua teks layar Bahasa Indonesia (NFR-09). Belum ada mockup; §9 mendaftar layar yang perlu digambar.

## 1. Prinsip

1. **Kecepatan input** adalah segalanya: bendahara mencatat puluhan transaksi berturut-turut. Alur utama harus bisa dijalankan dengan keyboard tanpa mouse.
2. **Saldo selalu terlihat** dan besar saat siswa dipilih.
3. **Aman dari salah ketik**: konfirmasi ringkas sebelum menyimpan, pesan galat yang menjelaskan cara memperbaiki.
4. **Tenang dan bersih**: latar putih bawaan, sedikit dekorasi, tabel yang mudah dibaca.

## 2. Token

Tema dipilih di Pengaturan (CAP-15), bawaan **Putih**. Komponen hanya memakai token, tidak menulis warna heksadesimal baru.

| Token | Putih (bawaan) | Hijau | Biru | Ungu | Grafit |
| --- | --- | --- | --- | --- | --- |
| `--bg` | #FFFFFF | #F6FAF7 | #F5F8FC | #F8F6FC | #1B1D21 |
| `--surface` | #F7F7F8 | #EAF3EC | #E8F0FA | #EFEAF8 | #24272C |
| `--text` | #1C1D21 | #17261C | #14202F | #221A33 | #ECEDEF |
| `--muted` | #6B6F76 | #52645A | #4F6076 | #625877 | #9AA0A8 |
| `--accent` | #2F6FED | #1F7A4D | #1F63C8 | #6B4FC8 | #6EA0FF |
| `--accent-text` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF | #0B1220 |
| `--border` | #E3E4E7 | #D5E4DA | #D2DEEE | #DDD5EE | #363A41 |

Status (semua tema): `--ok` #1E8E5A, `--warn` #B7791F, `--danger` #C0392B. Warna tidak boleh menjadi satu-satunya pembawa arti: setoran diberi tanda **+** dan penarikan **−** selain warna.

Tipografi: font sistem yang dibundel (tanpa font eksternal); angka memakai `font-variant-numeric: tabular-nums`. Skala: 12 / 14 / 16 / 20 / 28. Jarak kelipatan 4 px.

## 3. Tata letak

Jendela minimum 1024 × 680. Sisi kiri navigasi 220 px; konten di kanan.

| Bagian | Isi |
| --- | --- |
| Bilah samping | Beranda, **Catat Transaksi**, Siswa, Laporan, Kenaikan Kelas, Impor, Cadangan, Pengaturan |
| Bilah atas | Nama sekolah, tahun ajaran aktif, tombol Cadangkan cepat |
| Konten | Layar aktif |

## 4. Layar dan alur

### 4.1 Beranda (kas harian)
Ringkasan hari ini: total setoran, total penarikan, jumlah transaksi, saldo seluruh siswa aktif. Tombol besar **Catat Transaksi**. Daftar 10 transaksi terakhir.

### 4.2 Catat Transaksi (layar terpenting)
Satu layar, satu alur:
1. **Cari siswa**: kolom pencarian fokus otomatis; ketik nama atau nomor, hasil muncul saat mengetik, `↑↓` memilih, `Enter` memilih.
2. Kartu siswa: nama, kelas, nomor, **saldo** (besar).
3. Pilih jenis: `S` Setoran, `T` Penarikan. Isi nominal (diformat otomatis `Rp 50.000`). Tanggal default hari ini.
4. `Enter` menyimpan; muncul bilah konfirmasi ringkas "Setoran Rp 50.000 untuk <nama> tersimpan. Saldo Rp 250.000." dengan tombol **Cetak struk** dan **Batalkan (koreksi)**.
5. Fokus kembali ke pencarian untuk siswa berikutnya.

Galat: penarikan melebihi saldo → "Saldo tidak cukup. Saldo saat ini Rp 40.000."

### 4.3 Siswa
Tabel dengan pencarian, filter kelas dan status. Detail siswa: data diri, saldo, **buku besar** (tanggal, jenis, nominal, saldo), tombol Cetak/PDF, Koreksi pada baris (membuka dialog dengan alasan wajib).

### 4.4 Laporan
Pilih jenis (harian, per kelas, per siswa, rekap saldo), rentang tanggal, kelas. Pratinjau di layar, tombol **PDF** dan **Excel**.

### 4.4a Tahun Ajaran & Kelas
Menu tersendiri (sebelumnya direncanakan di Pengaturan, dipindah atas arahan pemilik agar mudah ditemukan). Daftar tahun ajaran dengan lencana **Aktif**, tombol **Jadikan Aktif**, **Ubah**, **Hapus** (hanya bila tidak aktif dan belum punya kelas). Di bawahnya daftar kelas tahun yang dipilih (nama, tingkat, urutan, jumlah siswa) dengan **Tambah Kelas**, **Ubah**, **Hapus** (hanya bila tanpa siswa dan tanpa transaksi) dan **Salin Kelas dari Tahun Lain** (daftar kelas tanpa siswa). Keadaan kosong: "Belum ada tahun ajaran. Buat tahun ajaran pertama untuk mulai mengelompokkan siswa ke dalam kelas." Form tahun ajaran terisi saran (Juli–Juni). Mengaktifkan tahun ajaran baru menampilkan peringatan bahwa siswa belum punya kelas di tahun itu sampai dipindahkan.

### 4.5 Kenaikan Kelas
Pilih kelas asal → daftar siswa (semua tercentang) → pilih kelas tujuan (tahun ajaran baru) → **Tinjau** (daftar perubahan) → **Terapkan**. Pilihan lulus/keluar per siswa.

### 4.6 Impor
Langkah: 1 Pilih berkas, 2 Petakan kolom, 3 Pratinjau (baris baik, baris bermasalah dengan alasan), 4 Terapkan. Untuk migrasi (CAP-14): layar pencocokan "Jumlah siswa dan total saldo" dibandingkan dengan angka dari aplikasi lama.

### 4.7 Cadangan
Tombol **Cadangkan sekarang**, daftar cadangan (tanggal, ukuran), **Pulihkan** (dialog peringatan merah: data saat ini akan diganti; cadangan otomatis dibuat dulu). Teks pengingat: "Simpan salinan di flashdisk atau drive lain."

### 4.8 Pengaturan
Profil sekolah (nama, alamat, kota, bendahara, kepala, logo), tampilan (tema), ukuran struk, PIN, periksa saldo.

## 5. Komponen

Tombol (primer, sekunder, bahaya), kolom teks dengan label tetap, kolom rupiah, pencari dengan hasil turun, tabel dengan header lengket, kartu saldo, dialog konfirmasi, toast, langkah-langkah (stepper), lencana status (aktif/lulus/keluar). Semua memakai elemen HTML asli dengan label dan dapat dioperasikan keyboard; fokus terlihat jelas.

## 6. Pintasan keyboard

| Kunci | Aksi |
| --- | --- |
| `Ctrl/Cmd + K` | Fokus ke pencarian siswa |
| `S` / `T` | Setoran / Penarikan (di layar Catat) |
| `Enter` | Simpan |
| `Esc` | Batal/tutup |
| `Ctrl/Cmd + P` | Cetak struk terakhir |

## 7. Desain cetak

- **Struk**: lebar sesuai pengaturan (58/80 mm). Isi: logo kecil (opsional), nama sekolah, nomor bukti, tanggal, nama, kelas, jenis, nominal, **saldo sesudah**, "Terima kasih". Tanpa kotak dekoratif. Satuan `mm`/`pt`, bukan `px`.
- **Laporan**: A4 potret, kop sekolah, tabel dengan header berulang tiap halaman, total di akhir, nomor halaman, tanggal cetak.
- Ukuran fisik adalah kontrak; mengubahnya berarti memperbarui PRD dan uji cetak. Selesai berarti **diukur pada cetak nyata** (S-02).

## 7a. Bahasa (salinan teks)

Pakai kata sehari-hari: "Setoran", "Penarikan", "Saldo", "Cadangan", "Pulihkan". Hindari istilah teknis (tidak "rollback", "ledger", "migrasi"). Pesan galat menjelaskan **apa** dan **cara memperbaiki**. Format rupiah `Rp 1.250.000`; tanggal `30 September 2026`.

## 8. Keadaan kosong dan galat

| Keadaan | Teks |
| --- | --- |
| Belum ada siswa | "Belum ada siswa. Tambah satu, atau impor dari Excel." |
| Tidak ada hasil pencarian | "Tidak ada siswa yang cocok dengan "<kata>"." |
| Impor ada baris bermasalah | "12 baris belum bisa diimpor. Perbaiki di Excel lalu coba lagi." |
| Gagal menyimpan | "Transaksi belum tersimpan. Tidak ada saldo yang berubah. Coba lagi." |
| Selisih saldo | "Ditemukan selisih pada 2 siswa. Data tidak diubah. Lihat rincian." |

## 9. Layar yang perlu dibuat mockup

Catat Transaksi (prioritas 1), Beranda, Siswa + buku besar, Laporan + pratinjau, Impor (empat langkah), Cadangan, Kenaikan Kelas, Pengaturan, dialog Koreksi, dialog Pulihkan, struk 80 mm.
