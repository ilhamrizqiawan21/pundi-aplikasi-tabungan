import { useState, useEffect } from 'react';
import type { Kelas } from '../../shared/types.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { Modal } from './Modal.js';
import { Button, Field } from './ui/index.js';
import './panel-bersama.css';

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
      <div className="pb-kolom">
        <p className="pb-teks-kecil">
          Potongan dicatat sebagai transaksi biaya administrasi dan mengurangi saldo siswa. Uang tidak keluar dari laci,
          jadi tidak memengaruhi hitungan kas. Siswa yang saldonya kurang dari biaya dilewati (tidak dipotong sebagian).
        </p>
        <div className="pb-grid">
          <Field label="Kelas" htmlFor="ba-kelas">
            <select id="ba-kelas" className="ui-input" value={kelasId} onChange={(e) => ubah(() => setKelasId(e.target.value === '' ? '' : Number(e.target.value)))}>
              <option value="">-- Pilih --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </Field>
          <Field label="Periode" htmlFor="ba-periode">
            <input id="ba-periode" type="text" className="ui-input" value={periode} maxLength={40} placeholder="mis. Semester 1 2025/2026" onChange={(e) => ubah(() => setPeriode(e.target.value))} />
          </Field>
          <Field label="Biaya per siswa (Rp)" htmlFor="ba-nominal">
            <input id="ba-nominal" type="text" inputMode="numeric" autoComplete="off" className="ui-input" value={nominalTeks} onChange={(e) => ubah(() => setNominalTeks(e.target.value))} />
            {nominalTeks.trim() !== '' && !nominalSah && (
              <div className="pb-galat-baris">
                {nominal.ok ? 'Nominal harus lebih dari 0' : nominal.alasan}
              </div>
            )}
          </Field>
          <Field label="Tanggal" htmlFor="ba-tanggal">
            <input id="ba-tanggal" type="date" className="ui-input" value={tanggal} max={hariIniLokal()} onChange={(e) => ubah(() => setTanggal(e.target.value))} />
          </Field>
        </div>

        {pesan && (
          <div role="status" className="pb-pesan pb-pesan-ok pb-pesan-ok-tebal">
            {pesan}
          </div>
        )}
        {galat && (
          <div role="alert" className="pb-pesan pb-pesan-galat">
            {galat}
          </div>
        )}

        {rencana && (
          <div className="pb-kolom" aria-label="Hasil tinjauan">
            <div className="pb-teks-sedang">
              <strong>{rencana.dipotong.length}</strong> siswa akan dipotong
              {nominal.ok && <>, total <strong className="tabular-nums">{formatRupiah(rencana.dipotong.length * nominal.nilai)}</strong></>}.{' '}
              <strong>{rencana.dilewati.length}</strong> dilewati.
            </div>
            {rencana.dilewati.length > 0 && (
              <div className="pb-gulir pb-gulir-26">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Dilewati</th>
                      <th>Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rencana.dilewati.map((s) => (
                      <tr key={s.siswa_id}>
                        <td>{s.nama} <span className="pb-nomor">{s.nomor}</span></td>
                        <td className="pb-warn">{s.alasan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="pb-aksi">
          <Button type="button" disabled={sibuk} onClick={onClose}>Tutup</Button>
          <Button type="button" disabled={!formSah || sibuk} onClick={tinjau}>
            Tinjau
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!rencana || rencana.dipotong.length === 0 || sibuk}
            onClick={terapkan}
          >
            {sibuk ? 'Memproses...' : 'Terapkan Potongan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
