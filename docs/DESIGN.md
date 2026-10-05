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

Jendela minimum 1024 × 680. Sisi kiri navigasi 240 px (menciut menjadi rel ikon 76 px di bawah 1100 px); konten di kanan dengan lebar maksimum 1440 px, terpusat.

| Bagian | Isi |
| --- | --- |
| Bilah samping | Beranda, **Catat Transaksi**, Siswa, Laporan, Tahun Ajaran & Kelas, Kenaikan Kelas, Impor, Cadangan, Pengaturan; di bawahnya status cadangan nyata dan tombol Cadangkan sekarang |
| Bilah atas | Nama sekolah, tahun ajaran aktif, tombol Cadangkan cepat |
| Konten | Layar aktif |

### 3a. Responsivitas (lebar jendela)

Titik henti memakai lebar jendela; aturannya ada di `src/renderer/styles/layout.css`. Konten = lebar jendela − bilah samping − 56 px padding.

| Lebar jendela | Perilaku |
| --- | --- |
| < 1100 px | Bilah samping menjadi rel ikon (76 px). Nama menu tetap terbaca pembaca layar dan muncul sebagai tooltip; label pintasan disembunyikan. Kartu status cadangan menyisakan titik status dan tombol ikon |
| < 1220 px | Data Siswa satu kolom: daftar di atas (maks 420 px, dapat digulir), buku besar di bawah. Memilih siswa menggulir ke buku besar |
| < 1360 px | Catat Transaksi dua kolom: pilih siswa di kiri, form di tengah, **Ringkasan hari ini** dan **Riwayat siswa** pindah ke bawah form |
| Kartu angka Beranda | `auto-fit` minimal 200 px; ikon turun ke atas angka bila kartu sempit. Angka rupiah tidak pernah terpecah dua baris |

Aturan: tidak boleh ada elemen yang keluar dari jendela dan tidak boleh ada gulir horizontal pada lebar mana pun ≥ 1024 px (dijaga uji alur `responsif.spec.ts`).

## 4. Layar dan alur

### 4.1 Beranda (kas harian)
Ringkasan hari ini: total setoran, total penarikan, jumlah transaksi, saldo seluruh siswa aktif. Tombol besar **Catat Transaksi**. Daftar 10 transaksi terakhir.

Status cadangan di bilah samping bersumber dari cadangan sebenarnya (`backup.terakhir`), bukan teks tetap: "Data aman" bila cadangan terakhir ≤ 7 hari, "Perlu dicadangkan" bila lebih lama, "Belum ada cadangan" bila belum pernah. Titik status hijau atau kuning.

### 4.2 Catat Transaksi (layar terpenting)
Satu layar, satu alur:
1. **Cari siswa**: kolom pencarian fokus otomatis; ketik nama atau nomor, hasil muncul saat mengetik, `↑↓` memilih, `Enter` memilih.
2. Kartu siswa: nama, kelas, nomor, **saldo** (besar). Daftar awal hanya siswa aktif; mengetik di pencarian juga menemukan siswa lulus/keluar (diberi label "Lulus" atau "Keluar"). Untuk siswa itu tombol Setoran nonaktif dan jenis otomatis Penarikan.
3. Pilih jenis: `S` Setoran, `T` Penarikan. Isi nominal (diformat otomatis `Rp 50.000`). Tanggal default hari ini.
4. `Enter` menyimpan; muncul bilah konfirmasi ringkas "Setoran Rp 50.000 untuk <nama> tersimpan. Saldo Rp 250.000." dengan tombol **Cetak struk** dan **Batalkan (koreksi)**. **Batalkan (koreksi)** membuka dialog Koreksi Transaksi (rincian transaksi, kolom **Alasan koreksi** wajib minimal 3 karakter, tombol Terapkan Koreksi); tidak ada alasan bawaan.
5. Fokus kembali ke pencarian untuk siswa berikutnya.

Galat: penarikan melebihi saldo → "Saldo tidak cukup. Saldo saat ini Rp 40.000." Setoran untuk siswa lulus/keluar → "Siswa yang sudah lulus atau keluar tidak dapat menyetor." Tanggal masa depan → "Tanggal transaksi tidak boleh di masa depan."

### 4.3 Siswa
Tabel dengan pencarian, filter kelas dan status. Detail siswa: data diri, saldo, **buku besar** (tanggal, jenis, nominal, saldo), tombol Cetak/PDF, Koreksi pada baris (membuka dialog dengan alasan wajib).

