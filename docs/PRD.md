# PRD — Pundi

Status: Draf 0.1 — 30 September 2026. Pemilik: Ilham Rizqiawan. Aplikasi desktop **offline** untuk mencatat tabungan siswa di madrasah/sekolah, Windows dulu, macOS Apple Silicon menyusul.

## 1. Latar belakang

Banyak sekolah mencatat tabungan siswa dengan aplikasi desktop lama (contoh: Siata Garuda 5.1.3, Visual Basic 6 + Microsoft Access, 2015) atau buku manual. Aplikasi lama tidak berjalan di macOS, menyimpan uang sebagai bilangan pecahan, tidak mengenal tahun ajaran, tidak punya jejak audit, dan tidak lagi dipelihara. Produk ini **ditulis ulang dari nol** sebagai aplikasi baru dengan konsep dan fungsi yang sama.

### Prinsip perancangan ulang (clean-room)
Siata Garuda hanya **referensi kebutuhan fungsi** yang dicatat dari pemakaian dan dari data milik pengguna sendiri. Tidak ada kode, aset, teks layar, nama, atau tata letak yang disalin. Aturan lengkap ada di [AGENTS](../AGENTS.md).

## 2. Pengguna

| Peran | Kebutuhan |
| --- | --- |
| **Bendahara/operator tabungan** (pengguna utama) | Mencatat setoran dan penarikan cepat, mencetak bukti, tahu saldo tiap siswa |
| **Kepala/wali kelas** (pembaca laporan) | Rekap saldo per kelas dan per siswa, dalam PDF/Excel |
| **Admin sekolah** | Mengelola data siswa, kelas, tahun ajaran, backup |

Satu komputer, satu pengguna pada satu waktu. Tanpa jaringan.

## 3. Tujuan dan bukan tujuan

**Tujuan (rilis 0.1)**: mencatat, mengoreksi, dan melaporkan tabungan siswa dengan **saldo yang selalu benar** dan **data yang tidak hilang**.

**Bukan tujuan** (tidak dibuat tanpa permintaan lanjutan): multi-pengguna atau jaringan, sinkronisasi cloud, aplikasi seluler, pembayaran online, integrasi bank, pembaruan otomatis, versi Linux. Fitur yang ada di aplikasi lama tetapi **ditunda** menunggu keputusan pemilik: pinjaman anggota (D-02), setoran ke bank/bendahara (D-03), cetak ke buku tabungan fisik (D-04), bunga (D-05).

## 4. Kemampuan (capabilities)

Prioritas: **M** wajib rilis 0.1, **S** sebaiknya ada, **C** bila sempat.

| ID | P | Kemampuan | Acceptance criteria |
| --- | --- | --- | --- |
| CAP-01 | M | Profil sekolah dan pengaturan | Nama, alamat, kota, kepala/bendahara, logo dapat disimpan; tampil di struk dan laporan |
| CAP-02 | M | Tahun ajaran dan kelas | Satu tahun ajaran aktif; kelas dibuat per tahun ajaran; mengganti tahun ajaran tidak mengubah data lama |
| CAP-03 | M | Data siswa | Tambah, ubah, cari (nama/nomor), status `aktif`/`lulus`/`keluar`; nomor rekening otomatis unik; siswa dengan transaksi tidak dapat dihapus permanen |
| CAP-04 | M | Impor siswa dari Excel/CSV | Unduh format contoh; pratinjau; baris bermasalah dilaporkan dengan nomor baris dan alasan; impor bersifat atomik (semua atau tidak sama sekali); tidak menggandakan siswa yang sama |
| CAP-05 | M | Setoran | Nominal bilangan bulat rupiah > 0; tanggal default hari ini, dapat diubah; saldo baru tampil segera; tersimpan atomik |
| CAP-06 | M | Penarikan | Tidak boleh melebihi saldo; nominal > 0; batas persetujuan lihat D-07 |
| CAP-07 | M | Koreksi transaksi | Transaksi lama **tidak diubah atau dihapus**; koreksi membuat transaksi pembalik dengan alasan wajib; keduanya tampil di riwayat |
| CAP-08 | S | Biaya administrasi | Potongan dicatat sebagai transaksi tersendiri dengan keterangan; aturannya menunggu D-06 |
| CAP-09 | M | Bukti transaksi (struk) | Cetak atau simpan PDF ukuran struk; memuat nomor bukti, nama, kelas, jenis, nominal, saldo sesudah, tanggal; nomor bukti berurutan tanpa celah |
| CAP-10 | M | Buku besar per siswa | Riwayat berurut waktu dengan saldo berjalan; dapat difilter tanggal; dapat dicetak/PDF |
| CAP-11 | M | Laporan | Transaksi harian, per kelas, per siswa, rekap saldo; ekspor PDF dan Excel; total laporan sama dengan penjumlahan transaksi |
| CAP-12 | S | Kenaikan kelas dan kelulusan | Pilih banyak siswa, pindahkan ke kelas tahun ajaran baru; saldo ikut; riwayat kelas tersimpan; dapat dibatalkan sebelum disimpan |
| CAP-13 | M | Backup dan restore | Backup manual ke folder pilihan; backup otomatis harian dan sebelum migrasi; restore memvalidasi berkas dan membuat cadangan otomatis dulu; menyimpan 7 cadangan otomatis terakhir |
| CAP-14 | S | Migrasi dari aplikasi lama | Impor daftar siswa dan saldo awal dari hasil ekspor Excel aplikasi lama; saldo awal dicatat sebagai transaksi `saldo_awal`, jumlah siswa dan total saldo dicocokkan di layar sebelum disimpan |
| CAP-15 | S | Tema tampilan | Lima tema, bawaan putih; tersimpan |
| CAP-16 | C | Kunci aplikasi dengan PIN | PIN opsional saat aplikasi dibuka; disimpan sebagai hash |
| CAP-17 | M | Pemeriksaan integritas saldo | Perintah "Periksa saldo" membandingkan saldo tersimpan dengan penjumlahan transaksi per siswa dan melaporkan selisih |

