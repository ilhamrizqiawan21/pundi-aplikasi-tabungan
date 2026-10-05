import { useState, useEffect, useMemo, useRef } from 'react';
import type { Kelas, Siswa } from '../../shared/types.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { Modal } from './Modal.js';
import { tombol, tombolUtama, kolom, labelStyle, sel } from '../styles/ui.js';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          <div>
            <label htmlFor="sm-kelas" style={labelStyle}>Kelas</label>
            <select id="sm-kelas" style={kolom} value={kelasId} onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">-- Pilih --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sm-tanggal" style={labelStyle}>Tanggal setoran</label>
            <input id="sm-tanggal" type="date" style={kolom} value={tanggal} max={hariIniLokal()} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sm-ket" style={labelStyle}>Keterangan (opsional)</label>
            <input id="sm-ket" type="text" style={kolom} value={keterangan} maxLength={255} onChange={(e) => setKeterangan(e.target.value)} />
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

        {kelasId === '' ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
            Pilih kelas, lalu isi nominal setoran tiap siswa. Siswa yang tidak menyetor dikosongkan saja.
          </p>
        ) : siswaList.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
            Tidak ada siswa aktif pada kelas ini.
          </p>
        ) : (
          <div style={{ maxHeight: '44vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                  <th style={sel}>Siswa</th>
                  <th style={{ ...sel, textAlign: 'right' }}>Saldo</th>
                  <th style={{ ...sel, width: '190px' }}>Setoran (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {siswaList.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={sel}>
                      <div style={{ fontWeight: 600 }}>{s.nama}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{s.nomor}</div>
                    </td>
                    <td className="tabular-nums" style={{ ...sel, textAlign: 'right' }}>{formatRupiah(s.saldo ?? 0)}</td>
                    <td style={sel}>
                      <input
                        ref={(el) => {
                          inputRefs.current[s.id] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={`Setoran untuk ${s.nama}`}
                        aria-invalid={hasil.galatBaris[s.id] ? true : undefined}
                        style={{ ...kolom, padding: '6px 10px', textAlign: 'right', borderColor: hasil.galatBaris[s.id] ? 'var(--danger)' : undefined }}
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
                        <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{hasil.galatBaris[s.id]}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13px' }}>
            <strong>{hasil.baris.length}</strong> siswa menyetor, total <strong className="tabular-nums">{formatRupiah(hasil.total)}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={tombol} disabled={sibuk} onClick={onClose}>
              Tutup
            </button>
            <button type="button" style={{ ...tombolUtama, opacity: bisaSimpan ? 1 : 0.5 }} disabled={!bisaSimpan} onClick={simpan}>
              {sibuk ? 'Menyimpan...' : `Simpan ${hasil.baris.length} Setoran`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