### 4.4 Laporan
Tiga tab: **Rekap per Kelas**, **Rekap per Siswa** (dengan **Ekspor Excel**), dan **Transaksi** (rentang tanggal, jenis, kelas; tombol Hari ini/Bulan ini; total masuk, total keluar, selisih; **Ekspor Excel**). Ekspor memakai dialog simpan milik aplikasi. Pratinjau di layar, tombol **PDF** dan **Excel**.

### 4.4a Tahun Ajaran & Kelas
Menu tersendiri (sebelumnya direncanakan di Pengaturan, dipindah atas arahan pemilik agar mudah ditemukan). Daftar tahun ajaran dengan lencana **Aktif**, tombol **Jadikan Aktif**, **Ubah**, **Hapus** (hanya bila tidak aktif dan belum punya kelas). Di bawahnya daftar kelas tahun yang dipilih (nama, tingkat, urutan, jumlah siswa) dengan **Tambah Kelas**, **Ubah**, **Hapus** (hanya bila tanpa siswa dan tanpa transaksi) dan **Salin Kelas dari Tahun Lain** (daftar kelas tanpa siswa). Keadaan kosong: "Belum ada tahun ajaran. Buat tahun ajaran pertama untuk mulai mengelompokkan siswa ke dalam kelas." Form tahun ajaran terisi saran (Juli–Juni). Mengaktifkan tahun ajaran baru menampilkan peringatan bahwa siswa belum punya kelas di tahun itu sampai dipindahkan.

### 4.5 Kenaikan Kelas
Pilih kelas asal → daftar siswa (semua tercentang) → pilih kelas tujuan (tahun ajaran baru) → **Tinjau** (daftar perubahan) → **Terapkan**. Pilihan lulus/keluar per siswa.

### 4.6 Impor
Satu layar dengan empat langkah yang terbuka bertahap: 1 **Pilih berkas** (Excel atau CSV, dengan tombol **Unduh Format Contoh**), 2 **Petakan kolom** (kolom ditebak dari judul dan dapat diganti; ada contoh tiga baris pertama), 3 **Pratinjau** (baris baik dan bermasalah dengan nomor baris dan alasan, peringatan seperti kelas baru atau nama sama), 4 **Cocokkan dan terapkan**. Kolom saldo bersifat opsional; bila dipakai, saldo dicatat sebagai transaksi "Saldo awal" pada tanggal yang dipilih. Untuk migrasi (CAP-14) pengguna dapat mengisi angka dari aplikasi lama (jumlah siswa dan total saldo); selisih ditampilkan dan Terapkan dinonaktifkan sampai cocok. Impor hanya berjalan bila semua baris baik dan bersifat atomik.

### 4.7 Cadangan
Tombol **Cadangkan sekarang**, daftar cadangan (tanggal, ukuran), **Pulihkan** (dialog peringatan merah: data saat ini akan diganti; cadangan otomatis dibuat dulu). Teks pengingat: "Simpan salinan di flashdisk atau drive lain."

### 4.8 Pengaturan
Profil sekolah (nama, alamat, kota, bendahara, kepala, logo), tampilan (tema), ukuran struk, PIN, periksa saldo. Kolom profil yang dikosongkan benar-benar dikosongkan saat disimpan. Logo dan PIN belum dapat diatur dari layar ini; keduanya kelak lewat dialog di proses utama (ARCHITECTURE A-08).

## 5. Komponen

Tombol (primer, sekunder, bahaya), kolom teks dengan label tetap, kolom rupiah, pencari dengan hasil turun, tabel dengan header lengket, kartu saldo, dialog konfirmasi, toast, langkah-langkah (stepper), lencana status (aktif/lulus/keluar). Semua memakai elemen HTML asli dengan label dan dapat dioperasikan keyboard; fokus terlihat jelas.

## 6. Pintasan keyboard

| Kunci | Aksi |
| --- | --- |
| `Ctrl/Cmd + K` | Buka Catat Transaksi dan fokus ke pencarian siswa (dari layar mana pun) |
| `S` / `T` | Setoran / Penarikan (di layar Catat) |
| `Enter` | Simpan |
| `Alt + 1` … `Alt + 9` | Buka menu sesuai urutan di bilah samping (Beranda = 1, Catat Transaksi = 2, dan seterusnya); label pintasan tampil di tiap menu |
| `Esc` | Batal/tutup: di Catat Transaksi dari kartu siswa kembali ke pencarian, lalu mengosongkan pencarian; saat dialog terbuka, menutup dialog |
| `Ctrl/Cmd + P` | Cetak struk terakhir |

Pintasan layar tidak aktif selama dialog terbuka. Fokus keyboard selalu terlihat (garis 2 px warna aksen). Aplikasi terpaket tidak menampilkan menu bawaan (tanpa muat ulang dan DevTools); hanya Edit (urungkan, potong, salin, tempel) yang tersisa.

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
