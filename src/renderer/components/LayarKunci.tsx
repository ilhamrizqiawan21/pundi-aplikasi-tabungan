import { useEffect, useRef, useState, type FormEvent } from 'react';
import logoUrl from '../assets/logo.png';
import { galatPin, PANJANG_PIN } from '../../shared/pin.js';
import { tombolUtama, kolom, labelStyle } from '../styles/ui.js';
import { KodePemulihan } from './KodePemulihan.js';

interface LayarKunciProps {
  /** Dipanggil setelah kunci terbuka (PIN benar atau pemulihan berhasil). */
  onBuka: () => void;
}

const hanyaAngka = (teks: string) => teks.replace(/\D/g, '').slice(0, PANJANG_PIN);

/** Halaman PIN yang tampil sebelum menu apa pun (CAP-16). Data baru dimuat setelah kunci terbuka. */
export function LayarKunci({ onBuka }: LayarKunciProps) {
  const [mode, setMode] = useState<'pin' | 'lupa' | 'kodeBaru'>('pin');
  const [pin, setPin] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [tunggu, setTunggu] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const [kode, setKode] = useState('');
  const [pinBaru, setPinBaru] = useState('');
  const [ulangPin, setUlangPin] = useState('');
  const [kodeBaruTampil, setKodeBaruTampil] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sisa jeda dari proses utama; dihitung mundur di layar
  useEffect(() => {
    window.pundi.kunciStatus().then((r) => r.ok && setTunggu(r.data.tunggu_detik));
  }, []);
  useEffect(() => {
    if (tunggu <= 0) return;
    const t = setTimeout(() => setTunggu((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [tunggu]);
  useEffect(() => {
    if (mode === 'pin' && tunggu <= 0) inputRef.current?.focus();
  }, [mode, tunggu]);

  const tanganiGalat = (kodeGalat: string, pesan: string) => {
    setGalat(pesan);
    if (kodeGalat === 'TERKUNCI_SEMENTARA' || /dijeda/.test(pesan)) {
      window.pundi.kunciStatus().then((r) => r.ok && setTunggu(r.data.tunggu_detik));
    }
  };

  const kirimPin = async (nilai: string) => {
    if (sibuk || tunggu > 0) return;
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.kunciBuka(nilai);
    setSibuk(false);
    if (res.ok) {
      onBuka();
    } else {
      setPin('');
      tanganiGalat(res.kode, res.pesan);
      inputRef.current?.focus();
    }
  };

  const ubahPin = (teks: string) => {
    const bersih = hanyaAngka(teks);
    setPin(bersih);
    if (bersih.length === PANJANG_PIN) void kirimPin(bersih);
  };

  const kirimPemulihan = async (e: FormEvent) => {
    e.preventDefault();
    setGalat(null);
    const g = galatPin(pinBaru);
    if (g) return setGalat(g);
    if (pinBaru !== ulangPin) return setGalat('Pengulangan PIN baru tidak sama.');
    setSibuk(true);
    const res = await window.pundi.kunciPulihkan(kode, pinBaru);
    setSibuk(false);
    if (res.ok) {
      setKodeBaruTampil(res.data.kode_pemulihan);
      setMode('kodeBaru');
    } else {
      tanganiGalat(res.kode, res.pesan);
    }
  };

  return (
    <main
      aria-label="Kunci aplikasi"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
    >
      <div style={{ width: '100%', maxWidth: '380px', padding: '32px 28px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' }}>
        <img src={logoUrl} alt="" width={72} height={72} style={{ borderRadius: 'var(--radius-lg)' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Pundi</h1>

        {mode === 'pin' && (
          <>
            <div style={{ width: '100%' }}>
              <label htmlFor="pin-masuk" style={{ ...labelStyle, textAlign: 'center' }}>Masukkan PIN ({PANJANG_PIN} angka)</label>
              <input
                id="pin-masuk"
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PANJANG_PIN}
                value={pin}
                disabled={sibuk || tunggu > 0}
                onChange={(e) => ubahPin(e.target.value)}
                style={{ ...kolom, textAlign: 'center', fontSize: '24px', letterSpacing: '10px', padding: '12px' }}
              />
            </div>
            <div role="alert" aria-live="assertive" style={{ minHeight: '20px', fontSize: '13px', color: 'var(--danger)', textAlign: 'center' }}>
              {tunggu > 0 ? `Terlalu banyak percobaan salah. Coba lagi dalam ${tunggu} detik.` : galat}
            </div>
            <button type="button" onClick={() => { setMode('lupa'); setGalat(null); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Lupa PIN?
            </button>
          </>
        )}

        {mode === 'lupa' && (
          <form onSubmit={kirimPemulihan} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
              Masukkan kode pemulihan yang Anda simpan saat PIN dibuat, lalu tetapkan PIN baru.
            </p>
            <div>
              <label htmlFor="kode-pemulihan" style={labelStyle}>Kode pemulihan</label>
              <input id="kode-pemulihan" type="text" autoComplete="off" autoCapitalize="characters" value={kode} onChange={(e) => setKode(e.target.value)} style={kolom} placeholder="XXXX-XXXX-XXXX-XXXX" />
            </div>
            <div>
              <label htmlFor="pin-baru" style={labelStyle}>PIN baru</label>
              <input id="pin-baru" type="password" inputMode="numeric" autoComplete="off" maxLength={PANJANG_PIN} value={pinBaru} onChange={(e) => setPinBaru(hanyaAngka(e.target.value))} style={kolom} />
            </div>
            <div>
              <label htmlFor="pin-ulang" style={labelStyle}>Ulangi PIN baru</label>
              <input id="pin-ulang" type="password" inputMode="numeric" autoComplete="off" maxLength={PANJANG_PIN} value={ulangPin} onChange={(e) => setUlangPin(hanyaAngka(e.target.value))} style={kolom} />
            </div>
            <div role="alert" style={{ minHeight: '18px', fontSize: '13px', color: 'var(--danger)' }}>
              {tunggu > 0 ? `Coba lagi dalam ${tunggu} detik.` : galat}
            </div>
            <button type="submit" style={tombolUtama} disabled={sibuk || tunggu > 0 || kode.trim() === ''}>
              {sibuk ? 'Memproses...' : 'Pulihkan dan Masuk'}
            </button>
            <button type="button" onClick={() => { setMode('pin'); setGalat(null); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}>
              Kembali
            </button>
          </form>
        )}

        {mode === 'kodeBaru' && (
          <div style={{ width: '100%' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>PIN baru sudah aktif. Kode pemulihan lama tidak berlaku lagi.</p>
            <KodePemulihan kode={kodeBaruTampil} onSelesai={onBuka} />
          </div>
        )}
      </div>
    </main>
  );
}
