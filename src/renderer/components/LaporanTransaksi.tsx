import { useState, useEffect, useCallback } from 'react';
import type { HasilLaporanTransaksi, JenisTransaksi, Kelas } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { Button, Field } from './ui/index.js';
import { PratinjauCetakModal } from './PratinjauCetakModal.js';
import './panel-bersama.css';

const LABEL_JENIS: Record<JenisTransaksi, string> = {
  setoran: 'Setoran',
  penarikan: 'Penarikan',
  biaya_adm: 'Biaya administrasi',
  pembalik: 'Koreksi',
  saldo_awal: 'Saldo awal',
};

function awalBulan(): string {
  return `${hariIniLokal().slice(0, 8)}01`;
}

export function LaporanTransaksi({ kelasList }: { kelasList: Kelas[] }) {
  const [dari, setDari] = useState(hariIniLokal());
  const [sampai, setSampai] = useState(hariIniLokal());
  const [jenis, setJenis] = useState<JenisTransaksi | ''>('');
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [hasil, setHasil] = useState<HasilLaporanTransaksi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [pratinjauData, setPratinjauData] = useState<{
    html: string;
    judul: string;
    onSimpanPdf?: () => Promise<void>;
  } | null>(null);
  const [cetakLoading, setCetakLoading] = useState(false);

  const muat = useCallback(async () => {
    setPesan(null);
    if (sampai < dari) {
      setGalat('Tanggal akhir tidak boleh sebelum tanggal awal.');
      setHasil(null);
      return;
    }
    const res = await window.pundi.laporanTransaksi({
      dari,
      sampai,
      jenis: jenis === '' ? undefined : jenis,
      kelasId: kelasId === '' ? undefined : kelasId,
    });
    if (res.ok) {
      setGalat(null);
      setHasil(res.data);
    } else {
      setGalat(res.pesan);
      setHasil(null);
    }
  }, [dari, sampai, jenis, kelasId]);

  useEffect(() => {
    muat();
  }, [muat]);

  const handleCetakTransaksi = async () => {
    setCetakLoading(true);
    setPesan(null);
    try {
      const res = await window.pundi.cetakLaporanHtml({
        jenis: 'transaksi',
        dari,
        sampai,
        kelasId: kelasId === '' ? undefined : kelasId,
        jenisTransaksi: jenis === '' ? undefined : jenis,
      });
      if (res.ok) {
        setPratinjauData({
          html: res.data.html,
          judul: `Laporan Transaksi ${dari} s/d ${sampai}`,
          onSimpanPdf: async () => {
            const saveRes = await window.pundi.cetakLaporanPdf({
              jenis: 'transaksi',
              dari,
              sampai,
              kelasId: kelasId === '' ? undefined : kelasId,
              jenisTransaksi: jenis === '' ? undefined : jenis,
            });
            if (saveRes.ok && saveRes.data) {
              setPesan(`PDF berhasil disimpan: ${saveRes.data.nama_berkas}`);
            }
          },
        });
      } else {
        setGalat(res.pesan || 'Gagal menyiapkan laporan transaksi.');
      }
    } finally {
      setCetakLoading(false);
    }
  };

  const ekspor = async () => {
    setPesan(null);
    const res = await window.pundi.laporanEkspor({
      jenis: 'transaksi',
      dari,
      sampai,
      kelasId: kelasId === '' ? undefined : kelasId,
      jenisTransaksi: jenis === '' ? undefined : jenis,
    });
    if (!res.ok) setGalat(res.pesan);
    else if (res.data) setPesan(`Laporan disimpan sebagai ${res.data.nama_berkas}.`);
  };

  return (
    <div className="pb-kolom-sedang">
      <section aria-label="Saring transaksi" className="ui-card pb-grid pb-grid-150 pb-saring">
        <Field label="Dari tanggal" htmlFor="lt-dari">
          <input id="lt-dari" type="date" className="ui-input" value={dari} onChange={(e) => setDari(e.target.value)} />
        </Field>
        <Field label="Sampai tanggal" htmlFor="lt-sampai">
          <input id="lt-sampai" type="date" className="ui-input" value={sampai} onChange={(e) => setSampai(e.target.value)} />
        </Field>
        <Field label="Jenis" htmlFor="lt-jenis">
          <select id="lt-jenis" className="ui-input" value={jenis} onChange={(e) => setJenis(e.target.value as JenisTransaksi | '')}>
            <option value="">Semua jenis</option>
            <option value="setoran">Setoran</option>
            <option value="penarikan">Penarikan</option>
            <option value="pembalik">Koreksi</option>
          </select>
        </Field>
        <Field label="Kelas" htmlFor="lt-kelas">
          <select id="lt-kelas" className="ui-input" value={kelasId} onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama} ({k.tahun_ajaran_nama})
              </option>
            ))}
          </select>
        </Field>
        <div className="pb-baris-bungkus">
          <Button type="button" onClick={() => { setDari(hariIniLokal()); setSampai(hariIniLokal()); }}>
            Hari ini
          </Button>
          <Button type="button" onClick={() => { setDari(awalBulan()); setSampai(hariIniLokal()); }}>
            Bulan ini
          </Button>
        </div>
      </section>

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

      {hasil && (
        <>
          <div className="pb-grid">
            <Ringkas judul="Jumlah transaksi" nilai={`${hasil.jumlah.toLocaleString('id-ID')} transaksi`} />
            <Ringkas judul="Total masuk" nilai={formatRupiah(hasil.total_masuk)} warna="pb-ok" />
            <Ringkas judul="Total keluar" nilai={formatRupiah(hasil.total_keluar)} warna="pb-danger" />
            <Ringkas judul="Selisih bersih" nilai={formatRupiah(hasil.total_masuk - hasil.total_keluar)} />
          </div>

          <section className="ui-card" aria-label="Daftar transaksi">
            <div className="pb-bar-tabel">
              <span className="pb-teks-redup">
                {hasil.terpotong
                  ? `Menampilkan ${hasil.baris.length.toLocaleString('id-ID')} dari ${hasil.jumlah.toLocaleString('id-ID')} transaksi. Ekspor ke Excel untuk semuanya.`
                  : 'Urut dari tanggal terlama.'}
              </span>
              <div className="pb-baris">
                <Button type="button" onClick={handleCetakTransaksi} disabled={hasil.jumlah === 0 || cetakLoading}>
                  {cetakLoading ? 'Menyiapkan...' : 'Cetak / PDF'}
                </Button>
                <Button type="button" onClick={ekspor} disabled={hasil.jumlah === 0}>
                  Ekspor Excel
                </Button>
              </div>
            </div>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>No. Bukti</th>
                  <th>Siswa</th>
                  <th>Kelas</th>
                  <th>Jenis</th>
                  <th className="angka">Nilai</th>
                  <th className="angka">Saldo Setelah</th>
                </tr>
              </thead>
              <tbody>
                {hasil.baris.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="kosong">
                      Tidak ada transaksi pada rentang tanggal ini.
                    </td>
                  </tr>
                ) : (
                  hasil.baris.map((t) => (
                    <tr key={t.id}>
                      <td>{t.tanggal}</td>
                      <td>{t.nomor_bukti}</td>
                      <td>
                        <div className="pb-nama">{t.siswa_nama}</div>
                        <div className="pb-nomor">
                          {t.siswa_nomor}
                          {t.keterangan ? ` • ${t.keterangan}` : ''}
                        </div>
                      </td>
                      <td>{t.kelas_nama ?? '-'}</td>
                      <td>{LABEL_JENIS[t.jenis]}</td>
                      <td className={`angka pb-tebal ${t.nilai >= 0 ? 'pb-ok' : 'pb-danger'}`}>
                        {t.nilai > 0 ? '+' : ''}
                        {formatRupiah(t.nilai)}
                      </td>
                      <td className="angka">{formatRupiah(t.saldo_setelah)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* Pratinjau Cetak / PDF Modal */}
      {pratinjauData && (
        <PratinjauCetakModal
          terbuka={Boolean(pratinjauData)}
          judul={pratinjauData.judul}
          html={pratinjauData.html}
          onTutup={() => setPratinjauData(null)}
          onSimpanPdf={pratinjauData.onSimpanPdf}
        />
      )}
    </div>
  );
}

/** `warna` adalah nama kelas warna (mis. pb-ok); tanpa itu nilai memakai warna teks biasa. */
function Ringkas({ judul, nilai, warna }: { judul: string; nilai: string; warna?: string }) {
  return (
    <div className="ui-card pb-ringkas">
      <div className="pb-ringkas-judul">{judul}</div>
      <div className={`tabular-nums pb-ringkas-nilai ${warna ?? ''}`}>
        {nilai}
      </div>
    </div>
  );
}
