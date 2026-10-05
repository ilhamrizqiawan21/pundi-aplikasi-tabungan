import { useEffect, useMemo, useState } from 'react';
import type { RingkasanKasHarian } from '../../shared/types.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { PratinjauCetakModal } from './PratinjauCetakModal.js';
import { tombolUtama, kolom, labelStyle, kartu } from '../styles/ui.js';

/** CAP-20: hitung kas yang seharusnya di laci dan bandingkan dengan uang fisik, lalu cetak berita acara. */
export function TutupKasPanel() {
  const [tanggal, setTanggal] = useState(() => hariIniLokal());
  const [kas, setKas] = useState<RingkasanKasHarian | null>(null);
  const [kasAwalTeks, setKasAwalTeks] = useState('');
  const [fisikTeks, setFisikTeks] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pratinjau, setPratinjau] = useState<{ html: string; judul: string } | null>(null);

  useEffect(() => {
    window.pundi.laporanKasHarian(tanggal).then((res) => {
      if (res.ok) {
        setKas(res.data);
        setGalat(null);
      } else {
        setGalat(res.pesan);
      }
    });
  }, [tanggal]);

  const kasAwal = parseRupiahKetat(kasAwalTeks);
  const fisik = parseRupiahKetat(fisikTeks);
  const fisikDiisi = fisikTeks.trim() !== '';

  const selisih = useMemo(() => {
    if (!kas || !kasAwal.ok || !fisik.ok || !fisikDiisi) return null;
    const seharusnya = kasAwal.nilai + kas.total_setoran - kas.total_penarikan;
    return { seharusnya, selisih: fisik.nilai - seharusnya };
  }, [kas, kasAwal, fisik, fisikDiisi]);

  const bisaCetak = !!selisih && !sibuk;

  const siapkan = async () => {
    if (!kasAwal.ok || !fisik.ok) return;
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.cetakLaporanHtml({ jenis: 'tutupKas', tanggal, kasAwal: kasAwal.nilai, uangFisik: fisik.nilai });
    setSibuk(false);
    if (res.ok) setPratinjau(res.data);
    else setGalat(res.pesan);
  };

  const warna = !selisih ? 'var(--muted)' : selisih.selisih === 0 ? 'var(--ok)' : 'var(--danger)';
  const ketSelisih = !selisih ? '' : selisih.selisih > 0 ? 'Lebih' : 'Kurang';

  return (
    <section style={{ ...kartu, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '620px' }} aria-label="Tutup kas harian">
      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
        Di akhir hari, hitung uang tunai di laci lalu bandingkan dengan catatan. Kas yang seharusnya adalah kas awal
        ditambah setoran dan dikurangi penarikan pada tanggal itu.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <div>
          <label htmlFor="tk-tanggal" style={labelStyle}>Tanggal</label>
          <input id="tk-tanggal" type="date" style={kolom} value={tanggal} max={hariIniLokal()} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tk-awal" style={labelStyle}>Kas awal di laci (Rp)</label>
          <input id="tk-awal" type="text" inputMode="numeric" autoComplete="off" style={kolom} value={kasAwalTeks} placeholder="0" onChange={(e) => setKasAwalTeks(e.target.value)} />
          {!kasAwal.ok && <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{kasAwal.alasan}</div>}
        </div>
        <div>
          <label htmlFor="tk-fisik" style={labelStyle}>Uang fisik hasil hitung (Rp)</label>
          <input id="tk-fisik" type="text" inputMode="numeric" autoComplete="off" style={kolom} value={fisikTeks} onChange={(e) => setFisikTeks(e.target.value)} />
          {!fisik.ok && <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{fisik.alasan}</div>}
        </div>
      </div>

      {kas && (
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', fontSize: '13px', margin: 0 }}>
          <dt>Setoran</dt>
          <dd className="tabular-nums" style={{ margin: 0, textAlign: 'right', color: 'var(--ok)' }}>{formatRupiah(kas.total_setoran)}</dd>
          <dt>Penarikan</dt>
          <dd className="tabular-nums" style={{ margin: 0, textAlign: 'right', color: 'var(--danger)' }}>{formatRupiah(kas.total_penarikan)}</dd>
          {kas.total_biaya_adm !== 0 && (
            <>
              <dt style={{ color: 'var(--muted)' }}>Biaya administrasi (tidak memengaruhi kas)</dt>
              <dd className="tabular-nums" style={{ margin: 0, textAlign: 'right', color: 'var(--muted)' }}>{formatRupiah(kas.total_biaya_adm)}</dd>
            </>
          )}
          <dt>Jumlah transaksi</dt>
          <dd className="tabular-nums" style={{ margin: 0, textAlign: 'right' }}>{kas.jumlah_transaksi}</dd>
          <dt style={{ fontWeight: 700 }}>Kas seharusnya</dt>
          <dd className="tabular-nums" style={{ margin: 0, textAlign: 'right', fontWeight: 700 }}>
            {kasAwal.ok ? formatRupiah(kasAwal.nilai + kas.total_setoran - kas.total_penarikan) : '-'}
          </dd>
        </dl>
      )}

      <div role="status" style={{ padding: '12px 14px', borderRadius: '10px', border: `1px solid ${warna}`, color: warna, fontSize: '14px', fontWeight: 700 }}>
        {selisih
          ? selisih.selisih === 0
            ? 'Kas sesuai. Tidak ada selisih.'
            : `Selisih ${ketSelisih}: ${formatRupiah(Math.abs(selisih.selisih))}`
          : 'Isi uang fisik hasil hitung untuk melihat selisih.'}
      </div>

      {galat && (
        <div role="alert" style={{ padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', fontSize: '13px' }}>
          {galat}
        </div>
      )}
      <div>
        <button type="button" style={{ ...tombolUtama, opacity: bisaCetak ? 1 : 0.5 }} disabled={!bisaCetak} onClick={siapkan}>
          {sibuk ? 'Menyiapkan...' : 'Cetak Berita Acara'}
        </button>
      </div>

      {pratinjau && (
        <PratinjauCetakModal
          terbuka
          judul="Berita Acara Kas Harian"
          html={pratinjau.html}
          onTutup={() => setPratinjau(null)}
          onSimpanPdf={async () => {
            if (!kasAwal.ok || !fisik.ok) return;
            await window.pundi.cetakLaporanPdf({ jenis: 'tutupKas', tanggal, kasAwal: kasAwal.nilai, uangFisik: fisik.nilai });
          }}
        />
      )}
    </section>
  );
}
