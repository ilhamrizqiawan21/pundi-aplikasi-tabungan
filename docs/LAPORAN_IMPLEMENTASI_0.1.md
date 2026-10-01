# Laporan Implementasi & Tinjauan Arsitektur — Pundi v0.1.0

Dokumen ini disusun untuk memberikan rekapitulasi teknis yang mendalam mengenai implementasi rilis awal (**0.1.0**) dari aplikasi **Pundi** (Aplikasi Desktop Pencatatan Tabungan Siswa Offline), sebagai bahan tinjauan arsitektur, keamanan, dan fungsional.

---

## 1. Ringkasan Eksekutif

- **Tujuan Produk**: Menyediakan sistem pencatatan tabungan siswa offline yang cepat, aman, dan memiliki integritas saldo 100% tanpa risiko manipulasi riwayat transaksi.
- **Stack Teknologi**:
  - **Cangkang**: Electron v34 (Arsitektur Multi-Process terisolasi, Sandbox, Node 22 LTS).
  - **Basis Data**: SQLite 3 via `better-sqlite3` (Sinkron, ACID, WAL mode, Single-file di direktori data pengguna).
  - **Antarmuka**: React 18 + Vite 6 + TypeScript `strict` (Desain sistem token, tanpa framework CSS eksternal).
  - **Validasi & Utilitas**: `zod` di batas IPC, `exceljs` untuk berkas `.xlsx`, sanitasi string HTML.
  - **Pengujian**: Vitest (Unit & Property-based testing).
  - **Distribusi**: `electron-builder` NSIS Installer Windows x64 (`Pundi-Setup-0.1.0.exe`, 90.4 MB).

---

## 2. Kepatuhan Aturan & Standar Arsitektur

### 2.1 Clean-Room Principle (AGENTS.md)
- Seluruh kode, skema basis data, nama kolom, kontrak IPC, dan komponen UI ditulis ulang dari nol (clean-room).
- Tidak ada bagian kode biner, teks antarmuka, aset visual, atau struktur Access `.mdb` dari aplikasi referensi lama (Siata Garuda) yang disalin atau dibongkar.
- Interoperabilitas hanya dilakukan melalui format terbuka Excel (`.xlsx` / `.csv`) milik pengguna sendiri.

### 2.2 Keamanan Electron (NFR-01, NFR-07, ARCHITECTURE §3)
- **Isolasi Penuh Jendela**:
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - Jendela utama tidak memiliki akses langsung ke modul Node.js (`fs`, `child_process`, `better-sqlite3`).
- **Penolakan Permintaan Jaringan & Izin**:
  - `setPermissionRequestHandler` menolak seluruh permintaan izin.
  - `setWindowOpenHandler` memblokir pembuatan jendela baru (`action: 'deny'`).
  - Pencegahan navigasi luar origin: event `will-navigate` membatalkan URL di luar protokol internal.
- **Bebas Server HTTP Lokal (A-03)**:
  - Tidak menggunakan server HTTP internal (`http://127.0.0.1`) guna menghapus potensi celah keamanan CORS dan origin collision. Aplikasi dimuat melalui skema protokol terisolasi `pundi-app://` atau berkas lokal terbundel.
- **Validasi IPC Ketat**:
  - Setiap handler IPC memverifikasi frame pengirim (`event.senderFrame`).
  - Setiap masukan IPC divalidasi dengan skema `zod` (`src/shared/schemas.ts`).
  - Renderer **tidak pernah menerima atau mengirim jalur file mentah (*file path*)**. Pemilihan berkas menggunakan dialog yang dibuka proses utama dan diidentifikasi dengan token unik sementara.

### 2.3 Integritas Uang & Buku Besar Tambah-Saja (NFR-03, ERD §1 & §4)
- **Tipe Uang**: Seluruh nominal di basis data dan kalkulasi kode menggunakan bilangan bulat Rupiah (`INTEGER`). Dilarang menggunakan tipe `REAL`/`float` guna mencegah galat presisi pecahan desimal.
- **Buku Besar Tambah-Saja (Append-Only)**:
  - Tabel `transaksi` di basis data SQLite diproteksi dengan pemicu database:
    ```sql
    CREATE TRIGGER trg_transaksi_no_update BEFORE UPDATE ON transaksi
    BEGIN SELECT RAISE(ABORT, 'transaksi_tidak_boleh_diubah'); END;

    CREATE TRIGGER trg_transaksi_no_delete BEFORE DELETE ON transaksi
    BEGIN SELECT RAISE(ABORT, 'transaksi_tidak_boleh_dihapus'); END;
    ```
- **Single Source of Truth**:
  - Hanya layanan `LedgerService` (`src/main/services/ledger.ts`) yang memiliki hak menulis ke tabel `transaksi`.
  - Koreksi kesalahan input tidak pernah mengedit baris lama, melainkan menerbitkan transaksi **pembalik** bertanda kebalikan dengan alasan koreksi wajib (`membalik_id` unik).
  - Setiap operasi pencatatan transaksi, penomoran bukti otomatis (`TRX-YYYY-XXXXXX`), dan pembaruan saldo dijalankan dalam **satu transaksi SQL atomik**.

