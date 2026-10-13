# Pemeriksaan dialog cadangan Windows (BF-04)

Status: prosedur disiapkan; dialog native belum diperiksa manual pada desktop Windows.

Gunakan build Pundi dan data sintetis di folder data sementara. Jangan pilih atau pulihkan basis data sekolah nyata.

1. Buka **Cadangan**, pilih **Cadangkan Sekarang**, lalu pastikan cadangan baru muncul di daftar.
2. Pilih **Salin ke flashdisk**. Pastikan dialog Windows meminta folder tujuan. Batalkan; pastikan aplikasi tetap dapat dipakai dan tidak menyatakan salinan berhasil.
3. Ulangi dan pilih folder sementara yang kosong. Pastikan pesan berhasil muncul dan berkas SQLite ada di folder itu.
4. Pilih **Pulihkan dari ...** pada cadangan sintetis. Pastikan dialog Windows meminta berkas backup. Batalkan dan pastikan data sekarang tidak berubah.
5. Ulangi, pilih backup sintetis, periksa konfirmasi pemulihan, lanjutkan, lalu pastikan aplikasi terbuka dan data kembali sesuai backup.
6. Catat versi build, Windows, hasil tiap langkah, dan kode galat yang tampak. Jangan catat jalur folder atau isi data siswa.

Hentikan pemeriksaan bila dialog menampilkan folder data nyata atau sumber backup tidak dapat dikenali.
