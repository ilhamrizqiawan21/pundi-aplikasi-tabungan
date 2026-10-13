# Daftar Periksa Pengujian Installer Windows (F7-7)

> Dokumen ini disiapkan untuk **pemilik proyek** guna memverifikasi installer Windows (`Pundi-Setup-0.2.0.exe`) pada komputer bersih (clean machine).

---

## 1. Lingkungan Uji

- **Perangkat Target**: PC / Laptop dengan Windows 10 (64-bit) atau Windows 11.
- **Kondisi Komputer Bersih**: Komputer pengguna biasa tanpa lingkungan pengembang (tanpa Node.js, npm, Python, Git, atau Visual Studio Code terpasang).
- **Berkas Uji**: `release/Pundi-Setup-0.2.0.exe` (atau artefak hasil CI Windows).

---

## 2. Daftar Periksa (Checklist)

| No | Tahap | Langkah & Tindakan | Kriteria Sukses | Hasil (✓ / Galat) |
|---|---|---|---|---|
| **1** | **Pemasangan (Install)** | Jalankan `Pundi-Setup-0.2.0.exe` dengan klik dua kali. | - Wisaya (wizard) NSIS berbahasa ramah tampil.<br>- Bisa memilih direktori pemasangan.<br>- Pemasangan berjalan lancar tanpa meminta dependensi eksternal. | [ ] |
| **2** | **Shortcut & Ikon** | Periksa Desktop dan menu Start Windows. | - Shortcut desktop bernama **Pundi** dengan ikon resmi terbentuk.<br>- Entri menu Start Windows terbentuk dengan benar. | [ ] |
| **3** | **Peluncuran Pertama** | Buka aplikasi Pundi dari shortcut Desktop. | - Jendela aplikasi terbuka tanpa layar putih/crash.<br>- Basis data SQLite otomatis terinisialisasi di `%APPDATA%\Pundi\pundi.sqlite`.<br>- Tampilan Beranda tampil utuh dan responsif. | [ ] |
| **4** | **Instans Tunggal (F7-1)** | Saat aplikasi Pundi sedang aktif, klik kembali shortcut Pundi di Desktop. | - Tidak muncul jendela kedua.<br>- Jendela Pundi yang sudah terbuka langsung terfokus ke depan. | [ ] |
| **5** | **Akademik & Siswa** | 1. Buka menu **Tahun Ajaran & Kelas**, buat 1 Tahun Ajaran (mis. `2025/2026`) dan aktifkan, lalu buat 1 Kelas (mis. `1A`).<br>2. Buka menu **Data Siswa**, tambah 1 siswa baru. | - Tahun ajaran dan kelas tersimpan.<br>- Siswa berhasil disimpan dengan nomor unik dan tampil di daftar siswa. | [ ] |
| **6** | **Catat Transaksi** | Buka menu **Catat Transaksi**, cari siswa tadi, lalu lakukan:<br>1. Setoran Rp 50.000 (keterangan: "Setoran awal").<br>2. Penarikan Rp 20.000. | - Saldo bertambah menjadi Rp 50.000 lalu berkurang menjadi Rp 30.000.<br>- Riwayat mutasi tercatat seketika tanpa perlu memuat ulang.<br>- Alur dapat diselesaikan dengan keyboard tanpa mouse. | [ ] |
| **7** | **Cetak & Pratinjau** | Klik cetak struk pada transaksi setoran. | - Jendela pratinjau struk tampil utuh dengan logo dan informasi yang sesuai.<br>- Data ter-escape rapi tanpa kebocoran tag HTML mentah. | [ ] |
| **8** | **Pencadangan (Backup)** | 1. Buka menu **Cadangan & Pulihkan**.<br>2. Buat cadangan manual dengan keterangan "Uji Bersih".<br>3. Gunakan tombol **Salin Cadangan ke Luar** ke folder luar / USB Flashdisk. | - Cadangan SQLite berhasil dibuat di daftar cadangan internal.<br>- Berkas `.sqlite` tersalin utuh ke folder target pilihan di luar aplikasi. | [ ] |
| **9** | **Pemulihan (Restore)** | Di menu **Cadangan & Pulihkan**, pilih berkas cadangan tadi dan klik **Pulihkan**. | - Konfirmasi pengamanan muncul.<br>- Data berhasil dipulihkan dengan saldo dan transaksi yang persis sama. | [ ] |
| **10** | **Kunci Aplikasi (PIN)** | 1. Buka menu **Pengaturan**, aktifkan PIN 6 angka.<br>2. Catat kode pemulihan.<br>3. Klik tombol **Kunci**.<br>4. Masukkan PIN yang benar untuk membuka. | - Aplikasi terkunci dan menyembunyikan semua data.<br>- PIN benar membuka aplikasi seketika. | [ ] |
| **11** | **Crash & Log (F7-2)** | Periksa folder `%APPDATA%\Pundi\logs\`. | - Berkas log lokal terbentuk (`app.log`).<br>- Tidak ada kebocoran data sensitif (nama siswa, nominal rupiah, atau nomor rekening). | [ ] |
| **12** | **Pencopotan (Uninstall)** | Tutup aplikasi Pundi. Buka **Windows Settings > Apps > Installed apps**, pilih **Pundi** dan klik **Uninstall**. | - Program pencopot berjalan lancar.<br>- Shortcut di Desktop dan Start Menu terhapus bersih.<br>- Berkas biner di `Program Files` atau `AppData\Local\Programs` terhapus bersih. | [ ] |

---

## 3. Catatan Pengujian Pemilik

- Tanggal Uji:
- Versi Windows:
- Spesifikasi Komputer:
- Catatan / Kendala yang Ditemukan:

