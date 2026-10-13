# Panduan Uji Manual Salinan Cadangan ke Flashdisk (CAP-21 / F4-8) — Pundi

> Dokumen ini adalah daftar periksa pengujian manual untuk pemilik proyek atau operator guna memverifikasi fitur penyalinan cadangan ke media eksternal (flashdisk / hard disk eksternal) dengan dialog sistem operasi nyata.  
> Bagian otomatis (`VACUUM INTO`, pencatatan audit log tanpa jalur file, dan banner pengingat Beranda) telah diverifikasi pada `src/main/services/rutinitas-harian.test.ts` dan `tests/e2e/harian.spec.ts`.

---

## 1. Landasan Teknis & Keamanan (NFR-01, NFR-02, NFR-07)

- **Keamanan Jalur File (NFR-07)**: Renderer tidak pernah menerima atau memegang jalur folder sistem berkas. Dialog pemilihan folder dijalankan sepenuhnya di proses utama Electron (`dialog.showOpenDialog`).
- **Integritas Database**: Pembuatan berkas cadangan tidak menyalin berkas mentah yang sedang aktif, melainkan menggunakan perintah SQLite `VACUUM INTO` untuk menjamin berkas salinan bebas korupsi dan konsisten secara transaksional.
- **Privasi Log (NFR-02)**: Riwayat audit mencatat tindakan `backup.salinKeLuar` dengan nama berkas hasil salinan tanpa pernah mencatat jalur folder lengkap pengguna.
- **Pengingat Berkala**: Bila belum pernah ada salinan luar atau salinan terakhir telah melewati batas 14 hari, bilah samping dan Beranda menampilkan pengingat untuk mengamankan data ke luar komputer.

---

## 2. Langkah Pengujian Manual

| No | Tindakan | Hasil yang Diharapkan | Status |
| :-: | :--- | :--- | :-: |
| 1 | Hubungkan flashdisk USB ke komputer Windows. | Flashdisk terdeteksi di Windows Explorer (misal Drive `D:\` atau `E:\`). | [ ] |
| 2 | Buka aplikasi Pundi. | Aplikasi terbuka normal pada menu Beranda. | [ ] |
| 3 | Periksa bilah samping atau Beranda bila belum pernah salin. | Tampil kartu pengingat cadangan data ("Perlu dicadangkan" / "Pengingat salinan cadangan"). | [ ] |
| 4 | Buka menu **Cadangan & Pemulihan** (atau tekan `Alt+8`). | Layar Cadangan dan Pemulihan Data terbuka. | [ ] |
| 5 | Klik tombol **"Salin ke Flashdisk"** (atau "Salin Cadangan ke Luar"). | Dialog native Windows (*Select Folder*) muncul di layar. | [ ] |
| 6 | Arahkan ke drive flashdisk USB Anda, lalu klik tombol **"Select Folder"** / **"Pilih Folder"**. | Dialog tertutup, tombol memproses salinan. | [ ] |
| 7 | Perhatikan notifikasi hasil di layar. | Tampil pesan sukses: *"Salinan cadangan tersimpan di folder pilihan Anda (pundi_salinan_YYYYMMDD_HHMMSS.sqlite)"*. | [ ] |
| 8 | Buka Windows Explorer ke flashdisk. | Berkas `pundi_salinan_YYYYMMDD_HHMMSS.sqlite` ada, memiliki ukuran bytes yang wajar (> 0 KB), dan tidak korup. | [ ] |
| 9 | Buka menu **Pengaturan** -> panel **Riwayat Aktivitas**. | Tercatat riwayat *"Salinan cadangan ke flashdisk"* pada jam transaksi tanpa mencantumkan jalur folder absolut komputer. | [ ] |
| 10 | Buka menu **Beranda**. | Status cadangan diperbarui dan peringatan kadaluarsa telah reda. | [ ] |
| 11 | *(Uji Batal)* Klik kembali "Salin ke Flashdisk", lalu tekan tombol **Batal / Cancel** pada dialog Windows. | Tidak ada galat sistem; layar tetap normal dan data tidak terganggu. | [ ] |

---

## 3. Catatan Tambahan

Pengujian dialog native ini hanya memerlukan waktu ±2 menit dan memastikan interaksi sistem operasi Windows berjalan tanpa kendala izin akses (*permission denied*) pada drive flashdisk FAT32, exFAT, maupun NTFS.

