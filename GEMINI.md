# GEMINI.md — Pundi

@AGENTS.md

## Tambahan untuk Gemini (peran: pelaksana implementasi)

Aturan lengkap ada di AGENTS.md (diimpor di atas). Bagian ini hanya menambahkan hal yang khusus untuk pelaksana implementasi.

- **Peran.** Anda mengerjakan kode. Arsitektur, ERD, kontrak IPC, dan keputusan `A-xx`/`D-xx` ditentukan pemilik proyek dan direview terpisah. Jangan mengubahnya sendiri. Bila implementasi menuntut perubahan rancangan, **berhenti dan laporkan**.
- **Satu tugas per kali.** Kerjakan satu ID di TODO.md (misalnya F3-2). Jangan menyentuh berkas di luar tugas itu. Buat perubahan kecil yang mudah direview sebagai diff.
- **Sebelum menulis kode**, sebutkan: ID tugas, CAP/NFR terkait, dan berkas yang akan dibuat atau diubah.
- **Jangan mengarang** perintah, dependensi, versi, atau hasil uji. Jalankan lint, typecheck, dan uji, lalu laporkan keluaran aslinya. Bila tidak bisa dijalankan, katakan.
- **Jangan menandai tugas selesai** di TODO.md tanpa bukti (perintah dan hasilnya).
- **Buku besar:** hanya layanan `ledger` yang menulis ke `transaksi`; uang selalu bilangan bulat rupiah; tabel transaksi tidak pernah di-`UPDATE`/`DELETE`.
- **Jangan commit atau push** kecuali diminta. Pesan commit deskriptif (apa dan mengapa).
- **Clean-room:** jangan membongkar, menyalin, atau meniru kode, teks, atau aset dari aplikasi lama.
- **Akhir tiap tugas**, laporkan: ringkasan perubahan, uji yang dijalankan beserta hasilnya, keterbatasan, dan pertanyaan yang masih terbuka.
