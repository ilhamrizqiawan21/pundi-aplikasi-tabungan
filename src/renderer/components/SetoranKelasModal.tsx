import { useState, useEffect, useMemo, useRef } from 'react';
import type { Kelas, Siswa } from '../../shared/types.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { Modal } from './Modal.js';
import { Button, Field } from './ui/index.js';
import './panel-bersama.css';

interface SetoranKelasModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Dipanggil setelah semua setoran tersimpan (mis. memuat ulang kas hari ini). */
  onSaved: () => void;
}

/** CAP-19: setoran banyak siswa satu kelas sekaligus. Enter pindah ke baris berikutnya; simpan semua atau tidak sama sekali. */
export function SetoranKelasModal({ isOpen, onClose, onSaved }: SetoranKelasModalProps) {
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [nominal, setNominal] = useState<Record<number, string>>({});
  const [tanggal, setTanggal] = useState(() => hariIniLokal());
  const [keterangan, setKeterangan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!isOpen) return;
    setGalat(null);
    setPesan(null);
    setTanggal(hariIniLokal());
    window.pundi.kelasDaftar().then((res) => res.ok && setKelasList(res.data));
  }, [isOpen]);

  useEffect(() => {
    setNominal({});
    setSiswaList([]);
    if (kelasId === '') return;
    window.pundi.siswaCari('', kelasId, 'aktif').then((res) => {
      if (res.ok) setSiswaList(res.data);
      else setGalat(res.pesan);
    });
  }, [kelasId]);

  // Baris kosong dilewati; baris berisi harus nominal bulat > 0
  const hasil = useMemo(() => {
    const baris: { siswa_id: number; nominal: number }[] = [];
    const galatBaris: Record<number, string> = {};
    for (const s of siswaList) {
      const teks = nominal[s.id] ?? '';
      if (teks.trim() === '') continue;
      const p = parseRupiahKetat(teks);
      if (!p.ok) galatBaris[s.id] = p.alasan;
      else if (p.nilai <= 0) galatBaris[s.id] = 'Nominal harus lebih dari 0';
      else baris.push({ siswa_id: s.id, nominal: p.nilai });
    }
    return { baris, galatBaris, total: baris.reduce((t, b) => t + b.nominal, 0) };
  }, [siswaList, nominal]);

  const adaGalatBaris = Object.keys(hasil.galatBaris).length > 0;
  const bisaSimpan = hasil.baris.length > 0 && !adaGalatBaris && !sibuk && tanggal !== '' && tanggal <= hariIniLokal();

  const pindahBaris = (idx: number, arah: 1 | -1) => {
    const target = siswaList[idx + arah];
    if (target) inputRefs.current[target.id]?.focus();
  };

  const simpan = async () => {
    if (!bisaSimpan) return;
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.transaksiSetorMassal({
      tanggal,
      keterangan: keterangan.trim() || undefined,
      baris: hasil.baris,
    });
    setSibuk(false);
    if (res.ok) {
      setPesan(`Tersimpan: ${res.data.jumlah} setoran, total ${formatRupiah(res.data.total)}.`);
      setNominal({});
      onSaved();
      // Muat ulang agar saldo di tabel mengikuti setoran baru
      if (kelasId !== '') {
        const ulang = await window.pundi.siswaCari('', kelasId, 'aktif');
        if (ulang.ok) setSiswaList(ulang.data);
      }
    } else {
      setGalat(res.pesan);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => (sibuk ? undefined : onClose())} title="Setoran per Kelas" width="760px">
      <div className="pb-kolom">
        <div className="pb-grid pb-grid-170">
          <Field label="Kelas" htmlFor="sm-kelas">
            <select id="sm-kelas" className="ui-input" value={kelasId} onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">-- Pilih --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal setoran" htmlFor="sm-tanggal">
            <input id="sm-tanggal" type="date" className="ui-input" value={tanggal} max={hariIniLokal()} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
          <Field label="Keterangan (opsional)" htmlFor="sm-ket">
            <input id="sm-ket" type="text" className="ui-input" value={keterangan} maxLength={255} onChange={(e) => setKeterangan(e.target.value)} />
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

        {kelasId === '' ? (
          <p className="pb-teks-redup pb-kosong pb-kosong-rapat">
            Pilih kelas, lalu isi nominal setoran tiap siswa. Siswa yang tidak menyetor dikosongkan saja.
          </p>
        ) : siswaList.length === 0 ? (
          <p className="pb-teks-redup pb-kosong pb-kosong-rapat">
            Tidak ada siswa aktif pada kelas ini.
          </p>
        ) : (
          <div className="pb-gulir">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th className="angka">Saldo</th>
                  <th className="pb-kolom-angka">Setoran (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {siswaList.map((s, idx) => (
                  <tr key={s.id}>
                    <td>
                      <div className="pb-nama">{s.nama}</div>
                      <div className="pb-nomor">{s.nomor}</div>
                    </td>
                    <td className="angka">{formatRupiah(s.saldo ?? 0)}</td>
                    <td>
                      <input
                        ref={(el) => {
                          inputRefs.current[s.id] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={`Setoran untuk ${s.nama}`}
                        aria-invalid={hasil.galatBaris[s.id] ? true : undefined}
                        className={hasil.galatBaris[s.id] ? 'ui-input ui-input-error pb-input-angka' : 'ui-input pb-input-angka'}
                        value={nominal[s.id] ?? ''}
                        onChange={(e) => setNominal({ ...nominal, [s.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            pindahBaris(idx, 1);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            pindahBaris(idx, -1);
                          }
                        }}
                      />
                      {hasil.galatBaris[s.id] && (
                        <div className="pb-galat-baris">{hasil.galatBaris[s.id]}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pb-sebar">
          <div className="pb-teks-sedang">
            <strong>{hasil.baris.length}</strong> siswa menyetor, total <strong className="tabular-nums">{formatRupiah(hasil.total)}</strong>
          </div>
          <div className="pb-baris">
            <Button type="button" disabled={sibuk} onClick={onClose}>
              Tutup
            </Button>
            <Button type="button" variant="primary" disabled={!bisaSimpan} onClick={simpan}>
              {sibuk ? 'Menyimpan...' : `Simpan ${hasil.baris.length} Setoran`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