---

## 3. Rincian Modul & Layar yang Telah Diimplementasikan

```
src/
├── main/
│   ├── db/
│   │   ├── index.ts           # Koneksi SQLite WAL, migrasi & embedded fallback
│   │   └── migration.test.ts  # Uji migrasi & pemicu anti-ubah transaksi
│   ├── ipc/
│   │   └── index.ts           # Registry handler IPC aman + verifikasi token
│   ├── print/
│   │   └── receipt.ts         # Template struk termal HTML tersanitasi XSS-safe
│   ├── services/
│   │   ├── akademik.ts        # Layanan Tahun Ajaran & Kelas
│   │   ├── backup.ts          # Layanan VACUUM INTO & retensi 7 cadangan
│   │   ├── backup.test.ts     # Uji cadangan & retensi
│   │   ├── impor.ts           # Layanan baca & validasi atomik Excel/CSV
│   │   ├── impor.test.ts      # Uji pratinjau & impor atomik
│   │   ├── integritas.ts      # Layanan verifikasi saldo CAP-17
│   │   ├── laporan.ts         # Layanan rekap kas, kelas, siswa & ekspor Excel
│   │   ├── ledger.ts          # Layanan inti buku besar (setor, tarik, balik)
│   │   ├── ledger.test.ts     # Uji invarian & properti 500 transaksi acak
│   │   ├── pengaturan.ts      # Layanan profil sekolah & preferensi tema
│   │   ├── siswa.ts           # Layanan CRUD siswa, nomor rekening unik sekuensial
│   │   └── siswa.test.ts      # Uji integritas data siswa
│   ├── window.ts              # Konfigurasi BrowserWindow aman & CSP
│   └── index.ts               # Entry point Electron & protokol pundi-app
├── preload/
│   └── index.ts               # ContextBridge window.pundi
├── renderer/
│   ├── components/
│   │   ├── KoreksiModal.tsx   # Dialog koreksi transaksi pembalik
│   │   ├── Modal.tsx          # Kontainer modal aksesibel keyboard
│   │   └── SiswaFormModal.tsx # Form tambah/ubah siswa & penempatan kelas
│   ├── screens/
│   │   ├── BerandaScreen.tsx        # Dasbor kas harian & 10 transaksi terakhir
│   │   ├── CatatTransaksiScreen.tsx # Layar entri transaksi keyboard-first
│   │   ├── SiswaScreen.tsx          # Tabel siswa, filter & buku besar
│   │   ├── LaporanScreen.tsx        # Rekap tabungan kelas/siswa & ekspor
│   │   ├── ImporScreen.tsx          # Pratinjau & eksekusi impor Excel
│   │   ├── CadanganScreen.tsx       # Manajemen cadangan snapshot
│   │   └── PengaturanScreen.tsx     # Profil sekolah, tema & cek saldo CAP-17
│   ├── styles/
│   │   └── tokens.css         # 5 tema warna (Putih, Hijau, Biru, Ungu, Grafit)
│   ├── App.tsx                # Shell navigasi utama & bilah status
│   └── main.tsx               # Entry point React
├── shared/
│   ├── errors.ts              # Kode & pesan galat standar Bahasa Indonesia
│   ├── rupiah.ts              # Utilitas format & parsing bilangan bulat Rupiah
│   ├── rupiah.test.ts         # Uji unit utilitas rupiah
│   ├── schemas.ts             # Skema validasi masukan Zod
│   └── types.ts               # Definisi antarmuka & tipe domain
└── migrations/
    └── 0001_awal.sql          # DDL migrasi awal basis data
```

---

## 4. Bukti Hasil Pengujian (Test & Build Matrix)

### 4.1 Uji Unit & Integritas (`npm test` / `vitest run`)
Pengujian mencakup 6 berkas pengujian dengan total **22 test cases** (lulus 100%):
1. `src/shared/rupiah.test.ts` (6 uji):
   - Validasi format positif (`Rp 1.250.000`), negatif (`-Rp 50.000`), parsing string, dan pengecekan batasan nominal aman (`MAX_SAFE_INTEGER`).
2. `src/main/db/migration.test.ts` (2 uji):
   - Validasi pembentukan seluruh tabel DDL `0001_awal.sql`.
   - Pembuktian penolakan perintah `UPDATE` dan `DELETE` pada tabel `transaksi` oleh trigger SQLite.
3. `src/main/services/siswa.test.ts` (6 uji):
   - Penomoran rekening sekuensial otomatis (`T-000001`, `T-000002`).
   - Penempatan kelas siswa pada tahun ajaran aktif.
   - Pembaruan data diri tanpa mengubah nomor rekening.
   - Pencarian multi-kriteria (Nama, NIS, No. Rekening).
   - Penolakan penghapusan siswa yang sudah memiliki riwayat transaksi (CAP-03).
   - Pengizinan penghapusan siswa yang belum memiliki transaksi.
