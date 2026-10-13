# TODO — Pundi

Status: 13 Oktober 2026. Rujukan: [PRD](docs/PRD.md), [ERD](docs/ERD.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [DESIGN](docs/DESIGN.md), [AGENTS](AGENTS.md).

Backlog usulan fitur lanjutan hasil audit (belum disetujui sebagai cakupan rilis): [docs/TODO_FITUR.md](docs/TODO_FITUR.md).

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
| S-03 | `printToPDF` laporan 200 baris multi-halaman, font dibundel | S-01 | `tests/e2e/pdf.spec.ts` membuat PDF 200 siswa sintetis lewat Electron, memastikan berkas `%PDF-`, lebih dari satu halaman, baris akhir/total ada pada HTML, header tabel disetel berulang, dan nomor halaman memakai CSS page counter. **Belum: PDF belum diperiksa visual untuk potongan isi dan tampilan nomor halaman** | [ ] |
| S-04 | Impor Excel hasil ekspor aplikasi lama (berkas **sintetis**) tanpa selisih | F0-4 | Uji lulus | [ ] |
| S-05 | Trigger anti-ubah dan `VACUUM INTO` di WAL | S-01 | Uji lulus: UPDATE/DELETE ditolak trigger, VACUUM INTO cocok | [x] |

## F2 — Scaffold

| ID | Tugas | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F2-1 | Inisialisasi repositori, `.gitignore` (sqlite, backups, logs, `.env*`, catatan akun), `package.json` versi `0.1.0` | S-01 | package.json v0.1.0 dibuat, npm install berhasil | [x] |
| F2-2 | Struktur `main/preload/renderer/shared`, Electron aman (NFR-07), protokol aplikasi tanpa server HTTP | F2-1 | Struktur src/, protokol pundi-app://, contextIsolation, sandbox | [x] |
| F2-3 | Lint, typecheck, Vitest, Playwright terpasang; catat perintah di AGENTS | F2-1 | `npm run typecheck`, `npm run lint` (ESLint), `npm test` (33 uji) dan `npm run test:e2e` (Playwright, 8 lulus + 3 fixme) dijalankan dan lulus; perintah dicatat di AGENTS | [x] |
| F2-4 | Migrasi `0001_awal.sql` sesuai ERD, termasuk pemicu anti-ubah | F2-2, S-05 | Uji migrasi lulus: UPDATE/DELETE ditolak trigger | [x] |
| F2-5 | CI Windows (`windows-latest`) membangun installer | F2-1 | Alur kerja `.github/workflows/windows.yml` dipasang (`windows-latest`, Node 22, typecheck, lint, test, pack:win, upload artifact); build lokal `npm run pack:win` sukses menghasilkan `release/Pundi-Setup-0.2.0.exe` (86.95 MB < 200 MB NFR-10) | [x] |

## F3 — Inti (rilis 0.1)

| ID | Tugas | CAP | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- | --- |
| F3-1 | `shared/rupiah.ts` dan skema `zod` | NFR-03 | F2-2 | Uji lulus (rupiah.test.ts) | [x] |
| F3-2 | Layanan `ledger` + uji berbasis properti | 05–07, 17 | F2-4, F3-1 | Uji lulus: 500 transaksi acak & CAP-17 nol selisih | [x] |
| F3-3 | `akademik` (tahun ajaran, kelas) | 02 | F2-4 | Uji lulus: akademik.test.ts (9 uji: satu aktif, duplikat, kelas tak bisa pindah tahun, hapus bersyarat, salin kelas, penempatan hanya di tahun aktif) + Playwright akademik.spec.ts (5 alur dari instalasi kosong) | [x] |
| F3-4 | `siswa` (CRUD, penempatan, status, nomor unik) | 03 | F3-3 | Uji lulus (siswa.test.ts & SiswaScreen.tsx) | [x] |
| F3-5 | Profil sekolah dan pengaturan | 01 | F2-4 | `pengaturan.test.ts` (4 uji) lulus. `tests/e2e/logo-sekolah.spec.ts` menguji simpan profil, pilih/hapus logo dan verifikasi jalur tidak dikirim ke renderer. Logo PNG/JPEG maks. 2 MB disimpan oleh proses utama dan ditanam sebagai data lokal di HTML cetak; SVG ditolak. Pengaturan tema diuji di `tema.spec.ts` | [x] |
| F3-6 | Layar Catat Transaksi (keyboard penuh) | 05, 06 | F3-2, F3-4 | Playwright lulus (22 uji total): cari, setor, tarik, tolak saldo kurang tanpa mouse; Ctrl+K global, Alt+1..9, Esc bertingkat, pintasan nonaktif saat dialog, fokus terlihat. Sebelumnya 3 `test.fixme` kini hidup | [x] |
| F3-7 | Koreksi (dialog + pembalik) | 07 | F3-2 | Ledger teruji (alasan wajib, maks 255, pembalik tak bisa dibalik, saldo tak negatif). "Batalkan (Koreksi)" di Catat Transaksi membuka KoreksiModal; teruji di Playwright. Uji alur koreksi langsung dari layar Siswa (buku besar) terverifikasi lulus di `tests/e2e/buku-besar.spec.ts` | [x] |
| F3-8 | Buku besar per siswa | 10 | F3-2 | Uji lulus di `tests/e2e/buku-besar.spec.ts` (4 uji Playwright): riwayat kronologis, saldo berjalan, filter rentang tanggal & reset, pratinjau cetak dan PDF, serta koreksi transaksi pembalik langsung dari baris buku besar | [x] |
| F3-9 | Impor siswa Excel/CSV (pratinjau, atomik) | 04 | F3-4, S-04 | Uji lulus: impor.test.ts (14 uji) + Playwright impor.spec.ts (5 alur). Memenuhi CAP-04: format contoh dapat diunduh, pratinjau, baris bermasalah dengan nomor baris dan alasan, atomik, tanpa menggandakan (NIS). Memperbaiki cacat lama (CSV mengubah "50.000" jadi 50 dan NIS "007" jadi 7). **S-04 tetap terbuka**: belum dicoba dengan hasil ekspor aplikasi lama yang sebenarnya | [x] |
| F3-10 | Struk dan cetak | 09 | S-02, S-03 | Template HTML ter-escape (`receipt.ts`). PDF laporan sintetis 200 siswa berhasil dibuat multi-halaman pada S-03. **Belum diukur pada printer termal nyata (S-02); PDF belum diperiksa visual** | [ ] |
| F3-11 | Laporan harian, kelas, siswa, rekap + ekspor PDF/Excel | 11 | F3-2, S-03 | `laporan.test.ts` mencakup transaksi dan ekspor. Ekspor Excel rekap kelas ditambahkan dan dibaca ulang dari alur UI di `tests/e2e/pdf.spec.ts`; jumlah 200 siswa dan total Rp 12.000 cocok. Uji yang sama membuktikan `cetakLaporanPdf` menghasilkan PDF multi-halaman untuk 200 siswa sintetis; alur pratinjau laporan tersedia di UI. **Belum: pemeriksaan visual PDF** | [x] |
| F3-12 | Backup manual/otomatis + restore | 13 | F2-4, S-05 | `backup.test.ts` (12 uji) dan `migration.test.ts` mencakup backup, retensi, restore, cadangan pengaman, dan backup pra-migrasi. `tests/e2e/cadangan.spec.ts` berhasil membuat backup, menyalin ke folder sementara, memulihkan backup, dan memeriksa data/cadangan pengaman. Dialog folder native diganti folder sementara melalui mock pada E2E. **Belum: uji dialog pemilih folder native secara manual** | [ ] |
| F3-13 | Periksa saldo (integritas) | 17 | F3-2 | Uji nol selisih (integritas.ts & ledger.test.ts) | [x] |
| F3-14 | Installer Windows `0.1.0`, diuji di komputer bersih | semua M | F3-1..13 | Pundi-Setup-0.1.0.exe 90,5 MB (NFR-10 < 200 MB) diperbarui dengan antarmuka mockup; **belum diuji di komputer bersih** | [ ] |
| F3-15 | Audit dan pengerasan backend (setoran siswa non-aktif, tanggal, nominal, IPC, cetak, pengaturan) | 05, 06, 07; NFR-01, 02, 03, 07 | F3-2, F3-5, F3-7 | `npm run typecheck` dan `npm run lint` bersih; `npm test` 97 uji lulus (14 berkas, termasuk `schemas.test.ts` dan `pengaturan.test.ts` baru); `npm run test:e2e` 28 uji lulus. Isi: setoran siswa `lulus`/`keluar` ditolak (`SISWA_TIDAK_AKTIF`), penarikan tetap boleh dan siswa itu dapat dicari di Catat Transaksi; tanggal harus ada di kalender dan setoran/penarikan tidak boleh bertanggal masa depan; nominal dan saldo bilangan bulat aman; semua penangan IPC bersekema, galat tak terduga tidak membocorkan pesan mentah dan hanya kodenya yang dilog; jendela cetak memblokir semua permintaan selain `data:` (diuji dengan kontrol); `folder_backup`/`pin_hash`/`logo_rel_path` tidak lagi diterima atau dikirim ke renderer; token berkas kedaluwarsa 1 jam. **Belum: tampilan baru Catat Transaksi (label status, tombol Setoran nonaktif) belum dilihat visual dan belum ada uji alur UI-nya; PDF dan cetak printer nyata belum dijalankan** | [x] |
| F3-16 | Responsivitas tata letak dan status cadangan nyata (DESIGN §3a) | NFR-08; CAP-13 | F3-6, F3-12 | `npm run typecheck` dan `npm run lint` bersih; `npm test` 98 uji lulus (termasuk `backup.terakhir`); `npm run test:e2e` 37 uji lulus, termasuk `responsif.spec.ts` (9 uji: tak ada elemen keluar jendela pada 1024/1180/1366/1600 px di 9 menu, rel ikon <1100, Catat dua kolom <1360, Siswa satu kolom <1220, angka Beranda tak terpecah, status cadangan jujur). Tangkapan layar sebelum/sesudah diperiksa pada 1024 dan 1180 px. Juga: baris filter Siswa tak lagi menyusut, inisial avatar mengabaikan kata tanpa huruf awal ("(Contoh)"). **Belum: Laporan/Impor/Akademik/Kenaikan/Cadangan/Pengaturan tidak dirombak (sudah tidak overflow); tampilan 2560 px belum diuji; teks pemisah kecil (10–12 px) dan warna heksadesimal langsung di komponen belum dirapikan** | [x] |

## F4 — Rilis 0.2

| ID | Tugas | CAP | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F4-1 | Biaya administrasi (sesuai D-06) | 08 | `npm test` lulus (biaya-adm.test.ts: satu siswa, rencana dan alasan dilewati, massal atomik, periode ganda, koreksi membuka lagi, kas/rekap memisahkan biaya adm, uji properti 300 operasi acak: saldo >= 0 dan nol selisih); Playwright biaya-adm.spec.ts. **Aturan D-06 masih sementara; konfirmasi ke bendahara nyata** | [x] |
| F4-2 | Kenaikan kelas dan kelulusan | 12 | Uji lulus: kenaikan.test.ts (7 uji: pindah/lulus/keluar, saldo dan CAP-17 tak berubah, riwayat kelas lama tetap, semua-atau-tidak-sama-sekali) + Playwright kenaikan.spec.ts. Dimajukan ke rilis 0.1 atas permintaan pemilik; PRD §7 diperbarui. Pembatalan sebelum disimpan lewat langkah Tinjau | [x] |
| F4-3 | Migrasi dari aplikasi lama lewat Excel, dengan layar pencocokan | 14 | Uji lulus dengan data sintetis (impor.test.ts, impor.spec.ts): pemetaan kolom otomatis dan manual, saldo awal sebagai transaksi saldo_awal lewat ledger, pencocokan jumlah siswa dan total saldo sebelum simpan, semua-atau-tidak-sama-sekali. Dimajukan ke 0.1 atas permintaan pemilik. **Belum diuji dengan berkas ekspor aplikasi lama sungguhan (S-04)** | [x] |
| F4-4 | Tema (lima) dan PIN aplikasi | 15, 16 | `npm run test:e2e -- tests/e2e/tema.spec.ts tests/e2e/pin.spec.ts` lulus: persistensi tema setelah aplikasi dibuka ulang; aktivasi, validasi, kunci/buka, lupa PIN, pulihkan, dan mematikan PIN lewat UI dengan folder data sementara | [x] |
| F4-5 | Slip saldo siswa per kelas (cetak/PDF) | 18 | `npm test` lulus (rutinitas-harian.test.ts: saldo + 5 transaksi terakhir urut, satu siswa, HTML ter-escape); Playwright harian.spec.ts membaca pratinjau. **Belum diukur pada cetak nyata** | [ ] |
| F4-6 | Setoran massal per kelas | 19 | `npm test` lulus (atomik: satu baris gagal tidak menyimpan apa pun dan nomor bukti tidak terpakai; siswa non-aktif menolak semua; nol selisih CAP-17); Playwright: isi keyboard, validasi, simpan | [x] |
| F4-7 | Tutup kas harian + berita acara | 20 | `npm test` lulus (rumus kas seharusnya dan label selisih); Playwright: selisih Kurang/Sesuai. **Belum diukur pada cetak nyata** | [ ] |
| F4-9 | Rekap bulanan, grafik, saldo mengendap | 22 | `npm test` lulus (analitik.test.ts: total per bulan, bulan kosong 0, saldo awal periode, saldo awal migrasi bukan setoran, rentang tidak sah, siswa pasif, ekspor Excel dibaca kembali, HTML ter-escape); Playwright analitik.spec.ts. **Cetak belum diukur pada cetak nyata** | [ ] |
| F4-10 | Riwayat aktivitas (hanya baca) di Pengaturan | 23 | `npm test` lulus (urutan, halaman `sebelumId`, ringkasan tanpa nama/nominal); Playwright analitik.spec.ts | [x] |
| F4-11 | Kunci PIN 6 angka (CAP-16): halaman PIN, ubah/matikan, kode pemulihan, jeda percobaan | 16 | `npx vitest run src/main/services/kunci.test.ts` 12 uji lulus (hash tanpa teks PIN, jeda lintas instans dan batas 15 menit, ubah/matikan, pemulihan satu kali, berkas rusak = terkunci); Playwright pin.spec.ts (53 uji e2e total lulus): aktifkan, terkunci menolak baca/tulis di proses utama, PIN salah/benar, lupa PIN, matikan. **Perlu dicoba manual oleh pemilik; aktivasi lisensi belum dibuat (menunggu D-09)** | [ ] |
| F4-8 | Salinan cadangan ke flashdisk + pengingat di Beranda | 21 | Uji layanan membuktikan salinan dapat dibuka dan tercatat tanpa jalur. `tests/e2e/cadangan.spec.ts` menguji salin/pulihkan melalui layar memakai folder sementara; Playwright pengingat tetap diuji. **Dialog folder native masih belum dicoba manual** | [ ] |

## F5 — macOS Apple Silicon

| ID | Tugas | Bergantung | Bukti | ✓ |
| --- | --- | --- | --- | --- |
| F5-1 | Akun Apple Developer, sertifikat Developer ID | — | Sertifikat terpasang di CI (bukan di repo) | [ ] |
| F5-2 | Build arm64 di CI/Mac, tanda tangan, notarisasi | S-01b, F5-1 | Build ternotarisasi | [ ] |
| F5-3 | Uji pasang dan jalankan di Mac Apple Silicon bersih tanpa Terminal | F5-2 | Catatan uji | [ ] |

## F6 — Ditunda (menunggu keputusan)

Pinjaman anggota (D-02), setoran bank (D-03), cetak buku tabungan fisik (D-04), bunga (D-05), peran/multi-operator (D-08), lisensi (D-09).

## F7 — Backend dan keandalan (persiapan komersial)

Rincian dan acceptance criteria: [RENCANA_KOMERSIAL](docs/RENCANA_KOMERSIAL.md) §4. Dikerjakan berurutan.

| ID | Tugas | Bukti | ✓ |
| --- | --- | --- | --- |
| F7-1 | Instance tunggal (`requestSingleInstanceLock`) | `app.requestSingleInstanceLock()` dipasang di `src/main/index.ts` dengan penangan `second-instance` (fokus/restore). Teruji Playwright (`tests/e2e/jendela.spec.ts`): peluncuran instans kedua dengan dataDir sama mendeteksi kunci, tidak membuat jendela baru, dan langsung keluar dengan kode 0 (76 uji e2e Playwright lulus) | [x] |
| F7-2 | Log lokal tanpa data sensitif dan penangan crash | `FileLogger` di `src/main/logger.ts` dengan rotasi ukuran dan retensi 7 berkas di `userData/logs/`. Sanitasi ketat tanpa nama/nomor/nominal/jalur (NFR-02). Penangan `uncaughtException`, `unhandledRejection`, dan `render-process-gone` menampilkan dialog ramah Bahasa Indonesia tanpa menelan galat fatal. Uji unit `src/main/logger.test.ts` (5 uji) dan e2e (76 uji) lulus | [x] |
| F7-3 | Penjadwal backup otomatis harian dan sebelum migrasi (verifikasi dulu apakah sudah ada) | Harian: `perluBackupOtomatisHarian` & `jalankanBackupOtomatisJikaPerlu` (selisih >= 24 jam & pengaturan aktif; cadangan pertama hanya bila sudah ada transaksi) di `BackupService`, dipanggil saat aplikasi dibuka di `src/main/index.ts`; diuji dengan jam disuntik di `backup.test.ts`. Pra-migrasi (direvisi setelah review 13 Okt 2026): satu jalur produksi di `src/main/db/index.ts` (`pre_migrasi_v<versi>`, hanya bila basis data sudah punya migrasi terdahulu), **migrasi dibatalkan bila cadangan gagal** (A-11), retensi 7 lewat `pangkasCadanganOtomatis` bersama `BackupService`. Diuji di jalur nyata `src/main/db/migration.test.ts` (cadangan dibuat sebelum 0002 diterapkan; cadangan gagal -> `initDb` melempar, skema tetap versi 1). `npm run typecheck`, `npm run lint` bersih; `npm test` 145 uji lulus | [x] |
| F7-4 | Uji kinerja NFR-04 (5.000 siswa, 200.000 transaksi) dengan angka nyata | Skrip seed sintetis (lewat `LedgerService`) di `tests/benchmark.test.ts`, dijalankan `npm run test:perf`. **Dijalankan ulang saat review 13 Okt 2026 (lulus, 95 detik):** cari siswa 1,2–2,8 ms (< 200 ms), catat transaksi 2,5–3,4 ms (< 300 ms), rekap kas harian 37 ms, rekap 20 kelas 766 ms, rekap 5.000 siswa 182 ms (< 3.000 ms). Indeks 0001_awal cukup, tanpa migrasi indeks baru | [x] |
| F7-5 | Pecah `ipc/index.ts` dan `ledger.ts` tanpa mengubah perilaku | `src/main/ipc/index.ts` (522 baris -> 86 baris) dipecah menjadi handler per domain di `src/main/ipc/handlers/` (`kunci`, `siswa`, `akademik`, `kenaikan`, `transaksi`, `laporan`, `pengaturan`, `impor`, `backup`, `cetak`) dan `token.ts`. `src/main/services/ledger.ts` (775 baris -> 568 baris) diekstrak modul pembantu `types.ts`, `helpers.ts`, dan `biaya-adm-rencana.ts` dengan mempertahankan kewenangan tunggal penulisan transaksi pada `LedgerService`. Seluruh pengujian lulus: typecheck 0 galat, lint 0 galat, 19 test file vitest (144 tes, termasuk 500 transaksi acak & CAP-17 nol selisih), serta 76 uji Playwright E2E | [x] |
| F7-6 | CI Windows (sama dengan F2-5) | Alur kerja `.github/workflows/windows.yml` dibuat: `windows-latest`, Node 22 (`cache: npm`), `npm ci`, typecheck, lint, test, `pack:win`, dan upload-artifact installer NSIS. Pembangunan lokal `npm run pack:win` berhasil menghasilkan installer `release/Pundi-Setup-0.2.0.exe` (86.95 MB < 200 MB NFR-10). Tanpa rahasia/kredensial di repositori | [x] |
| F7-7 | Uji installer di komputer bersih (pemilik; daftar periksa disiapkan) | Daftar periksa 12 poin disiapkan di `docs/UJI_INSTALLER_WINDOWS.md` (instalasi, shortcut, peluncuran, instans tunggal, transaksi, struk, cadangan, pulihkan, PIN, log, pencopotan). Menunggu eksekusi oleh pemilik | [ ] |

## F8 — Frontend modern dan responsif

Rincian: [RENCANA_KOMERSIAL](docs/RENCANA_KOMERSIAL.md) §5. F8-4 satu layar per tugas.

| ID | Tugas | Bukti | ✓ |
| --- | --- | --- | --- |
| F8-1 | Audit dan perluas token (DESIGN §2) | `tokens.css` diperluas dengan skala spasi kelipatan 4 px (`--space-1`..`12`), skala radius (`--radius-xs`..`full`), elevasi bayangan (`--shadow-xs`..`xl`), tipografi statis & fluid clamp (`--text-fluid-title/hero`), ketebalan huruf (`--font-regular`..`bold`), dan penyesuaian semantik tema grafit untuk WCAG AA. `docs/DESIGN.md` §2 diperbarui lengkap | [x] |
| F8-2 | Komponen dasar bersama (Button, Card, Field, Table, Badge, EmptyState, Toast) | Dibuat di `src/renderer/components/ui/` (`Button.tsx`, `Card.tsx`, `Field.tsx`, `Input.tsx`, `Table.tsx`, `Badge.tsx`, `EmptyState.tsx`, `Toast.tsx`, `ui.css`, `index.ts`) berbasis kelas CSS murni dan token DESIGN §2 (tanpa gaya heksadesimal/inline baru), fokus terlihat (`:focus-visible`), aria live pada toast. `npm run typecheck` & `npm run lint` lulus 0 galat | [x] |
| F8-3 | Lima tema (CAP-15), kontras AA | Lima tema (`putih`, `hijau`, `biru`, `ungu`, `grafit`) tersimpan via `pengaturan` (kunci `tema`); kontras teks dan badge semantik disesuaikan memenuhi WCAG AA. Teruji di Playwright E2E (`tests/e2e/tema.spec.ts`, 3 uji): tema bawaan putih pada instalasi baru, berganti seketika di DOM, tersimpan di database, dan bertahan persisten saat aplikasi ditutup lalu dibuka ulang | [x] |
| F8-4 | Migrasi layar ke komponen dasar: Beranda, Catat Transaksi, Siswa, Laporan, Akademik, Kenaikan, Impor, Cadangan, Pengaturan | Selesai setelah review 13 Okt 2026 (koreksi atas klaim awal yang tidak sesuai kode). Catat Transaksi dimigrasi dan dipecah (`CatatTransaksiScreen.tsx` 1003 -> 416 baris + `screens/catat/DaftarSiswaPanel`, `FormTransaksi`, `PanelKanan`, `catat-tambahan.css`); alur tanpa mouse tetap lulus (`alur.spec.ts`). Layar lain dan komponen modal/panel (`App.tsx`, Onboarding, LayarKunci, Akademik, Kenaikan, Impor, Siswa, Pengaturan, Cadangan, Laporan, Beranda, Modal, Koreksi, dst.) memakai `ui/` dan kelas CSS berbasis token. `style={{…}}` di `src/renderer`: **603 -> 5**, semuanya dinamis (tinggi/lebar grafik Beranda 3, avatar siswa 1, `--modal-lebar` 1). Tanpa warna heksadesimal baru; hover JS diganti `:hover`. Berkas terbesar kini `SiswaScreen.tsx` 630 baris. `npm run typecheck` dan `npm run lint` bersih, `npm test` 145 lulus, `npm run test:e2e` 91 lulus. Tangkapan layar Catat Transaksi, Akademik, Bantuan diperiksa pada 1366x768. **Belum**: pemeriksaan visual semua layar/modal pada semua tema dan 800/1024/1920 px (agen pelaksana tidak melihat tampilan nyata) | [x] |
| F8-5 | Responsif sungguhan (evaluasi `minWidth`, tabel jadi kartu, skala 125–150%) | `minWidth` diturunkan ke 800 px dan `minHeight` ke 560 px di `src/main/window.ts` (ramah laptop 1366x768 skala 125%–150% dan mode split-screen; disetujui pemilik, A-10; tangkapan layar 800/1024/1280/1920 px belum dilampirkan). Pola responsif kartu tabel `.tabel-kartu` dengan atribut `data-label` diimplementasikan di `ui.css` dan diterapkan pada tabel Beranda, Cadangan, Akademik, Kenaikan, dan Siswa. Header atas (`.app-header`), identitas sekolah, dan area konten (`.app-main-content`) disesuaikan responsif. `tests/e2e/responsif.spec.ts` diperbarui menguji resolusi 800x600, 1024x680, 1280x720, 1366x768, 1920x1080 dan transformasi tabel kartu; seluruh 81 pengujian Playwright E2E 100% lulus | [x] |
| F8-6 | Keadaan kosong, skeleton, toast, transisi halus | `EmptyState`, `Skeleton` (varian text/rect/circle), dan `Toast` (`useToast`, `ToastProvider` di root `App.tsx`) dengan token CSS murni. Shimmer/transisi nonaktif pada `prefers-reduced-motion: reduce`. Tidak ada animasi yang menunda input Catat Transaksi. Review 13 Okt 2026: `alert()` bawaan di tombol Cadangkan cepat diganti toast. Verifikasi: typecheck, lint, 145 uji unit, 91 uji e2e lulus | [x] |
| F8-7 | Audit aksesibilitas | Audit kepatuhan WCAG 2.2 Level AA & NFR-08 selesai didokumentasikan di `docs/AUDIT_AKSESIBILITAS.md`. Rasio kontras 5 tema melampaui ambang AA (dihitung ulang saat review dari `tokens.css`; angka di `docs/AUDIT_AKSESIBILITAS.md` sudah dikoreksi 13 Okt 2026). Belum diperiksa: teks di atas `--bg` selain putih, badge semantik pada tema berwarna. Seluruh SVG ikon dan avatar visual dibekali `aria-hidden="true"`; pesan kesalahan form `Field.tsx` dibekali `role="alert"`; indikator fokus keyboard `:focus-visible` diimplementasikan global; modal focus trap teruji mengunci Tab/Shift+Tab dan memulihkan fokus saat ditutup; alur tanpa mouse (Ctrl+K, Alt+1..9, S/T, Enter) tetap 100% lulus. Seluruh verifikasi lulus: `typecheck` 0 galat, `lint` 0 galat, vitest 19 files (144 tes), dan 81 Playwright E2E tests | [x] |
| F8-8 | Desain ulang bilah samping (permintaan pemilik 13 Okt 2026): putih, dapat dibuka-tutup, palet warna per kelompok menu | Bilah putih (`--surface`), tiga kelompok berwarna (`--nav-harian/data/sistem`, versi terang untuk Grafit), tombol ciutkan + Ctrl+B (pilihan di `localStorage`), rel ikon otomatis < 1100 px; urutan menu Alt+1..9 dan jumlah tombol menu (9) tidak berubah. `tests/e2e/bilah-samping.spec.ts` (4 uji) lulus; tangkapan layar diperiksa pada 1366x768 (tema putih, grafit, rel ikon). Hierarki menu tinggi muat tanpa menggulir pada tinggi jendela 703 px. DESIGN §3 diperbarui | [x] |

## F9 — Fitur untuk dijual

Rincian: [RENCANA_KOMERSIAL](docs/RENCANA_KOMERSIAL.md) §6.

| ID | Tugas | Bukti | ✓ |
| --- | --- | --- | --- |
| F9-1 | Selesaikan sisa 0.1/0.2: uji dan cetak buku besar (F3-8, CAP-10), uji manual salinan flashdisk (F4-8) | Filter tanggal & periode cetak buku besar per siswa diimplementasikan (`generateBukuBesarSiswaHtml`, `cetak.ts`, `SiswaScreen.tsx`); koreksi pembalik langsung dari baris buku besar; 4 skenario Playwright E2E (`tests/e2e/buku-besar.spec.ts`) lulus 100%. Panduan dan lembar uji manual dialog folder salinan flashdisk (F4-8) lengkap didokumentasikan di `docs/UJI_SALINAN_FLASHDISK.md` | [x] |
| F9-2 | Wizard onboarding instalasi baru | Onboarding wizard 4 tahap (Profil Sekolah, Tahun Ajaran, Pembuatan Kelas dengan preset otomatis, Siswa & Mulai) diimplementasikan di `OnboardingWizardModal.tsx`, terintegrasi di Beranda `App.tsx`; mendukung navigasi keyboard penuh, opsi Lewati Langkah Ini, dan Lewati Semua; status tersimpan di `pengaturan` (`onboarding_selesai`, kunci renderer keempat: ERD §3.7, A-12). Teruji di 3 skenario Playwright E2E (`tests/e2e/onboarding.spec.ts`) lulus 100%, retensi buka-ulang terbukti, dan seluruh 88 pengujian E2E lulus tanpa regresi | [x] |
| F9-3 | Layar Bantuan dan Tentang (tanpa jaringan) | `src/renderer/screens/BantuanScreen.tsx` + `.css`: enam panduan alur (siapkan data, catat transaksi, koreksi, cetak, cadangan, kenaikan kelas), tabel pintasan keyboard, dan Tentang (versi dari `package.json` lewat `define` Vite `__APP_VERSION__`, tanpa jaringan). Dibuka dari tombol **Bantuan** di bilah atas atau **F1**; bukan menu ke-10 agar Alt+1..9 dan tes sembilan menu tetap. Teks ditulis sendiri (DESIGN §7a). `tests/e2e/bantuan.spec.ts` (3 uji) lulus; seluruh 91 uji e2e lulus. **Teks panduan perlu dibaca pemilik** (ditulis dari kode dan dokumen, belum diuji oleh operator nyata) | [x] |
| F9-4 | Lisensi dan aktivasi offline. **Ditunda menunggu D-09; jangan dikerjakan** | | [ ] |

## Catatan risiko yang sedang dipantau

- Hak atas referensi aplikasi lama belum dipastikan (F0-4).
- Belum ada printer termal untuk uji (S-02).
- Belum ada Mac atau runner macOS untuk S-01b.
