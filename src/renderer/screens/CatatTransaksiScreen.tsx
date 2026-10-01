import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Siswa, Transaksi, JenisTransaksi, RingkasanKasHarian } from '../../shared/types.js';
import { hariIniLokal, formatTanggalIndonesia } from '../../shared/tanggal.js';
import { formatRupiah, parseRupiah } from '../../shared/rupiah.js';
import { PratinjauCetakModal } from '../components/PratinjauCetakModal.js';
import {
  StudentAvatar,
  IconSearch,
  IconCalendar,
  IconCheck,
} from '../components/Icons.js';

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
  const [koreksiLoading, setKoreksiLoading] = useState(false);
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
      const res = await window.pundi.siswaCari(query, undefined, 'aktif');
      if (res.ok) {
        setSearchResults(res.data);
        setSelectedIndex(0);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query, semuaSiswa]);

  const handleSelectSiswa = (siswa: Siswa) => {
    setSelectedSiswa(siswa);
    setJenis('setoran');
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
      setJenis('setoran');
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

  const handleKoreksiTerakhir = async () => {
    if (!lastTrx) return;
    if (confirm(`Apakah Anda yakin ingin membatalkan transaksi ${lastTrx.transaksi.nomor_bukti}?`)) {
      setKoreksiLoading(true);
      try {
        const res = await window.pundi.transaksiBalik({
          transaksi_id: lastTrx.transaksi.id,
          alasan: 'Koreksi langsung dari layar Catat Transaksi',
        });
        if (res.ok) {
          alert('Transaksi berhasil dibatalkan (dibuat transaksi pembalik).');
          setLastTrx(null);
          muatDataKas();
          muatSiswaAwal();
        } else {
          alert(`Gagal membatalkan transaksi: ${res.pesan}`);
        }
      } finally {
        setKoreksiLoading(false);
      }
    }
  };

  const nominalAngka = parseRupiah(nominalRaw);
  const saldoSesudah = selectedSiswa
    ? jenis === 'setoran'
      ? (selectedSiswa.saldo ?? 0) + nominalAngka
      : (selectedSiswa.saldo ?? 0) - nominalAngka
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(420px, 1fr) 300px', gap: '22px', alignItems: 'start' }}>
      {/* ======================================================== */}
      {/* KOLOM KIRI: PILIH SISWA (Mockup Page 1)                    */}
      {/* ======================================================== */}
      <section
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
          padding: '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Pilih siswa</h3>
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
            {searchResults.length} siswa
          </span>
        </div>

        {/* Input Pencarian */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
            <IconSearch width={15} height={15} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Ketik nama siswa, nomor rekening (T-...), atau NIS..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              fontSize: '13px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
          />
        </div>

        {/* Daftar Siswa */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Daftar Siswa"
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            paddingRight: '2px',
          }}
        >
          {searchResults.map((s, idx) => {
            const isSelected = selectedSiswa?.id === s.id;
            const isFocused = idx === selectedIndex && !selectedSiswa;
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectSiswa(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectSiswa(s);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  backgroundColor: isSelected
                    ? 'rgba(37, 99, 235, 0.08)'
                    : isFocused
                    ? 'rgba(0, 0, 0, 0.04)'
                    : 'transparent',
                  border: isSelected
                    ? '1.5px solid var(--accent)'
                    : '1.5px solid transparent',
                  transition: 'all 0.12s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <StudentAvatar name={s.nama} size={32} fontSize={11} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.nama}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                      {s.kelas_nama ? `${s.kelas_nama} · ` : ''}{s.nomor}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                  {formatRupiah(s.saldo ?? 0)}
                </div>
              </div>
            );
          })}

          {searchResults.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              Tidak ada siswa yang cocok
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* KOLOM TENGAH: RUANG KERJA TRANSAKSI (Mockup Page 1)        */}
      {/* ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Banner Konfirmasi Transaksi Terakhir (Wajib untuk Playwright) */}
        {lastTrx && (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'var(--ok-bg)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.08)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ok-text)', fontSize: '13px' }}>
                ✓ {lastTrx.transaksi.jenis === 'setoran' ? 'Setoran' : 'Penarikan'}{' '}
                {formatRupiah(Math.abs(lastTrx.transaksi.nilai))} untuk {lastTrx.siswa.nama} berhasil tersimpan.
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                No. Bukti: <strong>{lastTrx.transaksi.nomor_bukti}</strong> | Saldo baru:{' '}
                <strong>{formatRupiah(lastTrx.transaksi.saldo_setelah)}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleCetakStruk(lastTrx.transaksi.id)}
                disabled={cetakLoading}
                title="Cetak struk transaksi terakhir (Ctrl+P)"
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                {cetakLoading ? 'Memuat...' : '🖨️ Cetak Struk (Ctrl+P)'}
              </button>
              <button
                onClick={handleKoreksiTerakhir}
                disabled={koreksiLoading}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {koreksiLoading ? 'Membatalkan...' : 'Batalkan (Koreksi)'}
              </button>
            </div>
          </div>
        )}

        {/* Pesan Kesalahan */}
        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              color: 'var(--danger-text)',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Hero Banner Siswa Terpilih (Sesuai Mockup Biru Royal) */}
        {selectedSiswa ? (
          <div
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              borderRadius: '18px',
              padding: '22px 26px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <StudentAvatar name={selectedSiswa.nama} size={52} fontSize={18} border="2px solid rgba(255, 255, 255, 0.3)" />
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', margin: 0 }}>
                  {selectedSiswa.nama}
                </h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {selectedSiswa.kelas_nama && (
                    <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: '2px 8px', borderRadius: '6px' }}>
                      Kelas {selectedSiswa.kelas_nama}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: '2px 8px', borderRadius: '6px' }}>
                    {selectedSiswa.nomor}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', opacity: 0.85 }}>
                SALDO SAAT INI
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginTop: '2px' }} className="tabular-nums">
                {formatRupiah(selectedSiswa.saldo ?? 0)}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              borderRadius: '18px',
              border: '2px dashed var(--border)',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--muted)',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
              Belum ada siswa yang dipilih
            </div>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              Cari nama atau nomor rekening di sebelah kiri, atau tekan <kbd style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>Ctrl + K</kbd>
            </p>
          </div>
        )}

        {/* Card Form Transaksi Baru */}
        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            boxShadow: 'var(--card-shadow)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Header Bar Form: Judul & Toggle Setoran / Penarikan */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              Transaksi baru
            </h3>

            {/* Segmented Control Setoran / Penarikan */}
            <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => {
                  setJenis('setoran');
                  nominalInputRef.current?.focus();
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: jenis === 'setoran' ? 'var(--ok)' : 'transparent',
                  color: jenis === 'setoran' ? '#FFFFFF' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>↓</span> Setoran
              </button>
              <button
                type="button"
                onClick={() => {
                  setJenis('penarikan');
                  nominalInputRef.current?.focus();
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: jenis === 'penarikan' ? 'var(--danger)' : 'transparent',
                  color: jenis === 'penarikan' ? '#FFFFFF' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>↑</span> Penarikan
              </button>
            </div>
          </div>

          {/* Section NOMINAL */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
              NOMINAL
            </label>

            {/* Input Nominal Besar dengan Pill Enter di Kanan */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg)',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                padding: '4px 14px',
              }}
            >
              <input
                ref={nominalInputRef}
                type="text"
                placeholder="Rp 0"
                value={nominalRaw}
                onChange={(e) => {
                  const angka = parseRupiah(e.target.value);
                  setNominalRaw(angka === 0 ? '' : formatRupiah(angka));
                }}
                onKeyDown={handleNominalKeyDown}
                style={{
                  width: '100%',
                  fontSize: '26px',
                  fontWeight: 800,
                  color: jenis === 'setoran' ? 'var(--ok-text)' : 'var(--danger-text)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  letterSpacing: '-0.5px',
                }}
                className="tabular-nums"
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                <span>Enter</span>
                <span style={{ fontSize: '12px' }}>↵</span>
              </div>
            </div>

            {/* Quick Amount Chips */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {[10000, 20000, 50000, 100000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleAddNominal(amt)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                >
                  + {formatRupiah(amt).replace('Rp ', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Row Tanggal & Keterangan */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                TANGGAL
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                }}
              >
                <IconCalendar width={15} height={15} style={{ color: 'var(--muted)' }} />
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text)',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                KETERANGAN (OPSIONAL)
              </label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Misalnya: setoran mingguan"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Footer Form: Saldo Sesudah & Tombol Aksi */}
          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                Saldo sesudah transaksi
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginTop: '1px' }} className="tabular-nums">
                {formatRupiah(saldoSesudah)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedSiswa(null);
                  setErrorMsg(null);
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                Ganti Siswa (Esc)
              </button>

              <button
                type="submit"
                disabled={loading || !selectedSiswa}
                style={{
                  padding: '10px 22px',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: loading || !selectedSiswa ? 0.6 : 1,
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                }}
              >
                <IconCheck width={16} height={16} />
                <span>Simpan transaksi</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* ======================================================== */}
      {/* KOLOM KANAN: RINGKASAN HARI INI & RIWAYAT SISWA (Page 1)  */}
      {/* ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Card 1: Ringkasan hari ini */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
            padding: '18px 20px',
          }}
        >
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '14px' }}>
            Ringkasan hari ini
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Setoran</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ok)', marginTop: '2px' }} className="tabular-nums">
                {formatRupiah(kasHariIni?.total_setoran || 0)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Penarikan</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }} className="tabular-nums">
                {formatRupiah(kasHariIni?.total_penarikan || 0)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)' }}>
            {kasHariIni?.jumlah_transaksi || 0} transaksi tercatat hari ini
          </div>
        </div>

        {/* Card 2: Riwayat Siswa */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
              Riwayat siswa
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>
              Lihat semua
            </span>
          </div>

          {selectedSiswa && riwayatSiswa.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {riwayatSiswa.map((trx) => {
                const isSetor = trx.jenis === 'setoran' || (trx.jenis === 'pembalik' && trx.nilai > 0);
                return (
                  <div
                    key={trx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '9999px',
                          backgroundColor: isSetor ? 'var(--ok-bg)' : 'var(--danger-bg)',
                          color: isSetor ? 'var(--ok-text)' : 'var(--danger-text)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {isSetor ? '+' : '−'}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                          {trx.jenis === 'setoran' ? 'Setoran' : trx.jenis === 'penarikan' ? 'Penarikan' : 'Koreksi'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                          {formatTanggalIndonesia(trx.tanggal, { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: isSetor ? 'var(--ok)' : 'var(--danger)',
                      }}
                      className="tabular-nums"
                    >
                      {formatRupiah(Math.abs(trx.nilai))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              {selectedSiswa ? 'Belum ada riwayat transaksi' : 'Pilih siswa untuk melihat riwayat'}
            </div>
          )}
        </div>
      </section>

      {/* Modal Pratinjau Cetak Struk */}
      {previewStruk && (
        <PratinjauCetakModal
          terbuka={Boolean(previewStruk)}
          html={previewStruk.html}
          judul={`Struk ${previewStruk.nomor_bukti}`}
          onTutup={() => setPreviewStruk(null)}
        />
      )}
    </div>
  );
}
