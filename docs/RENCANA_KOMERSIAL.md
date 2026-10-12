# Rencana Penyiapan Komersial — Pundi

Status: draf usulan, 12 Oktober 2026. Pemilik: Ilham Rizqiawan. Disusun dari pembacaan kode dan dokumen; **belum ada pengujian yang dijalankan** saat penyusunan. Tugas dieksekusi oleh Gemini (lihat [GEMINI](../GEMINI.md)), direview terpisah. Daftar tugas ber-ID ada di [TODO](../TODO.md) fase F7 sampai F9.

## 1. Tujuan

Membuat Pundi siap dipakai dan siap dijual lewat tiga aspek: **backend** (setiap proses berjalan semestinya), **fitur**, dan **frontend** (modern, profesional, responsif).

**Bukan tujuan** (tetap berlaku dari [AGENTS](../AGENTS.md)): multi-pengguna/jaringan, cloud, seluler, integrasi bank, pembaruan otomatis, pinjaman/bank/buku fisik/bunga (D-02 sampai D-05). Lisensi hanya dibuat setelah D-09 diputuskan.

## 2. Temuan awal (dari pembacaan kode)

| Area | Temuan | Dampak |
| --- | --- | --- |
| Proses utama | Tidak ada `requestSingleInstanceLock`, penangan `uncaughtException`/`render-process-gone`, maupun log berkas; `index.ts` hanya `console.error` | Dua jendela dapat membuka SQLite yang sama; crash tanpa jejak |
| Backup | Jenis `otomatis` dan retensi ada di `backup.ts`, tetapi penjadwal harian belum terlihat di `main` (belum diverifikasi menyeluruh) | CAP-13 dan NFR-06 belum terbukti |
| Kinerja | NFR-04 (5.000 siswa, 200.000 transaksi) belum punya bukti | Risiko lambat di sekolah besar |
| Berkas besar | `ledger.ts` 774 baris, `ipc/index.ts` 514 baris, `CatatTransaksiScreen.tsx` 1003 baris | Sulit dirawat dan direview |
| Distribusi | Tanpa CI; installer belum diuji di komputer bersih; belum ditandatangani | SmartScreen memperingatkan pembeli |
| Frontend | Sekitar 700 `style={{…}}` inline; media query hanya di `layout.css` berdasarkan lebar jendela; lebar minimum 1024 px; tema (CAP-15) belum selesai | Tema dan responsivitas mahal diubah |

## 3. Urutan kerja

Fase berurutan; fase berikutnya tidak dimulai sebelum bukti fase sebelumnya ada.

1. **F7 Backend dan keandalan**: kecil dan berisiko rendah, dikerjakan lebih dulu.
2. **F8 Frontend**: fondasi (token, komponen dasar, tema) sebelum migrasi layar.
3. **F9 Fitur komersial**: onboarding, bantuan, buku besar cetak; lisensi menunggu D-09.

## 4. F7 — Backend dan keandalan

| ID | Tugas | Acceptance criteria |
| --- | --- | --- |
| F7-1 | Instance tunggal | `app.requestSingleInstanceLock()`; instance kedua memfokuskan jendela pertama lalu keluar. Uji Playwright: peluncuran kedua tidak membuat jendela baru |
| F7-2 | Log lokal dan penangan crash | Log berkas di `userData/logs/` dengan rotasi; hanya jumlah, kode galat, durasi (NFR-02, **tanpa nama/nomor/nominal**). Tangani `uncaughtException`, `unhandledRejection`, `render-process-gone`: catat, tampilkan pesan Indonesia yang ramah, tidak menelan galat diam-diam. Uji unit pada penulis log (tidak ada data sensitif) |
| F7-3 | Penjadwal backup otomatis | Verifikasi dulu apakah sudah ada. Bila belum: backup otomatis harian saat aplikasi dibuka bila yang terakhir lebih tua dari 24 jam dan pengaturan `backup_otomatis` aktif; juga sebelum migrasi (AGENTS: cadangkan sebelum migrasi). Retensi 7. Uji dengan jam yang dapat disuntik |
| F7-4 | Uji kinerja NFR-04 | Skrip seed sintetis 5.000 siswa dan 200.000 transaksi (lewat `ledger`, bukan SQL langsung) di folder sementara. Ukur pencarian siswa (<200 ms), catat transaksi (<300 ms), rekap (<3 s). Laporkan angka nyata; tambah indeks lewat **migrasi baru** bila perlu (jangan edit migrasi lama; perbarui ERD) |
| F7-5 | Pecah berkas besar | Pecah `ipc/index.ts` per domain dan `ledger.ts` per tanggung jawab **tanpa mengubah perilaku**; semua uji tetap lulus; satu domain per commit. Hanya `ledger` yang menulis `transaksi` |
| F7-6 | CI Windows (sama dengan F2-5) | Alur kerja `windows-latest`: install, typecheck, lint, `npm test`, build, `pack:win`; artefak installer. Tanpa rahasia di repositori |
| F7-7 | Uji installer di komputer bersih | **Dikerjakan pemilik**; Gemini menyiapkan daftar periksa (pasang, buka, buat siswa, setor, cadangkan, pulihkan, copot) di `docs/` |

