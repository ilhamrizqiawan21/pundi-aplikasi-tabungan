import { useState, useEffect, useCallback } from 'react';
import type { ItemRekapKelas, ItemLaporanSiswa, Kelas, TahunAjaran } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { LaporanTransaksi } from '../components/LaporanTransaksi.js';
import { SlipSaldoPanel } from '../components/SlipSaldoPanel.js';
import { RekapBulananPanel } from '../components/RekapBulananPanel.js';
import { TutupKasPanel } from '../components/TutupKasPanel.js';
import { PratinjauCetakModal } from '../components/PratinjauCetakModal.js';

type TabLaporan = 'kelas' | 'siswa' | 'transaksi' | 'slip' | 'tutupkas' | 'bulanan';

export function LaporanScreen() {
  const [tab, setTab] = useState<TabLaporan>('kelas');
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [selectedTaId, setSelectedTaId] = useState<number | ''>('');
  const [selectedKelasId, setSelectedKelasId] = useState<number | ''>('');

  const [rekapKelas, setRekapKelas] = useState<ItemRekapKelas[]>([]);
  const [rekapSiswa, setRekapSiswa] = useState<ItemLaporanSiswa[]>([]);
  const [loading, setLoading] = useState(false);
  const [pesanEkspor, setPesanEkspor] = useState<{ teks: string; jenis: 'ok' | 'err' } | null>(null);

  const [pratinjauData, setPratinjauData] = useState<{
    html: string;
    judul: string;
    onSimpanPdf?: () => Promise<void>;
  } | null>(null);
  const [cetakLoading, setCetakLoading] = useState(false);

  useEffect(() => {
    window.pundi.tahunAjaranDaftar().then((res) => {
      if (res.ok) {
        setTahunAjaranList(res.data);
        const aktif = res.data.find((ta) => ta.aktif === 1);
        if (aktif) setSelectedTaId(aktif.id);
      }
    });

    window.pundi.kelasDaftar().then((res) => {
      if (res.ok) setKelasList(res.data);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (tab !== 'kelas' && tab !== 'siswa') return; // tab lain memuat datanya sendiri
    setLoading(true);
    try {
      if (tab === 'kelas') {
        const res = await window.pundi.laporanRekapKelas(
          selectedTaId === '' ? undefined : Number(selectedTaId)
        );
        if (res.ok) setRekapKelas(res.data);
      } else {
        const res = await window.pundi.laporanRekapSiswa({
          tahunAjaranId: selectedTaId === '' ? undefined : Number(selectedTaId),
          kelasId: selectedKelasId === '' ? undefined : Number(selectedKelasId),
        });
        if (res.ok) setRekapSiswa(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, selectedTaId, selectedKelasId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePratinjauLaporan = async () => {
    setCetakLoading(true);
    setPesanEkspor(null);
    try {
      if (tab === 'kelas') {
        const res = await window.pundi.cetakLaporanHtml({
          jenis: 'rekapKelas',
          tahunAjaranId: selectedTaId === '' ? undefined : Number(selectedTaId),
        });
        if (res.ok) {
          setPratinjauData({
            html: res.data.html,
            judul: 'Rekap Saldo per Kelas',
            onSimpanPdf: async () => {
              const saveRes = await window.pundi.cetakLaporanPdf({
                jenis: 'rekapKelas',
                tahunAjaranId: selectedTaId === '' ? undefined : Number(selectedTaId),
              });
              if (saveRes.ok && saveRes.data) {
                setPesanEkspor({ teks: `PDF berhasil disimpan: ${saveRes.data.nama_berkas}`, jenis: 'ok' });
              }
            },
          });
        } else {
          setPesanEkspor({ teks: res.pesan || 'Gagal menyiapkan laporan.', jenis: 'err' });
        }
      } else if (tab === 'siswa') {
        const res = await window.pundi.cetakLaporanHtml({
          jenis: 'rekapSiswa',
          tahunAjaranId: selectedTaId === '' ? undefined : Number(selectedTaId),
          kelasId: selectedKelasId === '' ? undefined : Number(selectedKelasId),
        });
        if (res.ok) {
          setPratinjauData({
            html: res.data.html,
            judul: 'Rekap Saldo per Siswa',
            onSimpanPdf: async () => {
              const saveRes = await window.pundi.cetakLaporanPdf({
                jenis: 'rekapSiswa',
                tahunAjaranId: selectedTaId === '' ? undefined : Number(selectedTaId),
                kelasId: selectedKelasId === '' ? undefined : Number(selectedKelasId),
              });
              if (saveRes.ok && saveRes.data) {
                setPesanEkspor({ teks: `PDF berhasil disimpan: ${saveRes.data.nama_berkas}`, jenis: 'ok' });
              }
            },
          });
        } else {
          setPesanEkspor({ teks: res.pesan || 'Gagal menyiapkan laporan.', jenis: 'err' });
        }
      }
    } finally {
      setCetakLoading(false);
    }
  };

  const eksporRekapSiswa = async () => {
    setPesanEkspor(null);
    const res = await window.pundi.laporanEkspor({
      jenis: 'rekapSiswa',
      tahunAjaranId: selectedTaId === '' ? undefined : Number(selectedTaId),
      kelasId: selectedKelasId === '' ? undefined : Number(selectedKelasId),
    });
    if (!res.ok) setPesanEkspor({ teks: res.pesan, jenis: 'err' });
    else if (res.data) setPesanEkspor({ teks: `Laporan disimpan sebagai ${res.data.nama_berkas}.`, jenis: 'ok' });
  };

  // Hitung total agregat untuk footer tabel
  const totalSetoran =
    tab === 'kelas'
      ? rekapKelas.reduce((sum, r) => sum + r.total_setoran, 0)
      : rekapSiswa.reduce((sum, r) => sum + r.total_setoran, 0);

  const totalPenarikan =
    tab === 'kelas'
      ? rekapKelas.reduce((sum, r) => sum + r.total_penarikan, 0)
      : rekapSiswa.reduce((sum, r) => sum + r.total_penarikan, 0);

  const totalSaldo =
    tab === 'kelas'
      ? rekapKelas.reduce((sum, r) => sum + r.total_saldo, 0)
      : rekapSiswa.reduce((sum, r) => sum + r.saldo_akhir, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header, Tab Selector & Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '2px',
          }}
        >
          <button
            onClick={() => setTab('kelas')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: tab === 'kelas' ? 'var(--accent)' : 'transparent',
              color: tab === 'kelas' ? 'var(--accent-text)' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Rekap per Kelas
          </button>
          <button
            onClick={() => setTab('siswa')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: tab === 'siswa' ? 'var(--accent)' : 'transparent',
              color: tab === 'siswa' ? 'var(--accent-text)' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Rekap per Siswa
          </button>
          <button
            onClick={() => setTab('transaksi')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: tab === 'transaksi' ? 'var(--accent)' : 'transparent',
              color: tab === 'transaksi' ? 'var(--accent-text)' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Transaksi
          </button>
          <button
            onClick={() => setTab('bulanan')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: tab === 'bulanan' ? 'var(--accent)' : 'transparent',
              color: tab === 'bulanan' ? 'var(--accent-text)' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Rekap Bulanan
          </button>
          <button
            onClick={() => setTab('slip')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: tab === 'slip' ? 'var(--accent)' : 'transparent',
              color: tab === 'slip' ? 'var(--accent-text)' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Slip Saldo
          </button>
          <button
            onClick={() => setTab('tutupkas')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: tab === 'tutupkas' ? 'var(--accent)' : 'transparent',
              color: tab === 'tutupkas' ? 'var(--accent-text)' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Tutup Kas
          </button>
        </div>

        {/* Filter */}
        {(tab === 'kelas' || tab === 'siswa') && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={selectedTaId}
            onChange={(e) => setSelectedTaId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              fontSize: '13px',
            }}
          >
            <option value="">Semua Tahun Ajaran</option>
            {tahunAjaranList.map((ta) => (
              <option key={ta.id} value={ta.id}>
                T.A. {ta.nama} {ta.aktif ? '(Aktif)' : ''}
              </option>
            ))}
          </select>

          {tab === 'siswa' && (
            <select
              value={selectedKelasId}
              onChange={(e) => setSelectedKelasId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                fontSize: '13px',
              }}
            >
              <option value="">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  Kelas {k.nama}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={fetchData}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Segarkan
          </button>

          <button
            onClick={handlePratinjauLaporan}
            disabled={cetakLoading || loading}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cetakLoading ? 'Menyiapkan...' : 'Cetak / PDF'}
          </button>

          {tab === 'siswa' && (
            <button
              onClick={eksporRekapSiswa}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Ekspor Excel
            </button>
          )}
        </div>
        )}
      </div>

      {pesanEkspor && (
        <div
          role={pesanEkspor.jenis === 'err' ? 'alert' : 'status'}
          style={{
            padding: '10px 14px',
            border: `1px solid ${pesanEkspor.jenis === 'ok' ? 'var(--ok)' : 'var(--danger)'}`,
            color: pesanEkspor.jenis === 'ok' ? 'var(--ok)' : 'var(--danger)',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          {pesanEkspor.teks}
        </div>
      )}

      {tab === 'transaksi' && <LaporanTransaksi kelasList={kelasList} />}
      {tab === 'slip' && <SlipSaldoPanel kelasList={kelasList} />}
      {tab === 'tutupkas' && <TutupKasPanel />}
      {tab === 'bulanan' && <RekapBulananPanel tahunAjaranList={tahunAjaranList} />}

      {/* Tabel Laporan */}
      {(tab === 'kelas' || tab === 'siswa') && (
      <div
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <table className="tabel">
          <thead>
            <tr>
              {tab === 'kelas' ? (
                <>
                  <th>Kelas</th>
                  <th className="tengah">Jumlah Siswa</th>
                  <th className="angka">Total Setoran</th>
                  <th className="angka">Total Penarikan</th>
                  <th className="angka">Total Saldo</th>
                </>
              ) : (
                <>
                  <th>No. Rekening</th>
                  <th>NIS</th>
                  <th>Nama Siswa</th>
                  <th>Kelas</th>
                  <th className="angka">Setoran</th>
                  <th className="angka">Penarikan</th>
                  <th className="angka">Saldo Akhir</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="kosong">
                  Memuat data laporan...
                </td>
              </tr>
            ) : tab === 'kelas' ? (
              rekapKelas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="kosong">
                    Belum ada data kelas pada tahun ajaran ini.
                  </td>
                </tr>
              ) : (
                rekapKelas.map((k) => (
                  <tr key={k.kelas_id}>
                    <td style={{ fontWeight: 600 }}>Kelas {k.kelas_nama}</td>
                    <td className="tengah">{k.jumlah_siswa} siswa</td>
                    <td className="angka" style={{ color: 'var(--ok)' }}>
                      {formatRupiah(k.total_setoran)}
                    </td>
                    <td className="angka" style={{ color: 'var(--danger)' }}>
                      {formatRupiah(k.total_penarikan)}
                    </td>
                    <td className="angka" style={{ fontWeight: 700 }}>
                      {formatRupiah(k.total_saldo)}
                    </td>
                  </tr>
                ))
              )
            ) : rekapSiswa.length === 0 ? (
              <tr>
                <td colSpan={7} className="kosong">
                  Belum ada data siswa.
                </td>
              </tr>
            ) : (
              rekapSiswa.map((s) => (
                <tr key={s.siswa_id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{s.nomor}</td>
                  <td style={{ color: 'var(--muted)' }}>{s.nis || '-'}</td>
                  <td style={{ fontWeight: 500 }}>{s.nama}</td>
                  <td>{s.kelas_nama || '-'}</td>
                  <td className="angka" style={{ color: 'var(--ok)' }}>
                    {formatRupiah(s.total_setoran)}
                  </td>
                  <td className="angka" style={{ color: 'var(--danger)' }}>
                    {formatRupiah(s.total_penarikan)}
                  </td>
                  <td className="angka" style={{ fontWeight: 700 }}>
                    {formatRupiah(s.saldo_akhir)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {/* Footer Total */}
          <tfoot>
            <tr>
              <td colSpan={tab === 'kelas' ? 2 : 4}>
                TOTAL KESELURUHAN
              </td>
              <td className="angka" style={{ color: 'var(--ok)' }}>
                {formatRupiah(totalSetoran)}
              </td>
              <td className="angka" style={{ color: 'var(--danger)' }}>
                {formatRupiah(totalPenarikan)}
              </td>
              <td className="angka" style={{ color: 'var(--accent)', fontSize: '15px' }}>
                {formatRupiah(totalSaldo)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
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
