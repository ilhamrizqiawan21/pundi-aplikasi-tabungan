import { useCallback, useEffect, useState } from 'react';
import type { ItemAktivitas } from '../../shared/types.js';
import { formatWaktuWib } from '../../shared/tanggal.js';
import { tombol, kartu, kartuKepala, sel } from '../styles/ui.js';

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
    <section style={kartu} aria-labelledby="ra-judul">
      <div style={kartuKepala}>
        <div>
          <h3 id="ra-judul" style={{ fontSize: '14px', fontWeight: 600 }}>Riwayat aktivitas</h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Catatan kegiatan penting di aplikasi, terbaru di atas. Nama siswa dan nominal tidak dicatat di sini.
          </p>
        </div>
        <button type="button" style={tombol} onClick={() => muat()} disabled={memuat}>Segarkan</button>
      </div>
      {galat && (
        <div role="alert" style={{ margin: '12px 18px', padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', fontSize: '13px' }}>
          {galat}
        </div>
      )}
      {daftar.length === 0 && !galat ? (
        <p style={{ padding: '28px 18px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
          Belum ada aktivitas yang tercatat.
        </p>
      ) : (
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                <th style={sel}>Waktu</th>
                <th style={sel}>Kegiatan</th>
                <th style={sel}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...sel, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{waktuTampil(a.waktu)}</td>
                  <td style={{ ...sel, fontWeight: 600 }}>{LABEL_AKSI[a.aksi] ?? a.aksi}</td>
                  <td style={{ ...sel, color: 'var(--muted)' }}>{a.ringkasan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {masihAda && (
        <div style={{ padding: '12px 18px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <button type="button" style={tombol} disabled={memuat} onClick={() => muat(daftar[daftar.length - 1]?.id)}>
            Muat lebih lama
          </button>
        </div>
      )}
    </section>
  );
}
