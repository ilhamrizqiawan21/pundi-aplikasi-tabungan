# DESIGN — Pundi

Status: Draf 0.1 — 30 September 2026. Antarmuka untuk [PRD](PRD.md). Semua teks layar Bahasa Indonesia (NFR-09). Belum ada mockup; §9 mendaftar layar yang perlu digambar.

## 1. Prinsip

1. **Kecepatan input** adalah segalanya: bendahara mencatat puluhan transaksi berturut-turut. Alur utama harus bisa dijalankan dengan keyboard tanpa mouse.
2. **Saldo selalu terlihat** dan besar saat siswa dipilih.
3. **Aman dari salah ketik**: konfirmasi ringkas sebelum menyimpan, pesan galat yang menjelaskan cara memperbaiki.
4. **Tenang dan bersih**: latar putih bawaan, sedikit dekorasi, tabel yang mudah dibaca.

## 2. Token

Tema dipilih di Pengaturan (CAP-15), bawaan **Putih**. Komponen hanya memakai token, tidak menulis warna heksadesimal baru.

### 2.1 Tema Warna

| Token | Putih (bawaan) | Hijau | Biru | Ungu | Grafit |
| --- | --- | --- | --- | --- | --- |
| `--bg` | #FFFFFF | #F6FAF7 | #F5F8FC | #F8F6FC | #1B1D21 |
| `--surface` | #F7F7F8 | #EAF3EC | #E8F0FA | #EFEAF8 | #24272C |
| `--text` | #1C1D21 | #17261C | #14202F | #221A33 | #ECEDEF |
| `--muted` | #6B6F76 | #52645A | #4F6076 | #625877 | #9AA0A8 |
| `--accent` | #2F6FED | #1F7A4D | #1F63C8 | #6B4FC8 | #6EA0FF |
| `--accent-text` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF | #0B1220 |
| `--border` | #E3E4E7 | #D5E4DA | #D2DEEE | #DDD5EE | #363A41 |

### 2.2 Warna Semantik & Status
Status: `--ok` (#15803D), `--warn` (#D97706), `--danger` (#DC2626), `--info` (#2563EB).
Setiap status memiliki variasi `--*-bg`, `--*-text`, dan `--*-border` yang dioptimasi kontrasnya (memenuhi WCAG AA di semua tema, termasuk tema gelap Grafit).
Warna tidak boleh menjadi satu-satunya pembawa arti: setoran diberi tanda **+** dan penarikan **−** selain warna.

### 2.3 Skala Spasi (Spacing)
Jarak konsisten berbasis kelipatan 4 px:
- `--space-1`: 4 px
- `--space-2`: 8 px
- `--space-3`: 12 px
- `--space-4`: 16 px
- `--space-5`: 20 px
- `--space-6`: 24 px
- `--space-8`: 32 px
- `--space-10`: 40 px
- `--space-12`: 48 px

### 2.4 Skala Radius Sudut (Border Radius)
- `--radius-xs`: 4 px (tag/elemen mikro)
- `--radius-sm`: 6 px (tombol kecil, input kompak)
- `--radius-md`: 10 px (tombol standar, input)
- `--radius-lg`: 14 px (kartu panel)
- `--radius-xl`: 18 px (modal/dialog)
- `--radius-full`: 9999 px (badge pill)

### 2.5 Skala Elevasi & Bayangan (Shadows)
- `--shadow-xs`: 0 1px 2px rgba(15, 23, 42, 0.04)
- `--shadow-sm`: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)
- `--shadow-md`: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)
- `--shadow-lg`: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)
- `--shadow-xl`: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)

### 2.6 Tipografi
Font: `Inter Variable` dibundel secara lokal (tanpa jaringan eksternal); angka memakai `font-variant-numeric: tabular-nums`.
- Skala statis: `--text-2xs` (11 px), `--text-xs` (12 px), `--text-sm` (13 px), `--text-base` (14 px), `--text-md` (16 px), `--text-lg` (18 px), `--text-xl` (20 px), `--text-2xl` (24 px), `--text-3xl` (28 px).
- Skala fluid responsif:
  - `--text-fluid-title`: `clamp(18px, 1.5vw + 10px, 24px)`
  - `--text-fluid-hero`: `clamp(22px, 2vw + 12px, 32px)`

## 3. Tata letak

