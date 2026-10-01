import { useState, useEffect, useCallback } from 'react';
import type { HasilLaporanTransaksi, JenisTransaksi, Kelas } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { tombol, kolom, labelStyle, kartu, sel } from '../styles/ui.js';
import { PratinjauCetakModal } from './PratinjauCetakModal.js';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section
        aria-label="Saring transaksi"
        style={{ ...kartu, padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', alignItems: 'end' }}
      >
        <div>
          <label htmlFor="lt-dari" style={labelStyle}>Dari tanggal</label>
          <input id="lt-dari" type="date" style={kolom} value={dari} onChange={(e) => setDari(e.target.value)} />
        </div>
        <div>
          <label htmlFor="lt-sampai" style={labelStyle}>Sampai tanggal</label>
          <input id="lt-sampai" type="date" style={kolom} value={sampai} onChange={(e) => setSampai(e.target.value)} />
        </div>
        <div>
          <label htmlFor="lt-jenis" style={labelStyle}>Jenis</label>
          <select id="lt-jenis" style={kolom} value={jenis} onChange={(e) => setJenis(e.target.value as JenisTransaksi | '')}>
            <option value="">Semua jenis</option>
            <option value="setoran">Setoran</option>
            <option value="penarikan">Penarikan</option>
            <option value="pembalik">Koreksi</option>
          </select>
        </div>
        <div>
          <label htmlFor="lt-kelas" style={labelStyle}>Kelas</label>
          <select id="lt-kelas" style={kolom} value={kelasId} onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama} ({k.tahun_ajaran_nama})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" style={tombol} onClick={() => { setDari(hariIniLokal()); setSampai(hariIniLokal()); }}>
            Hari ini
          </button>
          <button type="button" style={tombol} onClick={() => { setDari(awalBulan()); setSampai(hariIniLokal()); }}>
            Bulan ini
          </button>
        </div>
      </section>

      {galat && (
        <div role="alert" style={{ padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', fontSize: '13px' }}>
          {galat}
        </div>
      )}
      {pesan && (
        <div role="status" style={{ padding: '10px 14px', border: '1px solid var(--ok)', color: 'var(--ok)', borderRadius: '6px', fontSize: '13px' }}>
          {pesan}
        </div>
      )}

      {hasil && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <Ringkas judul="Jumlah transaksi" nilai={`${hasil.jumlah.toLocaleString('id-ID')} transaksi`} />
            <Ringkas judul="Total masuk" nilai={formatRupiah(hasil.total_masuk)} warna="var(--ok)" />
            <Ringkas judul="Total keluar" nilai={formatRupiah(hasil.total_keluar)} warna="var(--danger)" />
            <Ringkas judul="Selisih bersih" nilai={formatRupiah(hasil.total_masuk - hasil.total_keluar)} />
          </div>

          <section style={kartu} aria-label="Daftar transaksi">
            <div style={{ padding: '10px 16px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {hasil.terpotong
                  ? `Menampilkan ${hasil.baris.length.toLocaleString('id-ID')} dari ${hasil.jumlah.toLocaleString('id-ID')} transaksi. Ekspor ke Excel untuk semuanya.`
                  : 'Urut dari tanggal terlama.'}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  style={{ ...tombol, padding: '7px 14px', fontSize: '13px', fontWeight: 600 }}
                  onClick={handleCetakTransaksi}
                  disabled={hasil.jumlah === 0 || cetakLoading}
                >
                  {cetakLoading ? 'Menyiapkan...' : '🖨️ Cetak / PDF'}
                </button>
                <button
                  type="button"
                  style={{ ...tombol, padding: '7px 14px', fontSize: '13px' }}
                  onClick={ekspor}
                  disabled={hasil.jumlah === 0}
                >
                  Ekspor Excel
                </button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={sel}>Tanggal</th>
                  <th style={sel}>No. Bukti</th>
                  <th style={sel}>Siswa</th>
                  <th style={sel}>Kelas</th>
                  <th style={sel}>Jenis</th>
                  <th style={{ ...sel, textAlign: 'right' }}>Nilai</th>
                  <th style={{ ...sel, textAlign: 'right' }}>Saldo Setelah</th>
                </tr>
              </thead>
              <tbody>
                {hasil.baris.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...sel, padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      Tidak ada transaksi pada rentang tanggal ini.
                    </td>
                  </tr>
                ) : (
                  hasil.baris.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={sel}>{t.tanggal}</td>
                      <td style={sel}>{t.nomor_bukti}</td>
                      <td style={sel}>
                        <div style={{ fontWeight: 600 }}>{t.siswa_nama}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {t.siswa_nomor}
                          {t.keterangan ? ` • ${t.keterangan}` : ''}
                        </div>
                      </td>
                      <td style={sel}>{t.kelas_nama ?? '-'}</td>
                      <td style={sel}>{LABEL_JENIS[t.jenis]}</td>
                      <td className="tabular-nums" style={{ ...sel, textAlign: 'right', color: t.nilai >= 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 600 }}>
                        {t.nilai > 0 ? '+' : ''}
                        {formatRupiah(t.nilai)}
                      </td>
                      <td className="tabular-nums" style={{ ...sel, textAlign: 'right' }}>{formatRupiah(t.saldo_setelah)}</td>
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

function Ringkas({ judul, nilai, warna }: { judul: string; nilai: string; warna?: string }) {
  return (
    <div style={{ ...kartu, padding: '12px 16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{judul}</div>
      <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 700, color: warna ?? 'var(--text)', marginTop: '2px' }}>
        {nilai}
      </div>
    </div>
  );
}
