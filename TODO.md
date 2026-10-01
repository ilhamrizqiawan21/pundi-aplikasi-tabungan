# TODO — Pundi

Status: 30 September 2026. Rujukan: [PRD](docs/PRD.md), [ERD](docs/ERD.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [DESIGN](docs/DESIGN.md), [AGENTS](AGENTS.md).

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
| F3-3 | `akademik` (tahun ajaran, kelas) | 02 | F2-4 | Uji lulus lewat siswa.test.ts. **Tidak ada layar untuk membuat tahun ajaran/kelas** (`tahunAjaranSimpan`/`kelasSimpan` tak dipakai UI, tanpa data awal): Rekap per Kelas selalu kosong | [ ] |
| F3-4 | `siswa` (CRUD, penempatan, status, nomor unik) | 03 | F3-3 | Uji lulus (siswa.test.ts & SiswaScreen.tsx) | [x] |
| F3-5 | Profil sekolah dan pengaturan | 01 | F2-4 | `pengaturan.ts` dan PengaturanScreen ada, **belum ada uji** | [ ] |
| F3-6 | Layar Catat Transaksi (keyboard penuh) | 05, 06 | F3-2, F3-4 | Uji alur Playwright lulus: cari, setor, tarik, tolak saldo kurang, semua dengan keyboard. **Pintasan global Ctrl+K, Alt+1, dan Esc yang tertulis di layar belum ada** (3 `test.fixme`) | [ ] |
| F3-7 | Koreksi (dialog + pembalik) | 07 | F3-2 | Ledger teruji; alur "Batalkan (Koreksi)" teruji di Playwright. **Tombol itu memakai alasan tetap, padahal CAP-07 mewajibkan alasan dari pengguna**; dialog KoreksiModal belum diuji alur | [ ] |
| F3-8 | Buku besar per siswa | 10 | F3-2 | Layanan ledger teruji; layar buku besar belum ada uji alur | [ ] |
| F3-9 | Impor siswa Excel/CSV (pratinjau, atomik) | 04 | F3-4, S-04 | impor.test.ts lulus dengan berkas sintetis buatan sendiri; **S-04 belum selesai** | [ ] |
| F3-10 | Struk dan cetak | 09 | S-02, S-03 | Template HTML ter-escape (receipt.ts). **Belum diukur pada cetak nyata (S-02/S-03)** | [ ] |
| F3-11 | Laporan harian, kelas, siswa, rekap + ekspor PDF/Excel | 11 | F3-2, S-03 | Rekap + ekspor Excel ada (laporan.ts). **Ekspor PDF belum ada** (tidak ada printToPDF), S-03 belum | [ ] |
| F3-12 | Backup manual/otomatis + restore | 13 | F2-4, S-05 | Uji lulus (backup.test.ts, 8 uji): backup, retensi 7 otomatis (manual tidak dihapus), restore + cadangan pengaman + penolakan berkas rusak/tanpa pemicu/saldo tak cocok. Terbukti di aplikasi terpaket (folder data terisolasi). **Belum: backup otomatis harian, cadangan sebelum migrasi, salin ke folder pilihan, uji alur UI** | [ ] |
| F3-13 | Periksa saldo (integritas) | 17 | F3-2 | Uji nol selisih (integritas.ts & ledger.test.ts) | [x] |
| F3-14 | Installer Windows `0.1.0`, diuji di komputer bersih | semua M | F3-1..13 | Pundi-Setup-0.1.0.exe 90,4 MB (NFR-10 < 200 MB) dibuat; **belum diuji di komputer bersih** | [ ] |

## F4 — Rilis 0.2

| ID | Tugas | CAP | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F4-1 | Biaya administrasi (sesuai D-06) | 08 | Uji | [ ] |
| F4-2 | Kenaikan kelas dan kelulusan | 12 | Uji alur | [ ] |
| F4-3 | Migrasi dari aplikasi lama lewat Excel, dengan layar pencocokan | 14 | Uji dengan data sintetis | [ ] |
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
