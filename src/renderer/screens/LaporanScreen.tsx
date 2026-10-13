import { useState, useEffect, useCallback } from 'react';
import type { ItemRekapKelas, ItemLaporanSiswa, Kelas, TahunAjaran } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { LaporanTransaksi } from '../components/LaporanTransaksi.js';
import { SlipSaldoPanel } from '../components/SlipSaldoPanel.js';
import { RekapBulananPanel } from '../components/RekapBulananPanel.js';
import { TutupKasPanel } from '../components/TutupKasPanel.js';
import { PratinjauCetakModal } from '../components/PratinjauCetakModal.js';
import {
  Card,
  Button,
} from '../components/ui/index.js';
import './LaporanScreen.css';

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
    <div className="laporan-container">
      {/* Header, Tab Selector & Filter Bar */}
      <div className="laporan-header-bar">
        {/* Tab Selector */}
        <div className="laporan-tabs">
          <button
            onClick={() => setTab('kelas')}
            className={`laporan-tab-btn ${tab === 'kelas' ? 'active' : ''}`}
          >
            Rekap per Kelas
          </button>
          <button
            onClick={() => setTab('siswa')}
            className={`laporan-tab-btn ${tab === 'siswa' ? 'active' : ''}`}
          >
            Rekap per Siswa
          </button>
          <button
            onClick={() => setTab('transaksi')}
            className={`laporan-tab-btn ${tab === 'transaksi' ? 'active' : ''}`}
          >
            Transaksi
          </button>
          <button
            onClick={() => setTab('bulanan')}
            className={`laporan-tab-btn ${tab === 'bulanan' ? 'active' : ''}`}
          >
            Rekap Bulanan
          </button>
          <button
            onClick={() => setTab('slip')}
            className={`laporan-tab-btn ${tab === 'slip' ? 'active' : ''}`}
          >
            Slip Saldo
          </button>
          <button
            onClick={() => setTab('tutupkas')}
            className={`laporan-tab-btn ${tab === 'tutupkas' ? 'active' : ''}`}
          >
            Tutup Kas
          </button>
        </div>

        {/* Filter */}
        {(tab === 'kelas' || tab === 'siswa') && (
          <div className="laporan-filter-bar">
            <select
              value={selectedTaId}
              onChange={(e) => setSelectedTaId(e.target.value === '' ? '' : Number(e.target.value))}
              className="laporan-select"
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
                className="laporan-select"
              >
                <option value="">Semua Kelas</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    Kelas {k.nama}
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
            >
              Segarkan
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePratinjauLaporan}
              disabled={cetakLoading || loading}
            >
              {cetakLoading ? 'Menyiapkan...' : 'Cetak / PDF'}
            </Button>

            {tab === 'siswa' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={eksporRekapSiswa}
              >
                Ekspor Excel
              </Button>
            )}
          </div>
        )}
      </div>

      {pesanEkspor && (
        <div
          role={pesanEkspor.jenis === 'err' ? 'alert' : 'status'}
          className={`laporan-notif-ekspor ${pesanEkspor.jenis}`}
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
        <Card className="laporan-tabel-kartu">
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
                      <td className="lap-semibold">Kelas {k.kelas_nama}</td>
                      <td className="tengah">{k.jumlah_siswa} siswa</td>
                      <td className="angka lap-ok">
                        {formatRupiah(k.total_setoran)}
                      </td>
                      <td className="angka lap-danger">
                        {formatRupiah(k.total_penarikan)}
                      </td>
                      <td className="angka lap-bold">
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
                    <td className="lap-nomor">{s.nomor}</td>
                    <td className="lap-muted">{s.nis || '-'}</td>
                    <td className="lap-medium">{s.nama}</td>
                    <td>{s.kelas_nama || '-'}</td>
                    <td className="angka lap-ok">
                      {formatRupiah(s.total_setoran)}
                    </td>
                    <td className="angka lap-danger">
                      {formatRupiah(s.total_penarikan)}
                    </td>
                    <td className="angka lap-bold">
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
                <td className="angka lap-ok">
                  {formatRupiah(totalSetoran)}
                </td>
                <td className="angka lap-danger">
                  {formatRupiah(totalPenarikan)}
                </td>
                <td className="angka lap-total-saldo">
                  {formatRupiah(totalSaldo)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
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
