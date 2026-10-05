import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { galatPin, PANJANG_PIN } from '../../shared/pin.js';
import { tombol, tombolUtama, kolom, labelStyle, kartu, kartuKepala } from '../styles/ui.js';
import { KodePemulihan } from './KodePemulihan.js';

type Mode = 'diam' | 'aktifkan' | 'ubah' | 'matikan' | 'kode';

const hanyaAngka = (teks: string) => teks.replace(/\D/g, '').slice(0, PANJANG_PIN);

function BarisPin({ id, label, nilai, onUbah }: { id: string; label: string; nilai: string; onUbah: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={PANJANG_PIN} value={nilai} onChange={(e) => onUbah(hanyaAngka(e.target.value))} style={{ ...kolom, maxWidth: '220px' }} />
    </div>
  );
}

/** Pengaturan kunci PIN (CAP-16): aktifkan, ubah, matikan, dan kunci sekarang. */
export function KeamananPanel() {
  const [aktif, setAktif] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>('diam');
  const [pinLama, setPinLama] = useState('');
  const [pinBaru, setPinBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [kode, setKode] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const r = await window.pundi.kunciStatus();
    if (r.ok) setAktif(r.data.aktif);
  }, []);
  useEffect(() => {
    void muat();
  }, [muat]);

  const selesai = (teks?: string) => {
    setMode('diam');
    setPinLama('');
    setPinBaru('');
    setUlang('');
    setGalat(null);
    setPesan(teks ?? null);
    void muat();
    // Beri tahu pembungkus aplikasi agar tombol Kunci di bilah atas ikut berubah
    window.dispatchEvent(new Event('pundi:kunci-berubah'));
  };

  const mulai = (m: Mode) => {
    setMode(m);
    setGalat(null);
    setPesan(null);
    setPinLama('');
    setPinBaru('');
    setUlang('');
  };

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setGalat(null);
    if (mode === 'aktifkan' || mode === 'ubah') {
      const g = galatPin(pinBaru);
      if (g) return setGalat(g);
      if (pinBaru !== ulang) return setGalat('Pengulangan PIN tidak sama.');
    }
    setSibuk(true);
    try {
      if (mode === 'aktifkan') {
        const r = await window.pundi.kunciAtur(pinBaru);
        if (!r.ok) return setGalat(r.pesan);
        setKode(r.data.kode_pemulihan);
        setMode('kode');
      } else if (mode === 'ubah') {
        const r = await window.pundi.kunciUbah(pinLama, pinBaru);
        if (!r.ok) return setGalat(r.pesan);
        selesai('PIN berhasil diubah. Kode pemulihan Anda tetap sama.');
      } else if (mode === 'matikan') {
        const r = await window.pundi.kunciMatikan(pinLama);
        if (!r.ok) return setGalat(r.pesan);
        selesai('PIN dimatikan. Aplikasi tidak lagi meminta PIN saat dibuka.');
      }
    } finally {
      setSibuk(false);
    }
  };

  const kunciSekarang = async () => {
    await window.pundi.kunciKunciSekarang();
    window.dispatchEvent(new Event('pundi:kunci-berubah'));
  };

  return (
    <section style={kartu} aria-labelledby="kk-judul">
      <div style={kartuKepala}>
        <div>
          <h3 id="kk-judul" style={{ fontSize: '14px', fontWeight: 600 }}>Keamanan: PIN aplikasi</h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {aktif ? 'PIN aktif. Aplikasi meminta PIN setiap dibuka.' : 'PIN belum aktif. Siapa pun yang membuka komputer ini dapat melihat data tabungan.'}
          </p>
        </div>
        <span
          style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', color: aktif ? 'var(--ok)' : 'var(--warn)', border: `1px solid ${aktif ? 'var(--ok)' : 'var(--warn)'}` }}
        >
          {aktif === null ? '...' : aktif ? 'AKTIF' : 'TIDAK AKTIF'}
        </span>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {pesan && (
          <div role="status" style={{ padding: '10px 14px', border: '1px solid var(--ok)', color: 'var(--ok)', borderRadius: '6px', fontSize: '13px' }}>{pesan}</div>
        )}

        {mode === 'diam' && aktif !== null && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!aktif ? (
              <button type="button" style={tombolUtama} onClick={() => mulai('aktifkan')}>Aktifkan PIN</button>
            ) : (
              <>
                <button type="button" style={tombol} onClick={() => mulai('ubah')}>Ubah PIN</button>
                <button type="button" style={tombol} onClick={() => mulai('matikan')}>Matikan PIN</button>
                <button type="button" style={tombolUtama} onClick={kunciSekarang}>Kunci sekarang</button>
              </>
            )}
          </div>
        )}

        {(mode === 'aktifkan' || mode === 'ubah' || mode === 'matikan') && (
          <form onSubmit={kirim} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mode === 'aktifkan' && (
              <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                Pilih {PANJANG_PIN} angka yang mudah Anda ingat tetapi tidak mudah ditebak (bukan 123456 atau angka sama).
                Setelah itu Anda akan diberi kode pemulihan untuk berjaga-jaga bila PIN lupa.
              </p>
            )}
            {(mode === 'ubah' || mode === 'matikan') && (
              <BarisPin id="kk-pin-lama" label={mode === 'ubah' ? 'PIN lama' : 'Masukkan PIN untuk mematikan'} nilai={pinLama} onUbah={setPinLama} />
            )}
            {(mode === 'aktifkan' || mode === 'ubah') && (
              <>
                <BarisPin id="kk-pin-baru" label="PIN baru" nilai={pinBaru} onUbah={setPinBaru} />
                <BarisPin id="kk-pin-ulang" label="Ulangi PIN baru" nilai={ulang} onUbah={setUlang} />
              </>
            )}
            {galat && (
              <div role="alert" style={{ padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', fontSize: '13px' }}>{galat}</div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" style={tombol} disabled={sibuk} onClick={() => selesai()}>Batal</button>
              <button type="submit" style={tombolUtama} disabled={sibuk}>
                {sibuk ? 'Memproses...' : mode === 'aktifkan' ? 'Aktifkan' : mode === 'ubah' ? 'Simpan PIN Baru' : 'Matikan PIN'}
              </button>
            </div>
          </form>
        )}

        {mode === 'kode' && (
          <KodePemulihan
            kode={kode}
            onSelesai={() => {
              setKode('');
              selesai('PIN aktif. Aplikasi akan meminta PIN saat dibuka berikutnya.');
            }}
          />
        )}
      </div>
    </section>
  );
}
