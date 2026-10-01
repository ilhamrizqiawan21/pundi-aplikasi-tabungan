import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Siswa, Transaksi, JenisTransaksi } from '../../shared/types.js';
import { formatRupiah, parseRupiah } from '../../shared/rupiah.js';

export function CatatTransaksiScreen() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Siswa[]>([]);
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Form Transaksi
  const [jenis, setJenis] = useState<JenisTransaksi>('setoran');
  const [nominalRaw, setNominalRaw] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().substring(0, 10));
  const [keterangan, setKeterangan] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Konfirmasi Transaksi Terakhir
  const [lastTrx, setLastTrx] = useState<{
    transaksi: Transaksi;
    siswa: Siswa;
  } | null>(null);
  const [koreksiLoading, setKoreksiLoading] = useState(false);

  // Refs untuk navigasi keyboard
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nominalInputRef = useRef<HTMLInputElement>(null);

  // Auto focus search input saat pertama dibuka
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Shortcut global Ctrl+K / Alt+S / Alt+T
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live search siswa
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await window.pundi.siswaCari(query, undefined, 'aktif');
      if (res.ok) {
        setSearchResults(res.data);
        setSelectedIndex(0);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectSiswa = (siswa: Siswa) => {
    setSelectedSiswa(siswa);
    setQuery('');
    setSearchResults([]);
    setErrorMsg(null);
    setNominalRaw('');
    setKeterangan('');
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
        } else {
          alert(`Gagal membatalkan transaksi: ${res.pesan}`);
        }
      } finally {
        setKoreksiLoading(false);
      }
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Notifikasi Transaksi Terakhir (Konfirmasi Instan) */}
      {lastTrx && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#EAF7ED',
            border: '1px solid #C3E6CB',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ok)', fontSize: '14px' }}>
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
              onClick={() => {
                alert(`Mencetak struk ${lastTrx.transaksi.nomor_bukti}...`);
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cetak Struk
            </button>
            <button
              onClick={handleKoreksiTerakhir}
              disabled={koreksiLoading}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--danger)',
                borderRadius: '6px',
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

      {/* Bagian 1: Pencarian Siswa */}
      <div style={{ position: 'relative' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
          1. Cari Siswa <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Ctrl+K untuk fokus, ↑↓ pilih, Enter konfirmasi)</span>
        </label>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Ketik nama siswa, nomor rekening (T-...), atau NIS..."
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '15px',
            borderRadius: '8px',
            border: '2px solid var(--accent)',
            backgroundColor: 'var(--surface)',
            outline: 'none',
          }}
        />

        {/* Dropdown Hasil Pencarian */}
        {searchResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 100,
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {searchResults.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => handleSelectSiswa(s)}
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: idx === selectedIndex ? 'var(--surface)' : 'transparent',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.nama}</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>
                    {s.nomor} • Kelas {s.kelas_nama || '-'}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--accent)' }}>
                  {formatRupiah(s.saldo || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bagian 2: Kartu Siswa Terpilih & Form Input Transaksi */}
      {selectedSiswa ? (
        <form
          onSubmit={handleSubmit}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '24px',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Kartu Siswa & Saldo Besar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{selectedSiswa.nama}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                No. Rekening: <strong>{selectedSiswa.nomor}</strong> | Kelas:{' '}
                <strong>{selectedSiswa.kelas_nama || '-'}</strong> | NIS:{' '}
                <strong>{selectedSiswa.nis || '-'}</strong>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Saldo Saat Ini</div>
              <div
                className="tabular-nums"
                style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)' }}
              >
                {formatRupiah(selectedSiswa.saldo || 0)}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#FDEDEC',
                color: 'var(--danger)',
                borderRadius: '6px',
                fontSize: '13px',
                border: '1px solid #FADBD8',
                fontWeight: 500,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Pemilihan Jenis Transaksi */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Jenis Transaksi <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Ketik 'S' untuk Setoran, 'T' untuk Penarikan)</span>
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setJenis('setoran')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  border: jenis === 'setoran' ? '2px solid var(--ok)' : '1px solid var(--border)',
                  backgroundColor: jenis === 'setoran' ? '#EAF7ED' : 'var(--bg)',
                  color: jenis === 'setoran' ? 'var(--ok)' : 'var(--text)',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>+</span> Setoran (S)
              </button>
              <button
                type="button"
                onClick={() => setJenis('penarikan')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  border: jenis === 'penarikan' ? '2px solid var(--danger)' : '1px solid var(--border)',
                  backgroundColor: jenis === 'penarikan' ? '#FDEDEC' : 'var(--bg)',
                  color: jenis === 'penarikan' ? 'var(--danger)' : 'var(--text)',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>−</span> Penarikan (T)
              </button>
            </div>
          </div>

          {/* Input Nominal & Tanggal */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Nominal (Rupiah) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                ref={nominalInputRef}
                type="text"
                required
                value={nominalRaw}
                onKeyDown={handleNominalKeyDown}
                onChange={(e) => {
                  const val = parseRupiah(e.target.value);
                  setNominalRaw(val > 0 ? formatRupiah(val) : '');
                }}
                placeholder="Rp 0"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '18px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Tanggal
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                }}
              />
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Keterangan <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Opsional)</span>
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Tabungan mingguan"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            />
          </div>

          {/* Tombol Simpan */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedSiswa(null);
                searchInputRef.current?.focus();
              }}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Ganti Siswa (Esc)
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: jenis === 'setoran' ? 'var(--ok)' : 'var(--accent)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Menyimpan...' : `Simpan ${jenis === 'setoran' ? 'Setoran' : 'Penarikan'} (Enter)`}
            </button>
          </div>
        </form>
      ) : (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--surface)',
            borderRadius: '8px',
            border: '1px dashed var(--border)',
            color: 'var(--muted)',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
            Belum ada siswa yang dipilih
          </div>
          <div style={{ fontSize: '13px' }}>
            Gunakan kolom pencarian di atas untuk memilih siswa dan mencatat transaksi secara cepat.
          </div>
        </div>
      )}
    </div>
  );
}
