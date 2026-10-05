# Pundi

Aplikasi desktop **offline** untuk mencatat tabungan siswa: setoran, penarikan, koreksi, laporan, dan cadangan. Dibuat untuk bendahara/operator dan admin sekolah, satu komputer dan satu operator. Windows lebih dulu, macOS Apple Silicon menyusul.

> **Status: rilis 0.1 sedang dikerjakan.** Fitur inti sudah berjalan dan diuji, tetapi hasil cetak belum diukur pada printer nyata dan build macOS belum dibuat. Rincian bukti per tugas ada di [TODO](TODO.md).

## Fitur

- **Catat Transaksi**: setoran dan penarikan dengan keyboard saja, struk dengan pratinjau, setoran per kelas sekaligus, biaya administrasi per kelas.
- **Koreksi**: transaksi dibatalkan lewat transaksi pembalik dengan alasan wajib. Riwayat tidak pernah diubah atau dihapus.
- **Siswa dan Buku Besar**: data siswa, saldo, riwayat dengan saldo berjalan, cetak/PDF.
- **Laporan**: rekap per kelas dan per siswa, daftar transaksi, rekap bulanan dengan grafik, slip saldo per kelas, tutup kas harian. Ekspor PDF dan Excel.
- **Tahun Ajaran, Kelas, dan Kenaikan Kelas**.
- **Impor Excel** dalam empat langkah (pemetaan kolom, pencocokan, pratinjau).
- **Cadangan dan pemulihan** basis data, pengingat salinan ke flashdisk.
- **Pengaturan**: profil sekolah, tema, ukuran struk, kunci PIN dengan kode pemulihan.

Yang **sengaja belum ada**: multi-pengguna atau jaringan, sinkronisasi cloud, integrasi bank, pembaruan otomatis, pinjaman, bunga, dan cetak buku tabungan fisik (menunggu keputusan D-02 sampai D-05 di PRD).

## Prinsip

- **Uang selalu bilangan bulat rupiah**; tabel `transaksi` hanya tambah-saja (trigger basis data menolak `UPDATE` dan `DELETE`), dan hanya layanan `ledger` yang menulis ke sana.
- **Tanpa jaringan**: tidak ada server HTTP lokal, CDN, atau telemetri. Font dan aset dibundel.
- **Electron aman**: `contextIsolation`, `sandbox`, tanpa `nodeIntegration`; renderer hanya berbicara lewat `window.pundi`, setiap IPC memverifikasi pengirim dan memvalidasi argumen dengan `zod`.
- **Data pengguna tidak masuk repositori**: `*.sqlite*`, `backups/`, `logs/`, dan `.env*` ada di `.gitignore`. Data uji hanya sintetis.

## Teknologi

Electron 34, TypeScript `strict`, React 18 + Vite 6, SQLite (`better-sqlite3`), `exceljs`, `zod`, cetak-ke-PDF Chromium.

## Menjalankan

Syarat: **Node 22** (lihat `.nvmrc`) dan npm.

```bash
npm install
npm run build          # membangun renderer dan main/preload
npx electron .         # menjalankan aplikasi
```

Data tersimpan di folder data pengguna Electron (`Pundi/pundi.sqlite`). Untuk mencoba tanpa menyentuh data asli, jalankan dengan folder lain:

```bash
npx electron . --user-data-dir=<folder-percobaan>
```

`npm run dev` hanya menjalankan renderer (Vite) di browser, tanpa Electron dan tanpa basis data.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run typecheck` | Typecheck renderer, main/preload, dan `tests/e2e` |
| `npm run lint` | ESLint |
| `npm test` | Uji unit (Vitest); menukar binary `better-sqlite3` ke ABI Node otomatis |
| `npm run test:e2e` | Uji alur Playwright + Electron, memakai folder data sementara dan data sintetis |
| `npm run build` | Build renderer dan main/preload |
| `npm run pack:win` | Installer Windows x64 (NSIS) ke folder `release/` |

`better-sqlite3` punya dua binary (ABI Node untuk uji, ABI Electron untuk aplikasi). `npm test`, `npm run test:e2e`, dan `npm run pack:win` menukarnya lewat `scripts/native.mjs`; jangan menukar manual. `npm test` menolak berjalan di Node selain 22.

## Struktur

```
src/main/       proses utama: basis data, layanan (ledger, siswa, laporan, impor, backup, kunci), IPC, cetak
src/preload/    jembatan aman window.pundi
src/renderer/   antarmuka React (screens, components, styles)
src/shared/     tipe, skema zod, utilitas bersama
migrations/     migrasi SQL bernomor, hanya maju
tests/e2e/      uji alur Playwright
docs/           PRD, ERD, ARCHITECTURE, DESIGN, laporan implementasi
```

## Dokumen

- [PRD](docs/PRD.md): perilaku produk, acceptance criteria `CAP-xx` dan `NFR-xx`, keputusan terbuka `D-xx`
- [ERD](docs/ERD.md): data dan integritas
- [ARCHITECTURE](docs/ARCHITECTURE.md): rancangan teknis, keamanan, keputusan `A-xx`, spike `S-xx`
- [DESIGN](docs/DESIGN.md): token, layar, alur, cetak, salinan teks
- [TODO](TODO.md): pekerjaan, dependensi, bukti selesai
- [Laporan implementasi 0.1](docs/LAPORAN_IMPLEMENTASI_0.1.md)
- [AGENTS](AGENTS.md): aturan kerja untuk agen AI dan kontributor

## Catatan hak cipta

Ini penulisan ulang dari nol. Aplikasi lama hanya menjadi referensi kebutuhan fungsi; tidak ada kode, teks layar, atau aset yang disalin (lihat bagian clean-room di [AGENTS](AGENTS.md)).