## 5. F8 — Frontend modern dan responsif

Aturan tetap: font dan aset dibundel, tanpa CDN; pakai token [DESIGN](DESIGN.md) §2 dan **jangan menulis warna heksadesimal baru di komponen**; seluruh teks Indonesia sesuai DESIGN §7a; elemen asli, berlabel, dapat dioperasikan keyboard.

| ID | Tugas | Acceptance criteria |
| --- | --- | --- |
| F8-1 | Audit dan perluas token | Daftar token yang ada di `tokens.css`; tambah token spasi, radius, bayangan, tipografi (skala `clamp()`) dan warna semantik (sukses/bahaya/peringatan) bila belum ada. Perbarui DESIGN §2 |
| F8-2 | Komponen dasar bersama | `Button`, `Card`, `Field`/`Input`, `Table`, `Badge`, `EmptyState`, `Toast` di `src/renderer/components/ui/`; berbasis kelas CSS dan token, bukan gaya inline; label dan fokus terlihat |
| F8-3 | Tema (CAP-15, sama dengan F4-4 bagian tema) | Lima tema, bawaan putih, tersimpan lewat `pengaturan` (kunci `tema` yang sudah diizinkan); kontras teks memenuhi WCAG AA di tiap tema; teruji Playwright (ganti tema, muat ulang, tetap) |
| F8-4 | Migrasi layar ke komponen dasar | Satu layar per tugas, urutan: Beranda, Catat Transaksi (alur tanpa mouse **tidak boleh rusak**), Siswa, Laporan, Akademik, Kenaikan, Impor, Cadangan, Pengaturan. Setiap layar: hapus gaya inline, uji Playwright terkait tetap lulus. Pecah `CatatTransaksiScreen.tsx` menjadi bagian <800 baris |
| F8-5 | Responsif sungguhan | Evaluasi menurunkan `minWidth` jendela (kini 1024) ke sekitar 800 px; tabel menjadi kartu pada lebar sempit; skala layar 125–150% tanpa terpotong; perbarui `responsif.spec.ts` untuk 800/1024/1280/1920 px. **Bila perlu mengubah `minWidth`, laporkan lebih dulu** |
| F8-6 | Kesan modern | Keadaan kosong, skeleton pemuatan, toast pengganti pesan statis, transisi halus yang menghormati `prefers-reduced-motion`. Tanpa animasi pada alur Catat Transaksi yang menunda input |
| F8-7 | Audit aksesibilitas | Kontras, urutan fokus, label ARIA, perangkap fokus dialog; laporan temuan dan perbaikan; uji keyboard (NFR-08) tetap lulus |

## 6. F9 — Fitur untuk dijual

| ID | Tugas | Acceptance criteria |
| --- | --- | --- |
| F9-1 | Selesaikan sisa rilis 0.1/0.2 | Uji alur untuk buku besar per siswa (F3-8) termasuk cetak/PDF dan filter tanggal (CAP-10); uji manual dialog folder salinan flashdisk (F4-8) dicatat |
| F9-2 | Wizard onboarding | Pada instalasi baru (tanpa tahun ajaran/profil): profil sekolah, tahun ajaran, kelas, lalu impor siswa atau lewati. Dapat dilewati dan dilanjutkan; keyboard penuh; tidak muncul lagi setelah selesai |
| F9-3 | Bantuan dalam aplikasi | Layar "Bantuan": panduan singkat per alur, daftar pintasan keyboard, halaman Tentang (versi dari `package.json`, tanpa jaringan). Teks ditulis sendiri sesuai DESIGN §7a |
| F9-4 | Lisensi dan aktivasi offline | **Ditunda sampai D-09 dijawab pemilik.** Jangan dikerjakan atau dirancang oleh pelaksana |

## 7. Keputusan terbuka yang memengaruhi rencana

- **D-09** (model jual: lisensi per sekolah, sekali beli, atau langganan) menentukan F9-4.
- **D-01** (nama final) menentukan branding, ID aplikasi `id.pundi.app`, dan nama installer; cek merek sebelum dijual.
- Tanda tangan kode Windows: perlu sertifikat dari pemilik (tidak dimasukkan ke repositori).
- F7-7, S-02, S-03 (cetak nyata) dan S-01b (macOS) membutuhkan perangkat milik pemilik.

## 8. Risiko

| Risiko | Mitigasi |
| --- | --- |
| Refaktor frontend merusak alur tanpa mouse | Satu layar per tugas; Playwright lulus sebelum lanjut |
| Pemecahan `ledger`/IPC mengubah perilaku uang | Tanpa perubahan perilaku; uji properti dan CAP-17 harus tetap lulus |
| Indeks baru memerlukan migrasi | Migrasi bernomor baru, cadangan sebelum migrasi, ERD diperbarui |
| Cakupan melebar | Satu ID per kali; hal di luar tugas dicatat, bukan dikerjakan |
