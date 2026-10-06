import { useState } from 'react';
import type { Kelas } from '../../shared/types.js';
import { PratinjauCetakModal } from './PratinjauCetakModal.js';
import { tombolUtama, kolom, labelStyle, kartu } from '../styles/ui.js';

interface SlipSaldoPanelProps {
  kelasList: Kelas[];
}

/** CAP-18: slip saldo (saldo dan 5 transaksi terakhir) per kelas, untuk dibagikan lewat wali kelas. */
export function SlipSaldoPanel({ kelasList }: SlipSaldoPanelProps) {
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<{ html: string; judul: string } | null>(null);

  const siapkan = async () => {
    if (kelasId === '') return;
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.cetakLaporanHtml({ jenis: 'slipSaldo', kelasId });
    setSibuk(false);
    if (res.ok) setPratinjau(res.data);
    else setGalat(res.pesan);
  };

  return (
    <section style={{ ...kartu, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '620px' }} aria-label="Slip saldo">
      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Cetak satu slip per siswa berisi saldo dan lima transaksi terakhir. Dua slip per baris di kertas A4, siap
        digunting dan dibagikan lewat wali kelas. Saldo dihitung saat dicetak.
      </p>
      <div>
        <label htmlFor="slip-kelas" style={labelStyle}>Kelas</label>
        <select id="slip-kelas" style={kolom} value={kelasId} onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">-- Pilih kelas --</option>
          {kelasList.map((k) => (
            <option key={k.id} value={k.id}>{k.nama}</option>
          ))}
        </select>
      </div>
      {galat && (
        <div role="alert" style={{ padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
          {galat}
        </div>
      )}
      {pesan && (
        <div role="status" style={{ padding: '10px 14px', border: '1px solid var(--ok)', color: 'var(--ok)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
          {pesan}
        </div>
      )}
      <div>
        <button type="button" style={{ ...tombolUtama, opacity: kelasId === '' || sibuk ? 0.5 : 1 }} disabled={kelasId === '' || sibuk} onClick={siapkan}>
          {sibuk ? 'Menyiapkan...' : 'Pratinjau Slip'}
        </button>
      </div>

      {pratinjau && (
        <PratinjauCetakModal
          terbuka
          judul="Slip Saldo Siswa"
          html={pratinjau.html}
          onTutup={() => setPratinjau(null)}
          onSimpanPdf={async () => {
            const res = await window.pundi.cetakLaporanPdf({ jenis: 'slipSaldo', kelasId: kelasId === '' ? undefined : kelasId });
            if (res.ok && res.data) setPesan(`PDF berhasil disimpan: ${res.data.nama_berkas}`);
          }}
        />
      )}
    </section>
  );
}