Jendela minimum 800 × 560 (F8-5, ramah laptop 1366 × 768 skala 125%–150% dan mode split-screen). Sisi kiri navigasi 240 px (menciut menjadi rel ikon 76 px di bawah 1100 px); konten di kanan dengan lebar maksimum 1440 px, terpusat.

| Bagian | Isi |
| --- | --- |
| Bilah samping | Latar `--surface` (putih; gelap otomatis di tema Grafit), bayangan tipis, dan batas pemisah halus. Logo memakai tile berbingkai; sembilan menu tetap berurutan (Alt+1..9) dalam kelompok `--nav-harian` (biru: Beranda, Catat Transaksi), `--nav-data` (hijau: Siswa, Laporan, Tahun Ajaran & Kelas, Kenaikan Kelas, Impor Data), dan `--nav-sistem` (ungu: Cadangan, Pengaturan). Label kelompok berwarna netral dengan penanda warna kecil; ikon menu memakai tint lembut. Menu aktif memakai latar tint, teks warna kelompok, dan penanda kiri. Tombol **Ciutkan/Bentangkan bilah samping** di header bilah (juga **Ctrl+B**) beralih antara 240 px dan rel ikon 76 px; pilihan diingat (`localStorage`, bukan pengaturan basis data). Dalam rel, logo dan tombol ciut sejajar mendatar, kelompok menu lebih rapat, dan titik status cadangan menempel di tombol cadangan. Di bawah 1100 px selalu rel ikon dan tombolnya disembunyikan. Bagian bawah menampilkan status cadangan nyata dan tombol Cadangkan sekarang. Fokus keyboard terlihat; animasi mengikuti preferensi pengurangan gerak sistem |
| Bilah atas | Nama sekolah, tahun ajaran aktif, tombol Cadangkan cepat |
| Konten | Layar aktif |

### 3a. Responsivitas (lebar jendela)

Titik henti memakai lebar jendela; aturannya ada di `src/renderer/styles/layout.css` dan `src/renderer/components/ui/ui.css`. Konten = lebar jendela − bilah samping − padding (56 px pada desktop, 32 px pada layar sempit).

| Lebar jendela | Perilaku |
| --- | --- |
| < 1100 px | Bilah samping menjadi rel ikon (76 px). Nama menu tetap terbaca pembaca layar dan muncul sebagai tooltip; label pintasan disembunyikan. Kartu status cadangan menyisakan titik status dan tombol ikon. Padding konten dan header dirapatkan |
| < 1220 px | Data Siswa satu kolom: daftar di atas (maks 420 px, dapat digulir), buku besar di bawah. Memilih siswa menggulir ke buku besar |
| < 1360 px | Catat Transaksi dua kolom: pilih siswa di kiri, form di tengah, **Ringkasan hari ini** dan **Riwayat siswa** pindah ke bawah form |
| < 860 px | Catat Transaksi kolom daftar siswa dirapatkan (240 px) agar form tetap lapang |
| < 850 px | Tabel data (`.tabel-kartu`) bertransformasi menjadi tumpukan kartu vertikal responsif dengan label kolom otomatis dari atribut `data-label` |
| Kartu angka Beranda | `auto-fit` minimal 200 px; ikon turun ke atas angka bila kartu sempit. Angka rupiah tidak pernah terpecah dua baris. Nominal 14 karakter atau lebih (miliaran) memakai lebar penuh kartu, ikon di atasnya, huruf 18 px |
| Bantuan | Layar Bantuan (F9-3) bukan menu ke-10 (menu tetap sembilan = Alt+1..9). Dibuka dari tombol **Bantuan** di bilah atas atau **F1**. Isi: panduan singkat per alur (`<details>`, dapat dibuka dengan keyboard), tabel pintasan (jadi kartu < 850 px), dan Tentang (versi dari `package.json`, tanpa jaringan) |
| Tinggi < 761 px | Catat Transaksi dirapatkan (padding form dan kotak "Belum ada siswa") agar tombol **Simpan transaksi** tetap terlihat tanpa menggulir pada 1024 × 680 |
| Tinggi < 700 px | Bilah samping dirapatkan (header, jarak menu, kartu cadangan tanpa teks penjelas) agar sembilan menu muat tanpa menggulir. Berlaku untuk laptop 1366 × 768 pada skala Windows 125% |
| Tinggi < 600 px | Bilah samping dirapatkan lebih lanjut agar muat pada tinggi 560 px (skala 150%) |