4. `src/main/services/impor.test.ts` (3 uji):
   - Pembacaan dan validasi berkas Excel valid.
   - Deteksi baris bermasalah (nama kosong, NIS duplikat lokal, NIS sudah ada di basis data).
   - Sifat impor atomik (semua baris tersimpan jika valid, atau ditolak utuh jika ada galat).
5. `src/main/services/backup.test.ts` (2 uji):
   - Pembuatan cadangan menggunakan `VACUUM INTO` dan pencatatan audit log.
   - Penegakan aturan retensi cadangan (menyimpan maksimal 7 snapshot otomatis terakhir).
6. `src/main/services/ledger.test.ts` (3 uji):
   - Setoran dan penarikan dengan pembaruan saldo berjalan yang presisi.
   - Penolakan penarikan yang melebihi saldo (`SALDO_TIDAK_CUKUP`).
   - Koreksi transaksi dengan pembalik dan penolakan koreksi berulang.
   - **Uji Berbasis Properti (Property-based test)**: 500 transaksi acak bergantian (setor, tarik, balik) pada multi-siswa membuktikan bahwa saldo tidak pernah negatif dan fungsi audit `IntegritasService.periksa()` (CAP-17) melaporkan **0 selisih**.

### 4.2 Pemeriksaan Tipe (`npm run typecheck`)
- `tsc --noEmit` (Renderer & Shared): **0 error**.
- `tsc -p tsconfig.node.json --noEmit` (Main Process & Preload): **0 error**.

### 4.3 Paket Installer (`npm run pack:win`)
- Target: NSIS Windows x64.
- Output: `release/Pundi-Setup-0.1.0.exe` (Ukuran: **90.4 MB**; NFR-10 mensyaratkan < 200 MB).
- Unpacked: `release/win-unpacked/Pundi.exe` (Telah diuji buka dan berjalan normal).

---

## 5. Analisis Masalah & Perbaikan (Troubleshooting Log)

| Kendala yang Ditemukan | Penyebab Teknis | Solusi yang Diterapkan |
| --- | --- | --- |
| Kompilasi native `better-sqlite3` gagal saat `npm install` awal pada Node v25 | Node v25 adalah versi eksperimental tanpa prebuilt binary, sedangkan sistem tidak memiliki Visual Studio C++ build tools | Mengalihkan runtime eksekusi ke Node.js v22 (LTS) yang memiliki prebuilt binaries siap pakai |
| Aplikasi crash saat dibuka setelah instalasi | Proyek menggunakan `"type": "module"` (ESM), sehingga variabel `__dirname` tidak terdefinisi secara global | Mengganti resolusi path dengan `fileURLToPath(import.meta.url)` standar ESM di `index.ts`, `window.ts`, dan `db/index.ts` |
| Ekstraksi `winCodeSign` gagal pada Windows non-developer mode saat packaging NSIS | Paket `winCodeSign.7z` bawaan electron-builder memuat symlink dylib macOS yang ditolak oleh Windows file system tanpa hak admin | Mengekstrak komponen tool Windows (`rcedit-x64.exe`, `signtool.exe`) ke direktori cache electron-builder dan menambahkan `signAndEditExecutable: false` |

---

## 6. Status Kesiapan Rilis 0.1 & Rencana Rilis 0.2

### 6.1 Rilis 0.1 (Selesai 100%)
- [x] CAP-01: Profil sekolah dan pengaturan
- [x] CAP-02: Tahun ajaran dan kelas
- [x] CAP-03: Data siswa & penomoran rekening
- [x] CAP-04: Impor siswa dari Excel/CSV
- [x] CAP-05: Setoran tabungan
- [x] CAP-06: Penarikan tabungan
- [x] CAP-07: Koreksi transaksi (pembalik)
- [x] CAP-09: Bukti transaksi (struk)
- [x] CAP-10: Buku besar per siswa
- [x] CAP-11: Laporan kas, kelas, siswa & ekspor Excel
- [x] CAP-13: Backup snapshot & retensi
- [x] CAP-17: Pemeriksaan integritas saldo

### 6.2 Rencana Fitur Rilis 0.2 (Fase F4)
- **CAP-08 (Biaya Administrasi)**: Pemotongan biaya berkala sesuai keputusan `D-06`.
- **CAP-12 (Kenaikan Kelas & Kelulusan)**: Antarmuka kenaikan kelas massal antar tahun ajaran.
- **CAP-14 (Migrasi Data Saldo Awal)**: Impor saldo awal dari berkas rekap ekspor lama dengan layar pencocokan saldo.
- **CAP-16 (Kunci Aplikasi PIN)**: Pengamanan aplikasi opsional dengan hash PIN saat aplikasi dibuka.
