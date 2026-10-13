import { useEffect, useMemo, useState } from 'react';
import type { RingkasanKasHarian } from '../../shared/types.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { PratinjauCetakModal } from './PratinjauCetakModal.js';
import { Button, Field } from './ui/index.js';
import './panel-bersama.css';

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

  const kelasSelisih = !selisih ? '' : selisih.selisih === 0 ? 'pb-selisih-nol' : 'pb-selisih-beda';
  const ketSelisih = !selisih ? '' : selisih.selisih > 0 ? 'Lebih' : 'Kurang';

  return (
    <section className="ui-card pb-panel" aria-label="Tutup kas harian">
      <p className="pb-teks-redup">
        Di akhir hari, hitung uang tunai di laci lalu bandingkan dengan catatan. Kas yang seharusnya adalah kas awal
        ditambah setoran dan dikurangi penarikan pada tanggal itu.
      </p>
      <div className="pb-grid pb-grid-170">
        <Field label="Tanggal" htmlFor="tk-tanggal">
          <input id="tk-tanggal" type="date" className="ui-input" value={tanggal} max={hariIniLokal()} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
        </Field>
        <Field label="Kas awal di laci (Rp)" htmlFor="tk-awal">
          <input id="tk-awal" type="text" inputMode="numeric" autoComplete="off" className="ui-input" value={kasAwalTeks} placeholder="0" onChange={(e) => setKasAwalTeks(e.target.value)} />
          {!kasAwal.ok && <div className="pb-galat-baris">{kasAwal.alasan}</div>}
        </Field>
        <Field label="Uang fisik hasil hitung (Rp)" htmlFor="tk-fisik">
          <input id="tk-fisik" type="text" inputMode="numeric" autoComplete="off" className="ui-input" value={fisikTeks} onChange={(e) => setFisikTeks(e.target.value)} />
          {!fisik.ok && <div className="pb-galat-baris">{fisik.alasan}</div>}
        </Field>
      </div>

      {kas && (
        <dl className="pb-dl">
          <dt>Setoran</dt>
          <dd className="tabular-nums pb-ok">{formatRupiah(kas.total_setoran)}</dd>
          <dt>Penarikan</dt>
          <dd className="tabular-nums pb-danger">{formatRupiah(kas.total_penarikan)}</dd>
          {kas.total_biaya_adm !== 0 && (
            <>
              <dt className="pb-muted">Biaya administrasi (tidak memengaruhi kas)</dt>
              <dd className="tabular-nums pb-muted">{formatRupiah(kas.total_biaya_adm)}</dd>
            </>
          )}
          <dt>Jumlah transaksi</dt>
          <dd className="tabular-nums">{kas.jumlah_transaksi}</dd>
          <dt className="pb-tebal-besar">Kas seharusnya</dt>
          <dd className="tabular-nums pb-tebal-besar">
            {kasAwal.ok ? formatRupiah(kasAwal.nilai + kas.total_setoran - kas.total_penarikan) : '-'}
          </dd>
        </dl>
      )}

      <div role="status" className={`pb-selisih ${kelasSelisih}`}>
        {selisih
          ? selisih.selisih === 0
            ? 'Kas sesuai. Tidak ada selisih.'
            : `Selisih ${ketSelisih}: ${formatRupiah(Math.abs(selisih.selisih))}`
          : 'Isi uang fisik hasil hitung untuk melihat selisih.'}
      </div>

      {galat && (
        <div role="alert" className="pb-pesan pb-pesan-galat">
          {galat}
        </div>
      )}
      <div>
        <Button type="button" variant="primary" disabled={!bisaCetak} onClick={siapkan}>
          {sibuk ? 'Menyiapkan...' : 'Cetak Berita Acara'}
        </Button>
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
