import { useCallback, useEffect, useState } from 'react';
import type { ItemAktivitas } from '../../shared/types.js';
import { formatWaktuWib } from '../../shared/tanggal.js';
import { Button } from './ui/index.js';
import './panel-bersama.css';

const LABEL_AKSI: Record<string, string> = {
  'transaksi.setor': 'Setoran',
  'transaksi.tarik': 'Penarikan',
  'transaksi.balik': 'Koreksi transaksi',
  'transaksi.saldo_awal': 'Saldo awal',
  'siswa.tambah': 'Siswa baru',
  'impor.siswa': 'Impor siswa',
  'kenaikan.terapkan': 'Kenaikan kelas',
  'backup.buat': 'Cadangan dibuat',
  'backup.salinKeLuar': 'Salinan cadangan ke flashdisk',
  restore: 'Pemulihan data',
};

/** Basis data mencatat sebagian waktu sebagai UTC tanpa zona ("YYYY-MM-DD HH:MM:SS"); jadikan ISO UTC agar tampil di WIB dengan benar. */
function waktuTampil(waktu: string): string {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(waktu) ? `${waktu.replace(' ', 'T')}Z` : waktu;
  return formatWaktuWib(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Riwayat aktivitas penting (hanya baca). Tidak memuat nama atau nominal (NFR-02). */
export function RiwayatAktivitasPanel() {
  const [daftar, setDaftar] = useState<ItemAktivitas[]>([]);
  const [masihAda, setMasihAda] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async (sebelumId?: number) => {
    setMemuat(true);
    const res = await window.pundi.auditDaftar(sebelumId);
    setMemuat(false);
    if (!res.ok) {
      setGalat(res.pesan);
      return;
    }
    setGalat(null);
    setDaftar((lama) => (sebelumId ? [...lama, ...res.data] : res.data));
    setMasihAda(res.data.length >= 100);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <section className="ui-card" aria-labelledby="ra-judul">
      <div className="ui-card-header">
        <div>
          <h3 id="ra-judul" className="pb-judul">Riwayat aktivitas</h3>
          <p className="pb-sub">
            Catatan kegiatan penting di aplikasi, terbaru di atas. Nama siswa dan nominal tidak dicatat di sini.
          </p>
        </div>
        <Button type="button" onClick={() => muat()} disabled={memuat}>Segarkan</Button>
      </div>
      {galat && (
        <div role="alert" className="pb-pesan pb-pesan-galat pb-pesan-margin">
          {galat}
        </div>
      )}
      {daftar.length === 0 && !galat ? (
        <p className="pb-kosong">
          Belum ada aktivitas yang tercatat.
        </p>
      ) : (
        <div className="pb-gulir-polos">
          <table className="tabel">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Kegiatan</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((a) => (
                <tr key={a.id}>
                  <td className="pb-nowrap pb-muted">{waktuTampil(a.waktu)}</td>
                  <td className="pb-tebal">{LABEL_AKSI[a.aksi] ?? a.aksi}</td>
                  <td className="pb-muted">{a.ringkasan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {masihAda && (
        <div className="pb-tengah">
          <Button type="button" disabled={memuat} onClick={() => muat(daftar[daftar.length - 1]?.id)}>
            Muat lebih lama
          </Button>
        </div>
      )}
    </section>
  );
}
