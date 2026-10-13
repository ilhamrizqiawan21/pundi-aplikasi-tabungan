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
| BF-02 | Verifikasi PDF multi-halaman | **Sebagian selesai** — PDF 200 siswa menghasilkan lebih dari satu halaman; header berulang dan nomor halaman ada pada markup. Signature dan jumlah halaman lolos E2E. Tangkapan Edge headless atas berkas PDF pada lingkungan ini hanya menghasilkan bidang kosong, sehingga belum menjadi bukti visual yang sah. | Masih perlu memeriksa pemotongan isi dan footer halaman dengan PDF viewer yang merender isi PDF. |
| BF-03 | Pemilihan logo sekolah | **Selesai** — pengaturan memakai dialog proses utama; PNG/JPEG maksimal 2 MB; jalur tidak pernah dikirim ke renderer; SVG ditolak. Logo dimasukkan sebagai data lokal pada struk/laporan cetak. | E2E `tests/e2e/logo-sekolah.spec.ts` menguji simpan profil, pilih, render ke HTML, hapus, penolakan SVG, dan tidak membocorkan jalur. |
| BF-04 | Verifikasi alur backup dan pemulihan | **Selesai untuk alur otomatis** — E2E membuat backup, menyalin ke folder sementara, memulihkan, dan memeriksa data serta backup pengaman. | Bukti: `tests/e2e/cadangan.spec.ts`. Dialog folder native dimock ke folder sementara; pemeriksaan desktop Windows mengikuti [UJI_DIALOG_CADANGAN_BF04](UJI_DIALOG_CADANGAN_BF04.md) dan masih perlu operator. |
| BF-05 | Verifikasi alur Tema dan PIN | **Selesai untuk alur otomatis** — tema bertahan setelah pembukaan ulang; alur PIN diuji lewat UI dengan data sementara. | Bukti: `tests/e2e/tema.spec.ts` dan `tests/e2e/pin.spec.ts`; 12 uji terkait lulus pada eksekusi prioritas 1. |

## Prioritas 2 — Fitur baru yang dapat memakai kemampuan lokal yang ada

| ID | Pekerjaan | Rancangan awal | Catatan |
| --- | --- | --- | --- |
| BF-06 | Riwayat transaksi lintas siswa dan cetak ulang struk | **Selesai** pada tab Transaksi di Laporan: filter tanggal, nama/nomor (pencarian SQL literal), kelas, jenis; setiap baris membuka pratinjau/cetak struk melalui jalur yang ada. Tidak menambah menu utama. | Bukti: `tests/e2e/alur.spec.ts` memfilter nomor siswa dan membuka struk. Hanya baca; tidak mengubah transaksi/saldo. |
| BF-07 | Peringatan kemungkinan siswa ganda saat impor | **Selesai**: normalisasi nama dan jarak edit mendeteksi kemiripan dalam kelas yang sama, baik terhadap daftar siswa maupun baris sebelumnya di berkas; pratinjau tetap valid dan memberi operator catatan. NIS duplikat tetap ditolak. | Bukti: `impor.test.ts` menguji nama mirip dalam basis data/berkas, beda kelas, dan NIS; `tests/e2e/impor-kemiripan.spec.ts` memastikan operator tetap dapat memilih menerapkan tanpa penggabungan otomatis. |
| BF-08 | Audit konsistensi profil pada dokumen | **Selesai pada kode dan uji**: semua generator laporan memakai `kopSekolahHtml` untuk nama, alamat/kota, dan logo lokal; slip saldo diperbaiki agar memakai kop bersama. Teks profil di-escape. | Bukti uji: `rutinitas-harian.test.ts` mencakup logo dan alamat berbahaya pada slip; E2E logo menguji data URI dan tidak membocorkan jalur. Pemeriksaan visual halaman PDF belum termasuk. |
| BF-09 | Uji alur pencatatan harian dengan operator | **Belum selesai**; panduan tugas dan lembar pengamatan siap di [UJI_OPERATOR_BF09](UJI_OPERATOR_BF09.md). | Perlu operator bendahara nyata untuk mengukur waktu, kesalahan, ragu, dan pesan membingungkan. Jangan mencatat data sekolah nyata. |

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
