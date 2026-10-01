import { contextBridge, ipcRenderer } from 'electron';
import type { PundiApi } from '../shared/types.js';

const api: PundiApi = {
  // Siswa
  siswaCari: (query, kelasId, status) =>
    ipcRenderer.invoke('siswa.cari', { query, kelasId, status }),
  siswaDetail: (id) => ipcRenderer.invoke('siswa.detail', { id }),
  siswaSimpan: (data) => ipcRenderer.invoke('siswa.simpan', data),
  siswaHapus: (id) => ipcRenderer.invoke('siswa.hapus', { id }),

  // Impor
  imporPratinjau: (tokenBerkas) =>
    ipcRenderer.invoke('impor.pratinjau', { tokenBerkas }),
  imporTerapkan: (tokenBerkas) =>
    ipcRenderer.invoke('impor.terapkan', { tokenBerkas }),

  // Akademik
  tahunAjaranDaftar: () => ipcRenderer.invoke('akademik.tahunAjaranDaftar'),
  tahunAjaranSimpan: (data) =>
    ipcRenderer.invoke('akademik.tahunAjaranSimpan', data),
  tahunAjaranHapus: (id) => ipcRenderer.invoke('akademik.tahunAjaranHapus', { id }),
  kelasDaftar: (tahunAjaranId) =>
    ipcRenderer.invoke('akademik.kelasDaftar', { tahunAjaranId }),
  kelasSimpan: (data) => ipcRenderer.invoke('akademik.kelasSimpan', data),
  kelasHapus: (id) => ipcRenderer.invoke('akademik.kelasHapus', { id }),
  kelasSalin: (dariId, keId) => ipcRenderer.invoke('akademik.kelasSalin', { dari_id: dariId, ke_id: keId }),

  // Transaksi & Buku Besar
  transaksiSetor: (data) => ipcRenderer.invoke('transaksi.setor', data),
  transaksiTarik: (data) => ipcRenderer.invoke('transaksi.tarik', data),
  transaksiBalik: (data) => ipcRenderer.invoke('transaksi.balik', data),
  transaksiRiwayat: (filter) =>
    ipcRenderer.invoke('transaksi.riwayat', filter),

  // Laporan & Dasbor
  laporanKasHarian: (tanggal) =>
    ipcRenderer.invoke('laporan.kasHarian', { tanggal }),
  laporanRekapKelas: (tahunAjaranId) =>
    ipcRenderer.invoke('laporan.rekapKelas', { tahunAjaranId }),
  laporanRekapSiswa: (filter) =>
    ipcRenderer.invoke('laporan.rekapSiswa', filter),

  // Pengaturan & Profil
  profilSekolahBaca: () => ipcRenderer.invoke('pengaturan.profilBaca'),
  profilSekolahSimpan: (data) =>
    ipcRenderer.invoke('pengaturan.profilSimpan', data),
  pengaturanBaca: () => ipcRenderer.invoke('pengaturan.baca'),
  pengaturanSimpan: (data) =>
    ipcRenderer.invoke('pengaturan.simpan', data),

  // Integritas & Backup
  integritasPeriksa: () => ipcRenderer.invoke('integritas.periksa'),
  backupBuat: (keterangan) =>
    ipcRenderer.invoke('backup.buat', { keterangan }),
  backupDaftar: () => ipcRenderer.invoke('backup.daftar'),
  backupRestore: (tokenBerkas) =>
    ipcRenderer.invoke('backup.restore', { tokenBerkas }),

  // Dialog
  dialogPilihFile: (opsi) => ipcRenderer.invoke('dialog.pilihFile', opsi),
};

contextBridge.exposeInMainWorld('pundi', api);
