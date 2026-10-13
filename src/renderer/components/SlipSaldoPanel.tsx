import { useState } from 'react';
import type { Kelas } from '../../shared/types.js';
import { PratinjauCetakModal } from './PratinjauCetakModal.js';
import { Button, Field } from './ui/index.js';
import './panel-bersama.css';

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
    <section className="ui-card pb-panel" aria-label="Slip saldo">
      <p className="pb-teks-redup">
        Cetak satu slip per siswa berisi saldo dan lima transaksi terakhir. Dua slip per baris di kertas A4, siap
        digunting dan dibagikan lewat wali kelas. Saldo dihitung saat dicetak.
      </p>
      <Field label="Kelas" htmlFor="slip-kelas">
        <select id="slip-kelas" className="ui-input" value={kelasId} onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">-- Pilih kelas --</option>
          {kelasList.map((k) => (
            <option key={k.id} value={k.id}>{k.nama}</option>
          ))}
        </select>
      </Field>
      {galat && (
        <div role="alert" className="pb-pesan pb-pesan-galat">
          {galat}
        </div>
      )}
      {pesan && (
        <div role="status" className="pb-pesan pb-pesan-ok">
          {pesan}
        </div>
      )}
      <div>
        <Button type="button" variant="primary" disabled={kelasId === '' || sibuk} onClick={siapkan}>
          {sibuk ? 'Menyiapkan...' : 'Pratinjau Slip'}
        </Button>
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
