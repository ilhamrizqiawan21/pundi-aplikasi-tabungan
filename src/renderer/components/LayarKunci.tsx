import { useEffect, useRef, useState, type FormEvent } from 'react';
import logoUrl from '../assets/logo.png';
import { galatPin, PANJANG_PIN } from '../../shared/pin.js';
import { Button, Field, Input } from './ui/index.js';
import './LayarKunci.css';
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
    <main aria-label="Kunci aplikasi" className="kunci-halaman">
      <div className="kunci-kartu">
        <img src={logoUrl} alt="" width={72} height={72} className="kunci-logo" />
        <h1 className="kunci-judul">Pundi</h1>

        {mode === 'pin' && (
          <>
            <Field
              className="kunci-blok kunci-label-tengah"
              label={`Masukkan PIN (${PANJANG_PIN} angka)`}
              htmlFor="pin-masuk"
            >
              <Input
                id="pin-masuk"
                ref={inputRef}
                className="kunci-pin-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PANJANG_PIN}
                value={pin}
                disabled={sibuk || tunggu > 0}
                onChange={(e) => ubahPin(e.target.value)}
              />
            </Field>
            <div role="alert" aria-live="assertive" className="kunci-pesan kunci-pesan-tengah">
              {tunggu > 0 ? `Terlalu banyak percobaan salah. Coba lagi dalam ${tunggu} detik.` : galat}
            </div>
            <button
              type="button"
              onClick={() => { setMode('lupa'); setGalat(null); }}
              className="kunci-tautan kunci-tautan-aksen"
            >
              Lupa PIN?
            </button>
          </>
        )}

        {mode === 'lupa' && (
          <form onSubmit={kirimPemulihan} className="kunci-form">
            <p className="kunci-info">
              Masukkan kode pemulihan yang Anda simpan saat PIN dibuat, lalu tetapkan PIN baru.
            </p>
            <Field label="Kode pemulihan" htmlFor="kode-pemulihan">
              <Input id="kode-pemulihan" type="text" autoComplete="off" autoCapitalize="characters" value={kode} onChange={(e) => setKode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
            </Field>
            <Field label="PIN baru" htmlFor="pin-baru">
              <Input id="pin-baru" type="password" inputMode="numeric" autoComplete="off" maxLength={PANJANG_PIN} value={pinBaru} onChange={(e) => setPinBaru(hanyaAngka(e.target.value))} />
            </Field>
            <Field label="Ulangi PIN baru" htmlFor="pin-ulang">
              <Input id="pin-ulang" type="password" inputMode="numeric" autoComplete="off" maxLength={PANJANG_PIN} value={ulangPin} onChange={(e) => setUlangPin(hanyaAngka(e.target.value))} />
            </Field>
            <div role="alert" className="kunci-pesan">
              {tunggu > 0 ? `Coba lagi dalam ${tunggu} detik.` : galat}
            </div>
            <Button type="submit" variant="primary" disabled={sibuk || tunggu > 0 || kode.trim() === ''}>
              {sibuk ? 'Memproses...' : 'Pulihkan dan Masuk'}
            </Button>
            <button type="button" onClick={() => { setMode('pin'); setGalat(null); }} className="kunci-tautan">
              Kembali
            </button>
          </form>
        )}

        {mode === 'kodeBaru' && (
          <div className="kunci-blok">
            <p className="kunci-info-tebal">PIN baru sudah aktif. Kode pemulihan lama tidak berlaku lagi.</p>
            <KodePemulihan kode={kodeBaruTampil} onSelesai={onBuka} />
          </div>
        )}
      </div>
    </main>
  );
}
