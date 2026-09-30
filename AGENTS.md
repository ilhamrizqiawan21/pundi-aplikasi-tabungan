# Panduan Agen — Pundi

> Bila ada `MASTER.md` atau aturan pribadi di tingkat lebih atas, itu berlaku lebih dulu. Instruksi eksplisit pengguna mengungguli berkas ini.

## Konteks dan cakupan

- **Pundi** (nama sementara, D-01): aplikasi desktop **offline** untuk mencatat tabungan siswa (setoran, penarikan, koreksi, laporan, backup). Windows dulu, macOS Apple Silicon menyusul.
- Pengguna: bendahara/operator dan admin sekolah; satu komputer, satu operator.
- Stack: Electron, TypeScript `strict`, React + Vite, SQLite (`better-sqlite3`), `exceljs`, `zod`, cetak-ke-PDF Chromium. Lihat [ARCHITECTURE](docs/ARCHITECTURE.md) untuk status bukti; beberapa pilihan masih menunggu spike (S-01 sampai S-05).
- Rilis 0.1 hanya yang ada di [PRD](docs/PRD.md) §7. **Jangan menganggap fitur yang belum ada di TODO sebagai tersedia.**
- **Tidak dibuat** tanpa permintaan lanjutan: multi-pengguna atau jaringan, sinkronisasi cloud, aplikasi seluler, integrasi bank, pembaruan otomatis, lisensi atau pembayaran di dalam aplikasi, pinjaman/bank/buku tabungan fisik/bunga (menunggu D-02 sampai D-05).

## Aturan clean-room (wajib)

Aplikasi ini **ditulis ulang dari nol**. Siata Garuda (dan aplikasi lama sejenis) hanya boleh menjadi **referensi kebutuhan fungsi**.

- **Jangan** membongkar (decompile/disassemble) program pihak lain untuk mengambil kode, logika, atau aset, dan jangan meminta atau membantu melakukannya. Kecuali pemilik proyek membuktikan punya hak atas kode itu, dan itu dicatat tertulis di repositori.
- **Jangan** menyalin teks layar, nama variabel/tabel/kolom, ikon, skin, gambar, tata letak, atau file dari aplikasi lama. Tulis teks dan desain sendiri dari [DESIGN](docs/DESIGN.md).
- **Boleh**: mencatat fungsi dan alur dari pemakaian aplikasi atau dari wawancara pengguna, menyusun spesifikasi dengan kata sendiri, dan memigrasikan **data milik pengguna sendiri** lewat berkas ekspor (Excel) yang mereka hasilkan.
- Bila ragu apakah sesuatu boleh dipakai, **tanyakan dan catat keputusannya**, jangan menebak. Pertanyaan hak cipta dan lisensi ke penerbit diputuskan pemilik, bukan agen.

## Sumber kebenaran

1. [PRD](docs/PRD.md): perilaku produk, acceptance criteria `CAP-xx` dan `NFR-xx`, keputusan terbuka `D-xx`.
2. [ERD](docs/ERD.md): data dan integritas.
3. [ARCHITECTURE](docs/ARCHITECTURE.md): rancangan teknis, keamanan, keputusan `A-xx`, spike `S-xx`.
4. [DESIGN](docs/DESIGN.md): token, layar, alur, cetak, salinan teks.
5. [TODO](TODO.md): pekerjaan, dependensi, bukti selesai.

Bila dokumen dan kode berbeda, **jangan menebak diam-diam**: jelaskan konfliknya, ikuti arahan terbaru pemilik, lalu perbarui dokumen dan pengujian terkait. Jangan menyalin aturan ke tempat lain tanpa merujuk ID sumbernya.

## Cara kerja dengan pemilik proyek

- Pembagian yang diinginkan: agen dipakai untuk **arsitektur, perencanaan, dan review**. Implementasi dapat dikerjakan alat lain atau pemilik sendiri. Bila diminta menulis kode, tulis irisan kecil yang dapat direview sebagai diff.
- **Mode fundamental** (bila diminta): jelaskan konsep dan sintaks, biarkan pemilik mengetik kode yang bermakna, lalu review.
- Review mencakup: ketepatan, keamanan, validasi masukan, verifikasi pengirim IPC, kinerja, penanganan galat, keterawatan, pengujian, dampak pada pemasangan dan rilis. Sertakan bukti atau penalaran, bukan sekadar vonis.
- Utamakan **perbaikan akar masalah** dan arsitektur sederhana; jangan menambah abstraksi atau dependensi tanpa alasan konkret.
- **Jangan membuat klaim yakin tanpa bukti.** Bedakan yang sudah dijalankan, yang hanya dibaca, dan yang diasumsikan. Bila tidak tahu, katakan tidak tahu.
- Hemat: baca berkas secara terarah, rencana ringkas.

## Alur kerja

1. Baca bagian dokumen yang relevan (CAP/NFR/A-xx/D-xx) sebelum menyentuh kode.
2. Tentukan tujuan, cakupan, risiko (uang, data pengguna, keamanan Electron, hasil cetak), dan cara membuktikan berhasil.
3. Kerjakan perubahan **terkecil** yang benar; tambah atau perbarui uji sesuai risiko.
4. Jalankan pemeriksaan yang relevan. Perintah aktual dicatat di bagian Perintah setelah scaffold ada; **jangan mengarang perintah**.
5. Perbarui `TODO.md` hanya berdasarkan bukti nyata.
6. Laporkan: apa yang berubah, apa yang diuji, hasilnya, keterbatasan.

