# TODO — Pundi

Status: 4 Oktober 2026. Rujukan: [PRD](docs/PRD.md), [ERD](docs/ERD.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [DESIGN](docs/DESIGN.md), [AGENTS](AGENTS.md).

Aturan: sebuah tugas hanya ditandai **[x]** bila ada **bukti** (perintah dan hasilnya, atau tautan berkas) di kolom Bukti. Fase berikutnya tidak dimulai sebelum dependensinya selesai. `S` = spike, `F` = fase.

## F0 — Penemuan (tanpa kode)

| ID | Tugas | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F0-1 | Jawab D-02 (pinjaman), D-03 (bank), D-04 (buku fisik), D-05 (bunga) bersama pengguna nyata | — | Catatan wawancara | [ ] |
| F0-2 | Jawab D-06 (Tutup Buku dan Biaya Adm), D-07 (batas penarikan), D-08 (jumlah operator) | — | Catatan | [ ] |
| F0-3 | Jawab D-01 (nama), D-09 (model distribusi), D-10 (ukuran struk) | — | Catatan | [ ] |
| F0-4 | **Keputusan izin**: pastikan hak menggunakan dan memigrasikan data dari aplikasi lama; hubungi penerbit bila perlu | — | Catatan tertulis | [ ] |
| F0-5 | Catat alur pemakaian aplikasi lama (dari pemakaian atau video) sebagai spesifikasi fungsi, dengan kata sendiri | F0-4 | Berkas catatan | [ ] |
| F0-6 | Perbarui PRD (cakupan 0.1/0.2/0.3) dari jawaban F0-1 sampai F0-3 | F0-1..3 | Diff PRD | [ ] |

## F1 — Spike (bukti sebelum bergantung)

| ID | Tugas | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| S-01 | Aplikasi Electron kosong + `better-sqlite3` menulis satu baris, dibangun di **Windows x64** | — | Log: Electron + better-sqlite3 menulis & membaca SQLite 3.53.4. Installer belum dicatat sebagai bukti S-01 | [x] |
| S-01b | Sama, dibangun di **macOS arm64** (Mac atau CI `macos-14`), dijalankan di Apple Silicon | S-01 | Build, tangkapan layar | [ ] |
| S-02 | Cetak struk contoh ke printer termal yang dipakai pengguna (58/80 mm) | F0-3 | Foto hasil cetak, ukuran diukur | [ ] |
| S-03 | `printToPDF` laporan 200 baris multi-halaman, font dibundel | S-01 | PDF contoh | [ ] |
| S-04 | Impor Excel hasil ekspor aplikasi lama (berkas **sintetis**) tanpa selisih | F0-4 | Uji lulus | [ ] |
| S-05 | Trigger anti-ubah dan `VACUUM INTO` di WAL | S-01 | Uji lulus: UPDATE/DELETE ditolak trigger, VACUUM INTO cocok | [x] |

## F2 — Scaffold

| ID | Tugas | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F2-1 | Inisialisasi repositori, `.gitignore` (sqlite, backups, logs, `.env*`, catatan akun), `package.json` versi `0.1.0` | S-01 | package.json v0.1.0 dibuat, npm install berhasil | [x] |
| F2-2 | Struktur `main/preload/renderer/shared`, Electron aman (NFR-07), protokol aplikasi tanpa server HTTP | F2-1 | Struktur src/, protokol pundi-app://, contextIsolation, sandbox | [x] |
| F2-3 | Lint, typecheck, Vitest, Playwright terpasang; catat perintah di AGENTS | F2-1 | `npm run typecheck`, `npm run lint` (ESLint), `npm test` (33 uji) dan `npm run test:e2e` (Playwright, 8 lulus + 3 fixme) dijalankan dan lulus; perintah dicatat di AGENTS | [x] |
| F2-4 | Migrasi `0001_awal.sql` sesuai ERD, termasuk pemicu anti-ubah | F2-2, S-05 | Uji migrasi lulus: UPDATE/DELETE ditolak trigger | [x] |
| F2-5 | CI Windows (`windows-latest`) membangun installer | F2-1 | Run hijau | [ ] |

## F3 — Inti (rilis 0.1)

| ID | Tugas | CAP | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- | --- |
| F3-1 | `shared/rupiah.ts` dan skema `zod` | NFR-03 | F2-2 | Uji lulus (rupiah.test.ts) | [x] |
| F3-2 | Layanan `ledger` + uji berbasis properti | 05–07, 17 | F2-4, F3-1 | Uji lulus: 500 transaksi acak & CAP-17 nol selisih | [x] |
| F3-3 | `akademik` (tahun ajaran, kelas) | 02 | F2-4 | Uji lulus: akademik.test.ts (9 uji: satu aktif, duplikat, kelas tak bisa pindah tahun, hapus bersyarat, salin kelas, penempatan hanya di tahun aktif) + Playwright akademik.spec.ts (5 alur dari instalasi kosong) | [x] |
| F3-4 | `siswa` (CRUD, penempatan, status, nomor unik) | 03 | F3-3 | Uji lulus (siswa.test.ts & SiswaScreen.tsx) | [x] |
| F3-5 | Profil sekolah dan pengaturan | 01 | F2-4 | `pengaturan.ts` dan PengaturanScreen ada. `pengaturan.test.ts` (4 uji) lulus: kolom profil dapat dikosongkan, logo tidak berubah, hanya kunci `tema`/`backup_otomatis`/`ukuran_struk` yang tertulis, skema IPC membuang jalur berkas dan hash PIN. **Belum: uji alur UI Pengaturan** | [ ] |
| F3-6 | Layar Catat Transaksi (keyboard penuh) | 05, 06 | F3-2, F3-4 | Playwright lulus (22 uji total): cari, setor, tarik, tolak saldo kurang tanpa mouse; Ctrl+K global, Alt+1..9, Esc bertingkat, pintasan nonaktif saat dialog, fokus terlihat. Sebelumnya 3 `test.fixme` kini hidup | [x] |
| F3-7 | Koreksi (dialog + pembalik) | 07 | F3-2 | Ledger teruji (alasan wajib, maks 255, pembalik tak bisa dibalik, saldo tak negatif). "Batalkan (Koreksi)" di Catat Transaksi kini membuka KoreksiModal dengan alasan dari pengguna; teruji di Playwright (alasan pendek ditolak, alasan tersimpan di keterangan). **Belum: uji alur koreksi dari layar Siswa** | [ ] |
| F3-8 | Buku besar per siswa | 10 | F3-2 | Layanan ledger teruji; layar buku besar belum ada uji alur | [ ] |
| F3-9 | Impor siswa Excel/CSV (pratinjau, atomik) | 04 | F3-4, S-04 | Uji lulus: impor.test.ts (14 uji) + Playwright impor.spec.ts (5 alur). Memenuhi CAP-04: format contoh dapat diunduh, pratinjau, baris bermasalah dengan nomor baris dan alasan, atomik, tanpa menggandakan (NIS). Memperbaiki cacat lama (CSV mengubah "50.000" jadi 50 dan NIS "007" jadi 7). **S-04 tetap terbuka**: belum dicoba dengan hasil ekspor aplikasi lama yang sebenarnya | [x] |
| F3-10 | Struk dan cetak | 09 | S-02, S-03 | Template HTML ter-escape (receipt.ts). **Belum diukur pada cetak nyata (S-02/S-03)** | [ ] |
| F3-11 | Laporan harian, kelas, siswa, rekap + ekspor PDF/Excel | 11 | F3-2, S-03 | Uji lulus: laporan.test.ts (6 uji) + Playwright (tab Transaksi, ekspor Excel dibaca kembali). Tersedia: rekap per kelas, rekap per siswa, transaksi per rentang tanggal; ekspor Excel untuk rekap siswa dan transaksi. **Belum: ekspor PDF dan pratinjau cetak (S-03), ekspor Excel rekap per kelas** | [ ] |
| F3-12 | Backup manual/otomatis + restore | 13 | F2-4, S-05 | Uji lulus (backup.test.ts, 8 uji): backup, retensi 7 otomatis (manual tidak dihapus), restore + cadangan pengaman + penolakan berkas rusak/tanpa pemicu/saldo tak cocok. Terbukti di aplikasi terpaket (folder data terisolasi). **Belum: backup otomatis harian, cadangan sebelum migrasi, salin ke folder pilihan, uji alur UI** | [ ] |
| F3-13 | Periksa saldo (integritas) | 17 | F3-2 | Uji nol selisih (integritas.ts & ledger.test.ts) | [x] |
| F3-14 | Installer Windows `0.1.0`, diuji di komputer bersih | semua M | F3-1..13 | Pundi-Setup-0.1.0.exe 90,5 MB (NFR-10 < 200 MB) diperbarui dengan antarmuka mockup; **belum diuji di komputer bersih** | [ ] |
| F3-15 | Audit dan pengerasan backend (setoran siswa non-aktif, tanggal, nominal, IPC, cetak, pengaturan) | 05, 06, 07; NFR-01, 02, 03, 07 | F3-2, F3-5, F3-7 | `npm run typecheck` dan `npm run lint` bersih; `npm test` 97 uji lulus (14 berkas, termasuk `schemas.test.ts` dan `pengaturan.test.ts` baru); `npm run test:e2e` 28 uji lulus. Isi: setoran siswa `lulus`/`keluar` ditolak (`SISWA_TIDAK_AKTIF`), penarikan tetap boleh dan siswa itu dapat dicari di Catat Transaksi; tanggal harus ada di kalender dan setoran/penarikan tidak boleh bertanggal masa depan; nominal dan saldo bilangan bulat aman; semua penangan IPC bersekema, galat tak terduga tidak membocorkan pesan mentah dan hanya kodenya yang dilog; jendela cetak memblokir semua permintaan selain `data:` (diuji dengan kontrol); `folder_backup`/`pin_hash`/`logo_rel_path` tidak lagi diterima atau dikirim ke renderer; token berkas kedaluwarsa 1 jam. **Belum: tampilan baru Catat Transaksi (label status, tombol Setoran nonaktif) belum dilihat visual dan belum ada uji alur UI-nya; PDF dan cetak printer nyata belum dijalankan** | [x] |

## F4 — Rilis 0.2

| ID | Tugas | CAP | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F4-1 | Biaya administrasi (sesuai D-06) | 08 | Uji | [ ] |
| F4-2 | Kenaikan kelas dan kelulusan | 12 | Uji lulus: kenaikan.test.ts (7 uji: pindah/lulus/keluar, saldo dan CAP-17 tak berubah, riwayat kelas lama tetap, semua-atau-tidak-sama-sekali) + Playwright kenaikan.spec.ts. Dimajukan ke rilis 0.1 atas permintaan pemilik; PRD §7 diperbarui. Pembatalan sebelum disimpan lewat langkah Tinjau | [x] |
| F4-3 | Migrasi dari aplikasi lama lewat Excel, dengan layar pencocokan | 14 | Uji lulus dengan data sintetis (impor.test.ts, impor.spec.ts): pemetaan kolom otomatis dan manual, saldo awal sebagai transaksi saldo_awal lewat ledger, pencocokan jumlah siswa dan total saldo sebelum simpan, semua-atau-tidak-sama-sekali. Dimajukan ke 0.1 atas permintaan pemilik. **Belum diuji dengan berkas ekspor aplikasi lama sungguhan (S-04)** | [x] |
| F4-4 | Tema (lima) dan PIN aplikasi | 15, 16 | Uji | [ ] |

## F5 — macOS Apple Silicon

| ID | Tugas | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F5-1 | Akun Apple Developer, sertifikat Developer ID | — | Sertifikat terpasang di CI (bukan di repo) | [ ] |
| F5-2 | Build arm64 di CI/Mac, tanda tangan, notarisasi | S-01b, F5-1 | Build ternotarisasi | [ ] |
| F5-3 | Uji pasang dan jalankan di Mac Apple Silicon bersih tanpa Terminal | F5-2 | Catatan uji | [ ] |

## F6 — Ditunda (menunggu keputusan)

Pinjaman anggota (D-02), setoran bank (D-03), cetak buku tabungan fisik (D-04), bunga (D-05), peran/multi-operator (D-08), lisensi (D-09).

## Catatan risiko yang sedang dipantau

- Hak atas referensi aplikasi lama belum dipastikan (F0-4).
- Belum ada printer termal untuk uji (S-02).
- Belum ada Mac atau runner macOS untuk S-01b.
