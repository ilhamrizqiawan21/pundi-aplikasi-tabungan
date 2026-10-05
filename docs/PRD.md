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
| CAP-05 | M | Setoran | Nominal bilangan bulat rupiah > 0 dan dalam batas bilangan bulat aman; tanggal default hari ini, dapat diubah ke tanggal lampau tetapi **tidak ke masa depan** dan harus tanggal yang ada di kalender; **hanya untuk siswa berstatus `aktif`** (siswa `lulus`/`keluar` ditolak dengan pesan yang menjelaskan, penarikan sisa saldo tetap boleh); saldo baru tampil segera; tersimpan atomik |
| CAP-06 | M | Penarikan | Tidak boleh melebihi saldo; nominal > 0; tanggal mengikuti aturan CAP-05; siswa `lulus`/`keluar` tetap dapat menarik sisa saldo dan dapat ditemukan lewat pencarian di Catat Transaksi; batas persetujuan lihat D-07 |
| CAP-07 | M | Koreksi transaksi | Transaksi lama **tidak diubah atau dihapus**; koreksi membuat transaksi pembalik dengan **alasan wajib dari pengguna** (3 sampai 255 karakter; tidak boleh alasan bawaan yang terisi otomatis); alasan ditolak di dialog, IPC, dan layanan; pembalik tidak dapat dibalik lagi; pembalikan yang membuat saldo negatif ditolak; keduanya tampil di riwayat |
| CAP-08 | S | Biaya administrasi | Potongan dicatat sebagai transaksi `biaya_adm` tersendiri dengan keterangan "Biaya administrasi <periode>". Aturan sementara (D-06, ditetapkan agen atas arahan pemilik 5 Okt 2026, **belum diverifikasi ke sekolah nyata**): potongan per kelas dengan periode berupa label bebas (bulan, semester, atau tahun) dan nominal sama untuk semua; hanya siswa aktif; saldo kurang dari biaya = dilewati (tidak ada potongan sebagian); periode yang sama tidak dipotong dua kali kecuali potongan lamanya dikoreksi; pratinjau sebelum terapkan; semua tersimpan atau tidak sama sekali; bukan arus kas (tidak masuk setoran/penarikan pada kas harian dan rekap bulanan, ditampilkan terpisah) |
| CAP-09 | M | Bukti transaksi (struk) | Cetak atau simpan PDF ukuran struk; memuat nomor bukti, nama, kelas, jenis, nominal, saldo sesudah, tanggal; nomor bukti berurutan tanpa celah |
| CAP-10 | M | Buku besar per siswa | Riwayat berurut waktu dengan saldo berjalan; dapat difilter tanggal; dapat dicetak/PDF |
| CAP-11 | M | Laporan | Transaksi harian, per kelas, per siswa, rekap saldo; ekspor PDF dan Excel; total laporan sama dengan penjumlahan transaksi |
| CAP-12 | S | Kenaikan kelas dan kelulusan | Pilih banyak siswa, pindahkan ke kelas tahun ajaran baru; saldo ikut; riwayat kelas tersimpan; dapat dibatalkan sebelum disimpan |
| CAP-13 | M | Backup dan restore | Backup manual ke folder pilihan; backup otomatis harian dan sebelum migrasi; restore memvalidasi berkas dan membuat cadangan otomatis dulu; menyimpan 7 cadangan otomatis terakhir |
| CAP-14 | S | Migrasi dari aplikasi lama | Impor daftar siswa dan saldo awal dari hasil ekspor Excel aplikasi lama; saldo awal dicatat sebagai transaksi `saldo_awal`, jumlah siswa dan total saldo dicocokkan di layar sebelum disimpan |
| CAP-15 | S | Tema tampilan | Lima tema, bawaan putih; tersimpan |
| CAP-16 | C | Kunci aplikasi dengan PIN | PIN opsional **6 angka** (bukan angka sama/berurutan) yang diminta di halaman tersendiri sebelum menu mana pun. Hash `scrypt` + salt di `kunci.json` folder data (di luar basis data); gerbang di proses utama (saluran IPC selain status/buka/pulihkan ditolak saat terkunci). 5 kali salah memicu jeda 30 detik yang berlipat sampai 15 menit, tersimpan lintas pembukaan ulang. Lupa PIN: kode pemulihan 16 karakter yang ditampilkan sekali, hangus dan diganti saat dipakai. **Bukan** mekanisme lisensi/anti-sebar (menunggu D-09). Batas: orang dengan akses berkas folder data dapat menghapus `kunci.json`; data SQLite tidak dienkripsi |
| CAP-17 | M | Pemeriksaan integritas saldo | Perintah "Periksa saldo" membandingkan saldo tersimpan dengan penjumlahan transaksi per siswa dan melaporkan selisih |
| CAP-18 | S | Slip saldo siswa | Cetak/PDF satu slip per siswa satu kelas (saldo dan 5 transaksi terakhir), dua kolom per halaman A4; semua teks lewat `esc()`; hanya membaca data |
| CAP-19 | S | Setoran massal per kelas | Isi nominal tiap siswa aktif satu kelas lewat keyboard; disimpan dalam **satu transaksi SQL** lewat `ledger.setor` (satu baris gagal = tidak ada yang tersimpan, nomor bukti tidak terpakai); satu siswa tidak boleh dua kali; maksimal 500 baris; aturan tanggal CAP-05 berlaku |
| CAP-20 | S | Tutup kas harian | Kas seharusnya = kas awal + setoran - penarikan pada tanggal itu; selisih terhadap uang fisik ditampilkan dan dicetak sebagai berita acara dengan tanda tangan. Kas awal dan uang fisik hanya masukan cetak, **tidak disimpan** |
| CAP-22 | S | Rekap bulanan dan saldo mengendap | Per bulan pada periode (tahun ajaran atau 12 bulan terakhir, maksimal 60 bulan): setoran, penarikan, jumlah transaksi, saldo akhir bulan; bulan kosong tetap tampil; saldo awal migrasi tidak dihitung sebagai setoran tetapi masuk saldo; grafik batang, ekspor Excel, cetak/PDF. Daftar siswa aktif bersaldo > 0 yang tidak bertransaksi 1/3/6/12 bulan. Hanya membaca data |
| CAP-23 | C | Riwayat aktivitas | Layar hanya-baca atas `audit_log` (terbaru dulu, halaman 100); tidak memuat nama atau nominal (NFR-02) |
| CAP-21 | S | Salinan cadangan ke flashdisk | Tombol memilih folder lewat dialog proses utama lalu membuat salinan dengan `VACUUM INTO` (bukan salin berkas mentah); waktu salinan terakhir dicatat di `audit_log` tanpa jalur; Beranda mengingatkan bila belum ada salinan atau lebih dari 14 hari |

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
| D-06 | Arti praktis **Saldo Tutup Buku** dan **Biaya Adm** di sekolah pengguna (per bulan, semester, atau tahun?) | Aturan CAP-08 dan penutupan periode. **Sebagian dijawab sementara (5 Okt 2026):** pemilik menyerahkan aturan Biaya Adm kepada agen; dibuat fleksibel (periode label bebas) dan tertulis di CAP-08. **Saldo Tutup Buku masih terbuka** (penutupan periode belum dibuat). Perlu dikonfirmasi ke bendahara nyata |
| D-07 | Batas nominal penarikan yang butuh persetujuan? Siapa penyetujunya? | Perlu peran kedua bila ya |
| D-08 | Lebih dari satu operator pada satu komputer? Perlu akun terpisah? | Peran dan audit per pengguna |
| D-09 | Model distribusi: gratis, dijual lisensi, atau per sekolah? | Mekanisme lisensi (tidak dibuat tanpa permintaan) |
| D-10 | Ukuran struk: 58 mm, 80 mm, atau kertas kecil A6? | Tata letak cetak |

## 7. Rencana rilis

| Rilis | Isi |
| --- | --- |
| **0.1 (Windows)** | CAP-01 sampai CAP-07, CAP-09 sampai CAP-11, CAP-12 dan CAP-14 (dimajukan atas arahan pemilik), CAP-13, CAP-17 |
| **0.2 (Windows)** | CAP-08, CAP-15, CAP-16, CAP-18 sampai CAP-23 (rutinitas harian dan laporan bendahara, dimajukan atas arahan pemilik) |
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
