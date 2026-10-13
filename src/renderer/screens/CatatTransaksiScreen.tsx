import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Siswa, Transaksi, JenisTransaksi, RingkasanKasHarian } from '../../shared/types.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiah } from '../../shared/rupiah.js';
import { PratinjauCetakModal } from '../components/PratinjauCetakModal.js';
import { KoreksiModal } from '../components/KoreksiModal.js';
import { SetoranKelasModal } from '../components/SetoranKelasModal.js';
import { BiayaAdminModal } from '../components/BiayaAdminModal.js';
import { Button } from '../components/ui/index.js';
import { StudentAvatar } from '../components/Icons.js';
import { DaftarSiswaPanel } from './catat/DaftarSiswaPanel.js';
import { FormTransaksi } from './catat/FormTransaksi.js';
import { PanelKanan } from './catat/PanelKanan.js';
import './CatatTransaksiScreen.css';
import './catat/catat-tambahan.css';

export function CatatTransaksiScreen() {
  const [query, setQuery] = useState('');
  const [semuaSiswa, setSemuaSiswa] = useState<Siswa[]>([]);
  const [searchResults, setSearchResults] = useState<Siswa[]>([]);
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Form Transaksi
  const [jenis, setJenis] = useState<JenisTransaksi>('setoran');
  const [nominalRaw, setNominalRaw] = useState('');
  const [tanggal, setTanggal] = useState(() => hariIniLokal());
  const [keterangan, setKeterangan] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Data Kas & Riwayat
  const [kasHariIni, setKasHariIni] = useState<RingkasanKasHarian | null>(null);
  const [riwayatSiswa, setRiwayatSiswa] = useState<Transaksi[]>([]);

  // Konfirmasi Transaksi Terakhir
  const [lastTrx, setLastTrx] = useState<{
    transaksi: Transaksi;
    siswa: Siswa;
  } | null>(null);
  const [koreksiTerbuka, setKoreksiTerbuka] = useState(false);
  const [setoranKelasTerbuka, setSetoranKelasTerbuka] = useState(false);
  const [biayaAdmTerbuka, setBiayaAdmTerbuka] = useState(false);
  const [previewStruk, setPreviewStruk] = useState<{ html: string; nomor_bukti: string } | null>(null);
  const [cetakLoading, setCetakLoading] = useState(false);

  // Refs untuk navigasi keyboard
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nominalInputRef = useRef<HTMLInputElement>(null);

  const muatDataKas = useCallback(async () => {
    if (!window.pundi) return;
    const res = await window.pundi.laporanKasHarian(hariIniLokal());
    if (res.ok) setKasHariIni(res.data);
  }, []);

  const muatSiswaAwal = useCallback(async () => {
    if (!window.pundi) return;
    const res = await window.pundi.siswaCari('', undefined, 'aktif');
    if (res.ok) {
      setSemuaSiswa(res.data);
      setSearchResults(res.data);
    }
  }, []);

  const muatRiwayatSiswa = useCallback(async (siswaId: number) => {
    if (!window.pundi) return;
    const res = await window.pundi.transaksiRiwayat({ siswa_id: siswaId, limit: 8 });
    if (res.ok) setRiwayatSiswa(res.data);
  }, []);

  // Auto focus search input saat pertama dibuka
  useEffect(() => {
    searchInputRef.current?.focus();
    muatDataKas();
    muatSiswaAwal();
  }, [muatDataKas, muatSiswaAwal]);

  const handleCetakStruk = async (trxId: number) => {
    setCetakLoading(true);
    try {
      const res = await window.pundi.cetakStrukHtml(trxId);
      if (res.ok) {
        setPreviewStruk(res.data);
      }
    } finally {
      setCetakLoading(false);
    }
  };

  // Shortcut global Ctrl+K / Ctrl+P / Esc (DESIGN §6)
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        if (lastTrx) {
          e.preventDefault();
          handleCetakStruk(lastTrx.transaksi.id);
        }
      }
      // Esc membatalkan selangkah: dari kartu siswa kembali ke pencarian, lalu mengosongkan pencarian.
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        if (selectedSiswa) {
          e.preventDefault();
          setSelectedSiswa(null);
          setErrorMsg(null);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        } else if (query) {
          e.preventDefault();
          setQuery('');
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastTrx, selectedSiswa, query]);

  // Live search siswa
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(semuaSiswa);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await window.pundi.siswaCari(query, undefined);
      if (res.ok) {
        setSearchResults(res.data);
        setSelectedIndex(0);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query, semuaSiswa]);

  const handleSelectSiswa = (siswa: Siswa) => {
    setSelectedSiswa(siswa);
    setJenis(siswa.status === 'aktif' ? 'setoran' : 'penarikan');
    setQuery('');
    setErrorMsg(null);
    setNominalRaw('');
    setKeterangan('');
    muatRiwayatSiswa(siswa.id);
    setTimeout(() => {
      nominalInputRef.current?.focus();
    }, 50);
  };

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectSiswa(searchResults[selectedIndex]);
      }
    }
  };

  const handleNominalKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key.toLowerCase() === 's' && !nominalRaw) {
      e.preventDefault();
      if (bolehSetor) setJenis('setoran');
    } else if (e.key.toLowerCase() === 't' && !nominalRaw) {
      e.preventDefault();
      setJenis('penarikan');
    }
  };

  const handleAddNominal = (tambah: number) => {
    const cur = parseRupiah(nominalRaw);
    const baru = cur + tambah;
    setNominalRaw(formatRupiah(baru));
    nominalInputRef.current?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSiswa) {
      setErrorMsg('Pilih siswa terlebih dahulu.');
      return;
    }

    const nominal = parseRupiah(nominalRaw);
    if (nominal <= 0) {
      setErrorMsg('Nominal harus lebih dari 0.');
      nominalInputRef.current?.focus();
      return;
    }

    if (jenis === 'setoran' && selectedSiswa.status !== 'aktif') {
      setErrorMsg('Siswa yang sudah lulus atau keluar tidak dapat menyetor.');
      return;
    }

    if (jenis === 'penarikan' && nominal > (selectedSiswa.saldo || 0)) {
      setErrorMsg(`Saldo tidak cukup. Saldo saat ini ${formatRupiah(selectedSiswa.saldo || 0)}.`);
      nominalInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res =
        jenis === 'setoran'
          ? await window.pundi.transaksiSetor({
              siswa_id: selectedSiswa.id,
              nominal,
              tanggal,
              keterangan: keterangan.trim() || undefined,
            })
          : await window.pundi.transaksiTarik({
              siswa_id: selectedSiswa.id,
              nominal,
              tanggal,
              keterangan: keterangan.trim() || undefined,
            });

      if (res.ok) {
        setLastTrx({
          transaksi: res.data,
          siswa: selectedSiswa,
        });

        muatDataKas();
        muatSiswaAwal();

        // Reset form & kembali fokus ke pencarian
        setSelectedSiswa(null);
        setNominalRaw('');
        setKeterangan('');
        setQuery('');
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      } else {
        setErrorMsg(res.pesan);
      }
    } catch {
      setErrorMsg('Gagal menyimpan transaksi. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Setoran hanya untuk siswa aktif; siswa lulus/keluar hanya boleh menarik sisa saldo
  const bolehSetor = !selectedSiswa || selectedSiswa.status === 'aktif';
  const nominalAngka = parseRupiah(nominalRaw);
  const saldoSesudah = selectedSiswa
    ? jenis === 'setoran'
      ? (selectedSiswa.saldo ?? 0) + nominalAngka
      : (selectedSiswa.saldo ?? 0) - nominalAngka
    : 0;

  return (
    <div className="grid-catat">
      <DaftarSiswaPanel
        query={query}
        onQueryChange={setQuery}
        onSearchKeyDown={handleSearchKeyDown}
        searchInputRef={searchInputRef}
        hasil={searchResults}
        indeksFokus={selectedIndex}
        siswaTerpilih={selectedSiswa}
        onPilih={handleSelectSiswa}
        onBukaSetoranKelas={() => setSetoranKelasTerbuka(true)}
        onBukaBiayaAdm={() => setBiayaAdmTerbuka(true)}
      />

      <section className="catat-tengah">
        {lastTrx && (
          <div className="catat-notif-sukses">
            <div>
              <div className="catat-notif-teks">
                {lastTrx.transaksi.jenis === 'setoran' ? 'Setoran' : 'Penarikan'}{' '}
                {formatRupiah(Math.abs(lastTrx.transaksi.nilai))} untuk {lastTrx.siswa.nama} berhasil tersimpan.
              </div>
              <div className="catat-notif-sub">
                No. Bukti: <strong>{lastTrx.transaksi.nomor_bukti}</strong> | Saldo baru:{' '}
                <strong>{formatRupiah(lastTrx.transaksi.saldo_setelah)}</strong>
              </div>
            </div>
            <div className="catat-notif-aksi">
              <Button
                size="sm"
                onClick={() => handleCetakStruk(lastTrx.transaksi.id)}
                disabled={cetakLoading}
                title="Cetak struk transaksi terakhir (Ctrl+P)"
              >
                {cetakLoading ? 'Memuat...' : 'Cetak Struk (Ctrl+P)'}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setKoreksiTerbuka(true)}>
                Batalkan (Koreksi)
              </Button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="catat-error">
            <span>{errorMsg}</span>
          </div>
        )}

        {selectedSiswa ? (
          <div className="catat-hero-siswa">
            <div className="catat-hero-identitas">
              <StudentAvatar name={selectedSiswa.nama} size={52} fontSize={18} border="2px solid rgba(255, 255, 255, 0.3)" />
              <div>
                <h2 className="catat-hero-nama">{selectedSiswa.nama}</h2>
                <div className="catat-hero-chips">
                  {selectedSiswa.kelas_nama && <span className="catat-hero-chip">Kelas {selectedSiswa.kelas_nama}</span>}
                  <span className="catat-hero-chip">{selectedSiswa.nomor}</span>
                </div>
              </div>
            </div>

            <div className="catat-hero-saldo">
              <div className="catat-hero-saldo-label">SALDO SAAT INI</div>
              <div className="catat-hero-saldo-nilai tabular-nums">{formatRupiah(selectedSiswa.saldo ?? 0)}</div>
            </div>
          </div>
        ) : (
          <div className="catat-kosong">
            <div className="catat-kosong-judul">Belum ada siswa yang dipilih</div>
            <p className="catat-kosong-sub">
              Cari nama atau nomor rekening di sebelah kiri, atau tekan <kbd className="catat-kbd">Ctrl + K</kbd>
            </p>
          </div>
        )}

        <FormTransaksi
          jenis={jenis}
          onJenisChange={setJenis}
          bolehSetor={bolehSetor}
          nominalRaw={nominalRaw}
          onNominalChange={setNominalRaw}
          onNominalKeyDown={handleNominalKeyDown}
          onTambahNominal={handleAddNominal}
          nominalInputRef={nominalInputRef}
          tanggal={tanggal}
          onTanggalChange={setTanggal}
          keterangan={keterangan}
          onKeteranganChange={setKeterangan}
          saldoSesudah={saldoSesudah}
          sedangMenyimpan={loading}
          adaSiswa={Boolean(selectedSiswa)}
          onGantiSiswa={() => {
            setSelectedSiswa(null);
            setErrorMsg(null);
            setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          onSubmit={handleSubmit}
        />
      </section>

      <PanelKanan kasHariIni={kasHariIni} siswaTerpilih={selectedSiswa} riwayat={riwayatSiswa} />

      {/* Modal Koreksi: alasan wajib dari pengguna (CAP-07) */}
      <KoreksiModal
        isOpen={koreksiTerbuka && Boolean(lastTrx)}
        transaksi={lastTrx?.transaksi ?? null}
        onClose={() => setKoreksiTerbuka(false)}
        onSuccess={() => {
          setLastTrx(null);
          muatDataKas();
          muatSiswaAwal();
        }}
      />

      {/* Setoran massal satu kelas (CAP-19) */}
      <SetoranKelasModal
        isOpen={setoranKelasTerbuka}
        onClose={() => setSetoranKelasTerbuka(false)}
        onSaved={() => {
          muatDataKas();
          muatSiswaAwal();
        }}
      />

      {/* Biaya administrasi satu kelas (CAP-08) */}
      <BiayaAdminModal
        isOpen={biayaAdmTerbuka}
        onClose={() => setBiayaAdmTerbuka(false)}
        onSaved={() => {
          muatDataKas();
          muatSiswaAwal();
        }}
      />

      {/* Modal Pratinjau Cetak Struk */}
      {previewStruk && (
        <PratinjauCetakModal
          terbuka={Boolean(previewStruk)}
          html={previewStruk.html}
          judul={`Struk ${previewStruk.nomor_bukti}`}
          potret
          onTutup={() => setPreviewStruk(null)}
        />
      )}
    </div>
  );
}
