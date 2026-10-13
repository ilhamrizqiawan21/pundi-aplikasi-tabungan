# Backlog Fitur Lanjutan — Pundi

Status: usulan hasil audit fitur, 13 Oktober 2026. Dokumen ini melengkapi [TODO](../TODO.md); bukan bukti bahwa fitur telah selesai atau telah disetujui untuk rilis.

## Batas pengerjaan

- Aplikasi tetap offline dan data tetap tersimpan di komputer pengguna (PRD NFR-01/NFR-02).
- Gunakan kemampuan Electron, SQLite, Chromium, dan dependensi yang sudah ada. Jangan menambah API berbayar, ekstensi software berbayar, layanan cloud, atau kebutuhan hardware khusus.
- Jangan mengubah buku besar, format data, atau aturan saldo tanpa memperbarui sumber kebenaran terkait dan menambah bukti uji.
- Siswa uji dan contoh impor harus sintetis. Jangan gunakan basis data data-nyata untuk pengujian.

## Prioritas 1 — Tuntaskan dan buktikan kemampuan yang sudah direncanakan

| ID | Pekerjaan | Status yang diketahui | Kriteria selesai |
| --- | --- | --- | --- |
| BF-01 | Ekspor Excel rekap kelas | **Selesai** — layanan, skema IPC, dialog simpan, dan tombol Laporan tersedia. | E2E membuka ulang Excel hasil ekspor; jumlah 200 siswa dan total setoran/saldo Rp 12.000 cocok. Bukti: `tests/e2e/pdf.spec.ts`. |
| BF-02 | Verifikasi PDF multi-halaman | **Sebagian selesai** — PDF 200 siswa berhasil dibuat lebih dari satu halaman; markup menyediakan header berulang dan nomor halaman. | E2E memeriksa signature PDF, jumlah halaman, data siswa terakhir, dan total pada HTML. **Pemeriksaan visual pemotongan isi dan footer halaman masih tersisa**; tidak perlu printer atau layanan berbayar. |
| BF-03 | Pemilihan logo sekolah | **Selesai** — pengaturan memakai dialog proses utama; PNG/JPEG maksimal 2 MB; jalur tidak pernah dikirim ke renderer; SVG ditolak. Logo dimasukkan sebagai data lokal pada struk/laporan cetak. | E2E `tests/e2e/logo-sekolah.spec.ts` menguji simpan profil, pilih, render ke HTML, hapus, penolakan SVG, dan tidak membocorkan jalur. |
| BF-04 | Verifikasi alur backup dan pemulihan | **Selesai untuk alur otomatis** — E2E membuat backup, menyalin ke folder sementara, memulihkan, dan memeriksa data serta backup pengaman. | Bukti: `tests/e2e/cadangan.spec.ts`. Dialog folder native dimock ke folder sementara; pemeriksaan dialog native secara manual masih dicatat di TODO F3-12/F4-8. |
| BF-05 | Verifikasi alur Tema dan PIN | **Selesai untuk alur otomatis** — tema bertahan setelah pembukaan ulang; alur PIN diuji lewat UI dengan data sementara. | Bukti: `tests/e2e/tema.spec.ts` dan `tests/e2e/pin.spec.ts`; 12 uji terkait lulus pada eksekusi prioritas 1. |

## Prioritas 2 — Fitur baru yang dapat memakai kemampuan lokal yang ada

| ID | Pekerjaan | Rancangan awal | Catatan |
| --- | --- | --- | --- |
| BF-06 | Riwayat transaksi lintas siswa dan cetak ulang struk | Layar hanya-baca dengan filter tanggal, nama/nomor siswa, kelas, dan jenis; pilih transaksi untuk melihat detail dan membuka jalur cetak yang ada. | Tidak mengubah transaksi atau saldo. Perlu cek kemampuan kueri/IPC dan UX sebelum implementasi; jangan menambah menu tanpa meninjau urutan navigasi. |
| BF-07 | Peringatan kemungkinan siswa ganda saat impor | Tandai kemiripan nama dan kelas sebagai peringatan pratinjau; tetap minta keputusan operator. | Jangan menggabungkan atau menghapus otomatis. Pertahankan validasi NIS yang sudah ada. |
| BF-08 | Audit konsistensi profil pada dokumen | Periksa kolom profil sekolah yang sudah ada pada struk dan semua jenis laporan; rapikan bila ada keluaran yang tidak konsisten. | Termasuk logo setelah BF-03. Keluaran PDF dapat diperiksa tanpa printer. |
| BF-09 | Uji alur pencatatan harian dengan operator | Amati tugas sintetis mencatat transaksi beruntun dengan keyboard; catat titik ragu, salah input, dan pesan yang membingungkan. | Gunakan temuan untuk perbaikan kecil pada fokus, pintasan, atau validasi. Jangan menambah fitur spekulatif sebelum alur diuji. |

## Tahan sampai keputusan kebutuhan tersedia

- Saldo Tutup Buku dan aturan penutupan periode: menunggu keputusan D-06 dan kebutuhan bendahara nyata.
- Batas penarikan yang memerlukan persetujuan: menunggu keputusan D-07.
- Pinjaman, setoran bank, bunga, dan cetak buku tabungan fisik: tetap menunggu D-02 sampai D-05.
- Multi-pengguna, jaringan, cloud, aplikasi seluler, pembayaran online, integrasi bank, dan pembaruan otomatis: bukan cakupan tanpa permintaan lanjutan (PRD §3).

## Rujukan

- [PRD](PRD.md): CAP-01, CAP-09–14, CAP-16–23, NFR-01/NFR-02, D-02–D-10.
- [ARCHITECTURE](ARCHITECTURE.md): A-08, S-02, S-03, aturan offline dan pemilihan jalur lewat proses utama.
- [DESIGN](DESIGN.md): layar, alur, keluaran cetak, responsivitas.
- [TODO](../TODO.md): status implementasi dan bukti yang sudah dicatat.
