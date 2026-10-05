import { useState, useEffect } from 'react';
import type { Kelas } from '../../shared/types.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { Modal } from './Modal.js';
import { tombol, tombolUtama, kolom, labelStyle, sel } from '../styles/ui.js';

interface BiayaAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Dipanggil setelah potongan tersimpan (mis. memuat ulang saldo). */
  onSaved: () => void;
}

type Rencana = Awaited<ReturnType<typeof window.pundi.biayaAdmRencana>> extends infer R
  ? R extends { ok: true; data: infer D }
    ? D
    : never
  : never;

/**
 * CAP-08: potong biaya administrasi satu kelas (keputusan D-06). Tinjau dulu siapa yang dipotong dan siapa yang
 * dilewati (saldo kurang, sudah dipotong untuk periode itu, bukan siswa aktif), baru terapkan sekaligus.
 */
export function BiayaAdminModal({ isOpen, onClose, onSaved }: BiayaAdminModalProps) {
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [periode, setPeriode] = useState('');
  const [nominalTeks, setNominalTeks] = useState('');
  const [tanggal, setTanggal] = useState(() => hariIniLokal());
  const [rencana, setRencana] = useState<Rencana | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setGalat(null);
    setPesan(null);
    setRencana(null);
    setTanggal(hariIniLokal());
    window.pundi.kelasDaftar().then((res) => res.ok && setKelasList(res.data));
  }, [isOpen]);

  const nominal = parseRupiahKetat(nominalTeks);
  const nominalSah = nominalTeks.trim() !== '' && nominal.ok && nominal.nilai > 0;
  const formSah = kelasId !== '' && nominalSah && periode.trim().length >= 3 && tanggal !== '' && tanggal <= hariIniLokal();

  // Setiap isian berubah, pratinjau lama tidak berlaku lagi
  const ubah = (aksi: () => void) => {
    aksi();
    setRencana(null);
    setPesan(null);
  };

  const tinjau = async () => {
    if (!formSah || !nominal.ok) return;
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.biayaAdmRencana({ kelas_id: Number(kelasId), nominal: nominal.nilai, periode: periode.trim() });
    setSibuk(false);
    if (res.ok) setRencana(res.data);
    else setGalat(res.pesan);
  };

  const terapkan = async () => {
    if (!formSah || !nominal.ok || !rencana) return;
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.biayaAdmTerapkan({ kelas_id: Number(kelasId), nominal: nominal.nilai, periode: periode.trim(), tanggal });
    setSibuk(false);
    if (res.ok) {
      setPesan(`Tersimpan: ${res.data.jumlah} siswa dipotong, total ${formatRupiah(res.data.total)}. ${res.data.dilewati.length} dilewati.`);
      setRencana(null);
      onSaved();
    } else {
      setGalat(res.pesan);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => (sibuk ? undefined : onClose())} title="Biaya Administrasi per Kelas" width="720px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          Potongan dicatat sebagai transaksi biaya administrasi dan mengurangi saldo siswa. Uang tidak keluar dari laci,
          jadi tidak memengaruhi hitungan kas. Siswa yang saldonya kurang dari biaya dilewati (tidak dipotong sebagian).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <label htmlFor="ba-kelas" style={labelStyle}>Kelas</label>
            <select id="ba-kelas" style={kolom} value={kelasId} onChange={(e) => ubah(() => setKelasId(e.target.value === '' ? '' : Number(e.target.value)))}>
              <option value="">-- Pilih --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ba-periode" style={labelStyle}>Periode</label>
            <input id="ba-periode" type="text" style={kolom} value={periode} maxLength={40} placeholder="mis. Semester 1 2025/2026" onChange={(e) => ubah(() => setPeriode(e.target.value))} />
          </div>
          <div>
            <label htmlFor="ba-nominal" style={labelStyle}>Biaya per siswa (Rp)</label>
            <input id="ba-nominal" type="text" inputMode="numeric" autoComplete="off" style={kolom} value={nominalTeks} onChange={(e) => ubah(() => setNominalTeks(e.target.value))} />
            {nominalTeks.trim() !== '' && !nominalSah && (
              <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>
                {nominal.ok ? 'Nominal harus lebih dari 0' : nominal.alasan}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="ba-tanggal" style={labelStyle}>Tanggal</label>
            <input id="ba-tanggal" type="date" style={kolom} value={tanggal} max={hariIniLokal()} onChange={(e) => ubah(() => setTanggal(e.target.value))} />
          </div>
        </div>

        {pesan && (
          <div role="status" style={{ padding: '10px 14px', border: '1px solid var(--ok)', color: 'var(--ok)', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
            {pesan}
          </div>
        )}
        {galat && (
          <div role="alert" style={{ padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', fontSize: '13px' }}>
            {galat}
          </div>
        )}

        {rencana && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} aria-label="Hasil tinjauan">
            <div style={{ fontSize: '13px' }}>
              <strong>{rencana.dipotong.length}</strong> siswa akan dipotong
              {nominal.ok && <>, total <strong className="tabular-nums">{formatRupiah(rencana.dipotong.length * nominal.nilai)}</strong></>}.{' '}
              <strong>{rencana.dilewati.length}</strong> dilewati.
            </div>
            {rencana.dilewati.length > 0 && (
              <div style={{ maxHeight: '26vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <th style={sel}>Dilewati</th>
                      <th style={sel}>Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rencana.dilewati.map((s) => (
                      <tr key={s.siswa_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={sel}>{s.nama} <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{s.nomor}</span></td>
                        <td style={{ ...sel, color: 'var(--warn)' }}>{s.alasan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" style={tombol} disabled={sibuk} onClick={onClose}>Tutup</button>
          <button type="button" style={{ ...tombol, opacity: formSah ? 1 : 0.5 }} disabled={!formSah || sibuk} onClick={tinjau}>
            Tinjau
          </button>
          <button
            type="button"
            style={{ ...tombolUtama, opacity: rencana && rencana.dipotong.length > 0 && !sibuk ? 1 : 0.5 }}
            disabled={!rencana || rencana.dipotong.length === 0 || sibuk}
            onClick={terapkan}
          >
            {sibuk ? 'Memproses...' : 'Terapkan Potongan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
