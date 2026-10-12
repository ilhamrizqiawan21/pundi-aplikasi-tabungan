# GEMINI.md — Pundi

@AGENTS.md

## Tambahan untuk Gemini (peran: pelaksana implementasi)

Aturan lengkap ada di AGENTS.md (diimpor di atas). Bagian ini hanya menambahkan hal yang khusus untuk pelaksana implementasi. Bila ada pertentangan, AGENTS.md dan instruksi eksplisit pemilik menang.

### Peran dan batas

- **Peran.** Anda mengerjakan kode. Arsitektur, ERD, kontrak IPC, dan keputusan `A-xx`/`D-xx` ditentukan pemilik proyek dan direview terpisah. Jangan mengubahnya sendiri. Bila implementasi menuntut perubahan rancangan, **berhenti dan laporkan**.
- **Satu tugas per kali.** Kerjakan satu ID di [TODO.md](TODO.md) (misalnya F7-1). Jangan menyentuh berkas di luar tugas itu. Hal menarik di luar tugas **dicatat dalam laporan, bukan dikerjakan**. Perubahan kecil yang mudah direview sebagai diff.
- **Jangan mengarang** perintah, dependensi, versi, atau hasil uji. Bila ragu apakah sesuatu ada di kode, **baca/cari dulu**. Jangan menambah dependensi tanpa alasan konkret yang dilaporkan lebih dulu.
- **Clean-room:** jangan membongkar, menyalin, atau meniru kode, teks, atau aset dari aplikasi lama.
- **Jangan commit atau push** kecuali diminta. Pesan commit deskriptif (apa dan mengapa), satu commit satu maksud.

### Rencana yang sedang berjalan

Fase aktif: **F7 (backend), F8 (frontend), F9 (fitur)** dalam [docs/RENCANA_KOMERSIAL.md](docs/RENCANA_KOMERSIAL.md). Baca bagian tugasnya (acceptance criteria) sebelum mulai.

- Urutan: F7 lebih dulu, lalu F8, lalu F9. Jangan melompati fase.
- **F9-4 (lisensi) ditunda menunggu D-09: jangan dikerjakan.** Begitu pula pinjaman, bank, buku fisik, bunga (D-02..D-05) dan multi-operator (D-08).
- F7-7, S-02, S-03, S-01b butuh perangkat/tindakan pemilik: siapkan daftar periksa, jangan klaim selesai.

### Alur tiap tugas

1. **Sebelum menulis kode**, sebutkan: ID tugas, CAP/NFR terkait, berkas yang akan dibuat atau diubah, risiko, dan cara membuktikan berhasil. Baca kode di sekitarnya dan ikuti konvensi (penamaan Indonesia, gaya, struktur).
2. **Uji dulu bila menyentuh logika** (merah, lalu hijau). Perubahan pada `ledger` wajib ada uji berbasis properti (AGENTS).
3. **Kerjakan perubahan terkecil yang benar.** Jangan memformat ulang atau merombak kode di luar cakupan.
4. **Verifikasi** dengan perintah di AGENTS (bagian Perintah): `npm run typecheck`, `npm run lint`, `npm test`, dan `npm run test:e2e` bila menyentuh UI/proses utama. Laporkan keluaran aslinya. Jangan menukar binary `better-sqlite3` secara manual (`scripts/native.mjs` yang mengurus).
5. **Perbarui TODO.md** (kolom Bukti dan ✓) hanya berdasarkan bukti nyata; perbarui dokumen terdampak (PRD/ERD/ARCHITECTURE/DESIGN) bila perilaku atau skema berubah.
6. **Laporan akhir**: ringkasan perubahan, perintah uji beserta hasilnya (lulus/gagal apa adanya), yang dilewati, keterbatasan, dan pertanyaan terbuka.

### Pagar pengaman yang paling sering dilanggar

- **Uang & buku besar:** hanya layanan `ledger` yang menulis `transaksi`; nominal bilangan bulat rupiah (tanpa `REAL`/`float`); tabel `transaksi` tidak pernah di-`UPDATE`/`DELETE`; setiap penulisan dalam satu transaksi SQL. Refaktor `ledger` (F7-5) **tidak boleh mengubah perilaku**: seluruh uji termasuk uji properti dan CAP-17 harus tetap lulus.
- **Basis data:** migrasi hanya maju, berkas SQL bernomor baru di `migrations/`; **jangan edit migrasi yang sudah ada**. Tambah indeks/kolom hanya lewat migrasi baru dan perbarui ERD. Jangan menyentuh basis data data-nyata; uji memakai folder sementara dan data sintetis.
- **Electron:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Renderer hanya lewat `window.pundi`; setiap handler IPC memverifikasi pengirim dan memvalidasi dengan `zod`. Jangan menambah API yang menerima jalur file dari renderer. Tanpa jaringan, CDN, font eksternal, atau telemetri.
- **Privasi & log:** log hanya jumlah, kode galat, durasi, tidak pernah nama, nomor, atau nominal. Tidak ada data siswa nyata, kredensial, atau sertifikat di repositori.
- **Cetak:** semua data yang masuk HTML cetak lewat `esc()`; ukuran fisik `mm`/`pt`. Cetak baru dianggap selesai setelah diukur pada cetak nyata; sampai itu, tulis "belum diukur".

### Pedoman frontend (F8)

- Pakai token di `src/renderer/styles/tokens.css` (DESIGN §2). **Dilarang menulis warna heksadesimal baru di komponen.** Kode baru memakai kelas CSS dan komponen dasar, **bukan** `style={{…}}` inline.
- Migrasi layar **satu per tugas**. Alur Catat Transaksi harus tetap bisa tanpa mouse (Ctrl+K, Alt+1..9, Esc bertingkat); Playwright terkait harus tetap lulus sebelum lanjut ke layar berikutnya.
- Teks layar Bahasa Indonesia sesuai DESIGN §7a; tanpa istilah teknis. Elemen interaktif memakai elemen asli, berlabel, fokus terlihat, kontras AA di semua tema.
- Hormati `prefers-reduced-motion`. Jangan menambah animasi yang menunda input.
- Mengubah `minWidth` jendela atau titik henti responsif: **laporkan alasan dan bukti tangkapan layar/uji pada lebar 800/1024/1280/1920 px**.
- Komponen/berkas dijaga di bawah ±800 baris dan fungsi di bawah ±50 baris; hindari nesting dalam, gunakan early return.

### Kapan berhenti dan bertanya

Berhenti dan laporkan (jangan menebak) bila: tugas menuntut perubahan ERD/kontrak IPC/keputusan `A-xx`/`D-xx`; dokumen dan kode bertentangan; uji yang ada gagal sebelum Anda mengubah apa pun; perlu dependensi baru; perlu menghapus/menimpa berkas pengguna; atau perlu tindakan yang tidak dapat dibatalkan (force-push, hapus rilis, hapus data).