Aturan: tidak boleh ada elemen yang keluar dari jendela dan tidak boleh ada gulir horizontal pada lebar mana pun ≥ 800 px (dijaga uji alur `responsif.spec.ts` dan `layout.spec.ts`).

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

**Tambahan rutinitas harian.** Catat Transaksi punya tombol **Setoran per Kelas** (dialog: pilih kelas, tanggal, tabel siswa dengan kolom nominal; Enter atau panah bawah pindah baris; galat per baris; tombol Simpan menyebut jumlah dan total). Laporan punya tab **Slip Saldo** (pilih kelas, pratinjau, cetak/PDF) dan **Tutup Kas** (kas awal, uang fisik, selisih langsung, cetak berita acara). Beranda menampilkan pengingat kuning bila salinan ke flashdisk belum ada atau lebih dari 14 hari, dapat ditutup selama sesi.

**Tambahan laporan.** Laporan punya tab **Rekap Bulanan**: pilih periode (tahun ajaran atau 12 bulan terakhir), grafik batang setoran (hijau) dan penarikan (merah) per bulan dengan tabel angka di bawahnya, tombol Cetak/PDF dan Ekspor Excel, serta bagian **Saldo mengendap** (siswa aktif bersaldo yang diam 1/3/6/12 bulan). Pengaturan memuat **Riwayat aktivitas** hanya-baca di bagian bawah.

**Biaya administrasi.** Tombol **Biaya Adm** di Catat Transaksi membuka dialog: kelas, periode (label bebas), biaya per siswa, tanggal. **Tinjau** menampilkan jumlah siswa yang dipotong dan daftar yang dilewati beserta alasannya; **Terapkan Potongan** baru aktif setelah ditinjau dan menyimpan sekaligus. Tutup Kas dan Rekap Bulanan menampilkan biaya administrasi terpisah karena tidak memengaruhi kas.

**Kunci PIN.** Bila PIN aktif, yang pertama tampil adalah halaman PIN (logo, satu kolom 6 angka yang terkirim otomatis pada angka ke-6, tautan Lupa PIN) dan tidak ada menu atau data yang dimuat. Bilah atas punya tombol **Kunci** untuk mengunci cepat. Pengaturan memuat panel **Keamanan: PIN aplikasi** (aktifkan, ubah, matikan, kunci sekarang). Kode pemulihan tampil sekali dan harus dicentang "sudah menyimpan" sebelum lanjut.

### 4.5 Kenaikan Kelas
Pilih kelas asal → daftar siswa (semua tercentang) → pilih kelas tujuan (tahun ajaran baru) → **Tinjau** (daftar perubahan) → **Terapkan**. Pilihan lulus/keluar per siswa.

### 4.6 Impor
Satu layar dengan empat langkah yang terbuka bertahap: 1 **Pilih berkas** (Excel atau CSV, dengan tombol **Unduh Format Contoh**), 2 **Petakan kolom** (kolom ditebak dari judul dan dapat diganti; ada contoh tiga baris pertama), 3 **Pratinjau** (baris baik dan bermasalah dengan nomor baris dan alasan, peringatan seperti kelas baru atau nama sama), 4 **Cocokkan dan terapkan**. Kolom saldo bersifat opsional; bila dipakai, saldo dicatat sebagai transaksi "Saldo awal" pada tanggal yang dipilih. Untuk migrasi (CAP-14) pengguna dapat mengisi angka dari aplikasi lama (jumlah siswa dan total saldo); selisih ditampilkan dan Terapkan dinonaktifkan sampai cocok. Impor hanya berjalan bila semua baris baik dan bersifat atomik.

### 4.7 Cadangan
Tombol **Cadangkan sekarang**, daftar cadangan (tanggal, ukuran), **Pulihkan** (dialog peringatan merah: data saat ini akan diganti; cadangan otomatis dibuat dulu). Teks pengingat: "Simpan salinan di flashdisk atau drive lain."

### 4.8 Pengaturan
Profil sekolah (nama, alamat, kota, bendahara, kepala, logo), tampilan (tema), ukuran struk, PIN, periksa saldo. Kolom profil yang dikosongkan benar-benar dikosongkan saat disimpan. Logo dipilih melalui dialog proses utama sebagai PNG/JPEG maksimal 2 MB; jalur internal tidak dikirim ke renderer (ARCHITECTURE A-08). PIN dikelola panel Keamanan.

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