## Aturan teknis

### Uang dan buku besar (NFR-03)
- Nominal **selalu bilangan bulat rupiah**. Dilarang `REAL`/`float` untuk uang, di basis data maupun kode.
- Tabel `transaksi` **tambah-saja**: tidak ada `UPDATE` atau `DELETE`, dan pemicu basis data menolaknya. Koreksi = transaksi pembalik dengan alasan.
- **Hanya layanan `ledger` yang menulis ke `transaksi`.** Jangan membuat jalur tulis lain, dan jangan mengubah `saldo_setelah` dari luar `ledger`.
- Setiap penulisan dalam **satu transaksi SQL**; nomor bukti dan nomor siswa dibuat di dalamnya.
- Perubahan pada `ledger` wajib disertai uji berbasis properti (saldo tidak negatif, jumlah = saldo, CAP-17 nol selisih).

### Keamanan Electron (NFR-01, NFR-07)
- Setiap jendela: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Jendela cetak: `javascript: false`, tanpa preload.
- Renderer hanya berbicara lewat `window.pundi`. **Jangan menambah API yang menerima jalur file** dari renderer; pakai token dari dialog yang dibuka main.
- Setiap penangan IPC memverifikasi pengirim dan memvalidasi argumen dengan `zod`.
- **Tidak ada jaringan** dan **tidak ada server HTTP lokal**. Jangan menambah CDN, font eksternal, atau telemetri.
- Blokir navigasi dan jendela baru; tolak permintaan izin. Bila membandingkan URL, pakai `new URL(url).origin ===`, bukan `startsWith`.
- Semua data yang masuk HTML cetak wajib lewat `esc()`.

### Data dan privasi (NFR-02)
- **Jangan meng-commit data siswa nyata, berkas basis data, atau kredensial.** `*.sqlite*`, `backups/`, `logs/`, `.env*`, dan berkas catatan akun ada di `.gitignore`. (Dua repositori pemilik pernah tanpa sengaja memuat `pib.sqlite` dan berkas berisi password admin; jangan diulangi.)
- Data uji dan berkas contoh hanya **sintetis** (nama fiktif).
- Log hanya berisi jumlah, kode galat, durasi. Tidak pernah nama, nomor, atau nominal.
- Tidak ada password bawaan (`admin/admin`). Bila ada PIN, simpan sebagai hash.

### Basis data
- Migrasi hanya maju, berkas SQL bernomor di `migrations/`. **Jangan mengedit migrasi yang sudah dirilis.**
- Cadangkan sebelum migrasi. `PRAGMA foreign_keys = ON`, WAL.
- Jangan menambah tabel atau kolom di luar [ERD](docs/ERD.md) tanpa memperbarui ERD dan PRD.
- Backup memakai API backup SQLite atau `VACUUM INTO`, bukan menyalin berkas mentah saat aplikasi berjalan.

### Antarmuka
- Seluruh teks layar Bahasa Indonesia sesuai [DESIGN](docs/DESIGN.md) §7a. Hindari istilah teknis di layar.
- Font dan aset dibundel. Pakai token DESIGN §2; jangan menulis warna heksadesimal baru di komponen.
- Elemen interaktif memakai elemen asli, berlabel, dapat dioperasikan keyboard. Alur Catat Transaksi harus bisa tanpa mouse.

### Cetak
- Ukuran fisik memakai `mm` dan `pt`. Preview dan berkas memakai **satu jalur render**.
- Struk dan laporan dianggap selesai hanya setelah **diukur pada cetak nyata**.

## Git

- Pesan commit **deskriptif** (apa dan mengapa), bukan "fix" atau "update". Satu commit satu maksud.
- Jangan commit rahasia, jalur pribadi, atau data nyata.
- Jangan mengubah riwayat yang sudah dibagikan tanpa diminta.
- Nama tag rilis harus sama dengan `version` di `package.json` (`v0.1.0` untuk `0.1.0`); jangan memakai karakter khusus seperti `#` pada nama tag.

## Batas tindakan

- Jangan menghapus, menimpa, atau memindahkan berkas milik pengguna di luar folder proyek.
- Jangan menjalankan migrasi atau uji yang menyentuh basis data data-nyata.
- Jangan memasang tanda tangan kode, sertifikat, atau kredensial di repositori.
- Untuk pekerjaan yang tidak dapat dibatalkan (force-push, hapus rilis, hapus data), jelaskan rencana dan **tunggu persetujuan**.

## Definisi selesai

Memenuhi acceptance criteria CAP/NFR terkait; lint, typecheck, dan uji lulus dengan hasil dicatat; tidak ada peringatan keamanan baru; dokumen terdampak diperbarui; `TODO.md` mencatat bukti. Untuk cetak: **sudah diukur pada cetak nyata**. Untuk build: dijalankan pada platform targetnya.

## Perintah

Belum ada. Scaffold dikerjakan di TODO F2. Setelah ada, catat di sini perintah aktual untuk: pengembangan, lint, typecheck, uji unit, uji alur, bangun installer Windows, bangun macOS.
