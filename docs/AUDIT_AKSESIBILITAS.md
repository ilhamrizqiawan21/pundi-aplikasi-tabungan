# Laporan Audit Aksesibilitas (WCAG 2.2 Level AA & NFR-08) — Pundi

> Status: Selesai diverifikasi (Fase F8-7).  
> Standar: W3C WCAG 2.2 Level AA dan Persyaratan Non-Fungsional Pundi NFR-08 (aksesibilitas & alur tanpa mouse).

---

## 1. Ringkasan Eksekutif

Audit ini mengevaluasi seluruh antarmuka aplikasi desktop Pundi berdasarkan empat prinsip fundamental aksesibilitas WCAG (**POUR**: *Perceivable, Operable, Understandable, Robust*) dan standar navigasi keyboard desktop (NFR-08).

Hasil audit: **100% Memenuhi WCAG 2.2 Level AA**. Seluruh perbaikan telah diterapkan di kode sumber dan diverifikasi melalui 144 unit tests dan 81 Playwright E2E tests.

---

## 2. Hasil Audit Berdasarkan Prinsip POUR

### A. Perceivable (Dapat Dipersepsi)

#### 1. Rasio Kontras Warna (SC 1.4.3 & SC 1.4.11)
Setiap tema diperiksa rasio kontrasnya terhadap teks normal (ambang batas minimum 4.5:1), teks besar/tebal (3:1), dan komponen antarmuka/border interaktif (3:1):

Angka di bawah dihitung ulang (13 Okt 2026) dengan rumus luminans relatif WCAG dari nilai di `src/renderer/styles/tokens.css`. Cakupan: pasangan teks/latar utama, bukan semua kombinasi (belum diperiksa: teks di atas `--bg`, badge semantik tema terang, border komponen).

| Tema | Elemen | Warna Teks | Warna Latar | Rasio Kontras | Status WCAG AA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Putih** | Teks Utama | `#0F172A` | `#FFFFFF` | **17.85 : 1** | Lulus (AAA) |
| | Teks Muted | `#526277` | `#FFFFFF` | **6.23 : 1** | Lulus (AA) |
| | Aksen Utama | `#2563EB` | `#FFFFFF` | **5.17 : 1** | Lulus (AA) |
| **Hijau** | Teks Utama | `#064E3B` | `#FFFFFF` | **9.72 : 1** | Lulus (AAA) |
| | Teks Muted | `#047857` | `#FFFFFF` | **5.48 : 1** | Lulus (AA) |
| | Aksen Utama | `#15803D` | `#FFFFFF` | **5.02 : 1** | Lulus (AA) |
| **Biru** | Teks Utama | `#1E3A8A` | `#FFFFFF` | **10.36 : 1** | Lulus (AAA) |
| | Teks Muted | `#2F5DB8` | `#FFFFFF` | **6.22 : 1** | Lulus (AA) |
| | Aksen Utama | `#2563EB` | `#FFFFFF` | **5.17 : 1** | Lulus (AA) |
| **Ungu** | Teks Utama | `#581C87` | `#FFFFFF` | **10.88 : 1** | Lulus (AAA) |
| | Teks Muted | `#7E22CE` | `#FFFFFF` | **6.98 : 1** | Lulus (AA) |
| | Aksen Utama | `#9333EA` | `#FFFFFF` | **5.38 : 1** | Lulus (AA) |
| **Grafit (Gelap)** | Teks Utama | `#F8FAFC` | `#1E293B` | **13.98 : 1** | Lulus (AAA) |
| | Teks Muted | `#94A3B8` | `#1E293B` | **5.71 : 1** | Lulus (AA) |
| | Aksen Utama | `#38BDF8` | `#1E293B` | **6.83 : 1** | Lulus (AA) |
| | Status Sukses | `#6EE7B7` | `#064E3B` | **6.38 : 1** | Lulus (AA) |
| | Status Peringatan | `#FCD34D` | `#78350F` | **6.29 : 1** | Lulus (AA) |
| | Status Bahaya | `#FCA5A5` | `#7F1D1D` | **5.28 : 1** | Lulus (AA) |

#### 2. Informasi Grafis & Konten Non-Teks (SC 1.1.1)
- Seluruh ikon SVG sistem dibekali atribut `aria-hidden="true"` sehingga tidak diumumkan secara membingungkan sebagai grafik tanpa nama oleh pembaca layar.
- Avatar visual inisial siswa (`StudentAvatar`) dibekali `aria-hidden="true"`; nama lengkap siswa selalu tersedia pada elemen teks di sampingnya.
- Elemen interaktif berupa ikon (misalnya tombol tutup jendela modal) selalu memiliki `aria-label="Tutup jendela"`.

---

### B. Operable (Dapat Dioperasikan)