## 5. Persyaratan non-fungsional

| ID | Persyaratan |
| --- | --- |
| NFR-01 | **Offline penuh.** Tidak ada pemanggilan jaringan, CDN, font eksternal, atau telemetri |
| NFR-02 | **Privasi.** Data siswa dan saldo hanya di komputer pengguna; tidak masuk log; tidak pernah masuk repositori atau installer |
| NFR-03 | **Integritas uang.** Semua nominal bilangan bulat rupiah; transaksi tidak dapat diubah atau dihapus (ditegakkan di basis data); setiap penulisan dalam satu transaksi SQL |
| NFR-04 | **Kinerja.** Untuk 5.000 siswa dan 200.000 transaksi: pencarian siswa < 200 ms, pencatatan transaksi < 300 ms, laporan rekap < 3 detik |
| NFR-05 | **Platform.** Windows 10/11 x64 (0.1); macOS 12+ Apple Silicon (setelah Windows stabil) |
| NFR-06 | **Pemulihan.** Kehilangan data maksimum satu hari kerja bila backup otomatis aktif; restore teruji |
| NFR-07 | **Keamanan Electron.** `contextIsolation`, `sandbox`, IPC divalidasi, navigasi dan jendela baru diblokir |
| NFR-08 | **Aksesibilitas.** Seluruh alur harian dapat dijalankan dengan keyboard |
| NFR-09 | **Bahasa.** Seluruh teks layar Bahasa Indonesia; format rupiah `Rp 1.250.000` |
| NFR-10 | **Ukuran installer** di bawah 200 MB |

## 6. Keputusan terbuka

| ID | Pertanyaan | Dampak |
| --- | --- | --- |
| D-01 | Nama produk final. **Pundi dipilih sementara**; cadangan: Amanah, Brankas. Cek merek di pdki.dgip.go.id bila akan dijual | Branding, nama installer, ID aplikasi |
| D-02 | Apakah modul **pinjaman anggota** (peminjam, pinjaman, angsuran, tunggakan) dipakai? | Menambah 3 tabel dan ±6 layar; ditunda ke 0.3 bila ya |
| D-03 | Apakah **setoran ke bank/bendahara** (termasuk bunga dan biaya bank) dicatat di aplikasi? | Tabel `setoran_bank`; ditunda |
| D-04 | Apakah **cetak ke buku tabungan fisik** (printer dot-matrix, baris 1–70) masih dipakai? | Fitur paling rumit; butuh printer nyata untuk uji |
| D-05 | Apakah ada **bunga** pada saldo siswa? | Aturan hitung dan jadwal |
| D-06 | Arti praktis **Saldo Tutup Buku** dan **Biaya Adm** di sekolah pengguna (per bulan, semester, atau tahun?) | Aturan CAP-08 dan penutupan periode |
| D-07 | Batas nominal penarikan yang butuh persetujuan? Siapa penyetujunya? | Perlu peran kedua bila ya |
| D-08 | Lebih dari satu operator pada satu komputer? Perlu akun terpisah? | Peran dan audit per pengguna |
| D-09 | Model distribusi: gratis, dijual lisensi, atau per sekolah? | Mekanisme lisensi (tidak dibuat tanpa permintaan) |
| D-10 | Ukuran struk: 58 mm, 80 mm, atau kertas kecil A6? | Tata letak cetak |

## 7. Rencana rilis

| Rilis | Isi |
| --- | --- |
| **0.1 (Windows)** | CAP-01 sampai CAP-07, CAP-09 sampai CAP-11, CAP-13, CAP-17 |
| **0.2 (Windows)** | CAP-08, CAP-12, CAP-14, CAP-15, CAP-16 |
| **0.3** | Bergantung D-02/D-03/D-04/D-05 |
| **macOS Apple Silicon** | Setelah 0.1 stabil di Windows; butuh penandatanganan dan notarisasi Apple |

## 8. Risiko

| Risiko | Mitigasi |
| --- | --- |
| Saldo salah (bug hitung atau data tidak sinkron) | Buku besar tambah-saja, saldo diturunkan dari transaksi, CAP-17, pengujian properti pada layanan buku besar |
| Data hilang (disk rusak, salah hapus) | Backup otomatis, restore teruji, peringatan menyimpan salinan di media lain |
| Kebutuhan pengguna tidak sama dengan aplikasi lama | Jawab D-02 sampai D-10 dengan pengguna nyata sebelum fase F3 |
| Klaim hak cipta atas aplikasi lama | Aturan clean-room di AGENTS; tidak ada kode atau aset disalin; tanyakan penerbit bila ragu |
| Build macOS tidak bisa diuji tanpa Mac | Runner macOS di CI atau Mac milik pemilik; spike S-01 |

## 9. Ukuran keberhasilan

- Seorang bendahara dapat mencatat 30 transaksi dalam 5 menit tanpa mouse (uji dengan pengguna nyata).
- Pemeriksaan integritas (CAP-17) melaporkan **nol selisih** setelah 10.000 transaksi acak pada uji otomatis.
- Data satu sekolah contoh (sintetis) dapat diimpor, dilaporkan, di-backup, dan dipulihkan tanpa selisih.

## 10. Referensi

- [ERD](ERD.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DESIGN](DESIGN.md) · [TODO](../TODO.md) · [AGENTS](../AGENTS.md)
- Siata Garuda 5.1.3: referensi kebutuhan fungsi saja (modul: nasabah, kelas, transaksi, cetak, laporan, bank, pinjaman, sistem).