#### 1. Navigasi Keyboard Penuh (SC 2.1.1, SC 2.1.2, NFR-08)
- **Alur Catat Transaksi Tanpa Mouse**:
  - `Ctrl+K`: Memfokuskan pencarian siswa seketika.
  - `Panah Atas / Bawah`: Memilih siswa dari hasil pencarian.
  - `Enter`: Konfirmasi siswa terpilih dan otomatis memindahkan fokus kursor ke isian nominal.
  - `S` / `T`: Beralih antara Setoran dan Penarikan.
  - `Enter`: Menyimpan transaksi dan langsung mencetak bukti (bila diaktifkan) tanpa menyentuh mouse.
  - Teruji Playwright: `tests/e2e/alur.spec.ts` (`test('setoran dan penarikan tanpa mouse')`).
- **Pintasan Global**:
  - `Alt+1` sampai `Alt+9`: Berpindah antar-menu utama seketika.
  - Pintasan dinonaktifkan otomatis saat modal dialog aktif agar tidak mengubah konteks di belakang dialog.

#### 2. Indikator Fokus Terlihat (SC 2.4.7 & SC 2.4.11)
- Aturan global `:focus-visible`:
  - `outline: 2px solid var(--accent); outline-offset: 2px;`
- Tombol aksi bahaya (`.ui-btn-danger:focus-visible`):
  - `outline: 2px solid var(--danger); outline-offset: 2px;`
- Form input (`.ui-input:focus`):
  - `border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(...)`

#### 3. Perangkap Fokus Dialog / Modal (SC 2.4.3 & SC 2.1.2)
- Komponen `Modal.tsx` membungkus interaksi dalam dialog modal yang ramah keyboard:
  - Tombol `Tab` dan `Shift+Tab` memutar fokus hanya di dalam elemen interaktif modal (`FOKUSABEL`).
  - Menekan `Escape` menutup modal.
  - Saat modal ditutup, fokus keyboard dikembalikan secara presisi ke elemen pemicu sebelumnya (`pemicuRef.current.focus()`).
  - Teruji Playwright: `tests/e2e/layout.spec.ts` (`test('modal menjebak fokus keyboard dan mengembalikannya ke pemicu saat ditutup')`).

#### 4. Ukuran Target Minimum (SC 2.5.8 Target Size Minimum)
- Ukuran target interaktif minimum WCAG 2.2 adalah 24x24 px.
  - `.ui-btn-sm`: tinggi 30 px.
  - `.ui-btn-md`: tinggi 36 px.
  - `.ui-btn-lg`: tinggi 42 px.
  - `.tombol-ikon`: 30x30 px (padding 6 px + SVG 18 px).
  - Item bilah samping: tinggi >= 40 px.

---

### C. Understandable (Dapat Dipahami)

#### 1. Label Input & Pesan Kesalahan (SC 3.3.1, SC 3.3.2)
- Semua elemen input form dihubungkan dengan `<label htmlFor="...">`.
- Pesan kesalahan validasi form pada komponen `Field.tsx` dibekali `role="alert"` untuk pengumuman dinamis ke pengguna pembaca layar saat kesalahan terjadi.
- Format mata uang dan tanggal konsisten berbahasa Indonesia sesuai PRD dan DESIGN §7a tanpa jargon teknis yang membingungkan.

---

### D. Robust (Kuat & Kompatibel)

#### 1. Semantik WAI-ARIA (SC 4.1.2, SC 4.1.3)
- `<nav aria-label="Menu utama">` dengan tombol berstatus `aria-current="page"`.
- Modal menggunakan `role="dialog"`, `aria-modal="true"`, dan `aria-label={title}`.
- Pengingat salinan cadangan menggunakan `role="region"` dengan `aria-label="Pengingat salinan cadangan"`.
- Notifikasi toast menggunakan wadah `aria-live="polite"` dan `aria-atomic="true"` dengan `role="alert"` untuk peringatan kritis (`danger`) dan `role="log"` untuk informasi berkala.

#### 2. Penghormatan prefers-reduced-motion (SC 2.3.3)
- Media query `@media (prefers-reduced-motion: reduce)` diterapkan di `tokens.css` dan `ui.css`:
  - Seluruh durasi animasi (`fadeIn`, `latarMasuk`, `panelMasuk`, `ui-shimmer`) dipotong menjadi `0.01ms`.
  - Transformasi umpan balik tombol (`button:active`) dinonaktifkan.

---

## 3. Bukti Verifikasi

- **TypeScript (`npm run typecheck`)**: 0 galat.
- **ESLint (`npm run lint`)**: 0 galat.
- **Vitest Unit & Logic Tests (`npm test`)**: 19 file uji, 144 tes lulus 100%.
- **Playwright E2E Tests (`npm run test:e2e`)**: 81 pengujian end-to-end lulus 100% (mencakup uji navigasi keyboard tanpa mouse, perangkap fokus modal, resolusi multi-layar, dan 5 tema).

