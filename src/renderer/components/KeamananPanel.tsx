import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { galatPin, PANJANG_PIN } from '../../shared/pin.js';
import { Button, Field } from './ui/index.js';
import { KodePemulihan } from './KodePemulihan.js';
import './panel-bersama.css';

type Mode = 'diam' | 'aktifkan' | 'ubah' | 'matikan' | 'kode';

const hanyaAngka = (teks: string) => teks.replace(/\D/g, '').slice(0, PANJANG_PIN);

function BarisPin({ id, label, nilai, onUbah }: { id: string; label: string; nilai: string; onUbah: (v: string) => void }) {
  return (
    <Field label={label} htmlFor={id} className="pb-input-pin">
      <input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={PANJANG_PIN} value={nilai} onChange={(e) => onUbah(hanyaAngka(e.target.value))} className="ui-input" />
    </Field>
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
    <section className="ui-card" aria-labelledby="kk-judul">
      <div className="ui-card-header">
        <div>
          <h3 id="kk-judul" className="pb-judul">Keamanan: PIN aplikasi</h3>
          <p className="pb-sub">
            {aktif ? 'PIN aktif. Aplikasi meminta PIN setiap dibuka.' : 'PIN belum aktif. Siapa pun yang membuka komputer ini dapat melihat data tabungan.'}
          </p>
        </div>
        <span className={aktif ? 'pb-lencana pb-lencana-aktif' : 'pb-lencana'}>
          {aktif === null ? '...' : aktif ? 'AKTIF' : 'TIDAK AKTIF'}
        </span>
      </div>

      <div className="pb-panel-isi">
        {pesan && (
          <div role="status" className="pb-pesan pb-pesan-ok">{pesan}</div>
        )}

        {mode === 'diam' && aktif !== null && (
          <div className="pb-baris-bungkus">
            {!aktif ? (
              <Button type="button" variant="primary" onClick={() => mulai('aktifkan')}>Aktifkan PIN</Button>
            ) : (
              <>
                <Button type="button" onClick={() => mulai('ubah')}>Ubah PIN</Button>
                <Button type="button" onClick={() => mulai('matikan')}>Matikan PIN</Button>
                <Button type="button" variant="primary" onClick={kunciSekarang}>Kunci sekarang</Button>
              </>
            )}
          </div>
        )}

        {(mode === 'aktifkan' || mode === 'ubah' || mode === 'matikan') && (
          <form onSubmit={kirim} className="pb-kolom">
            {mode === 'aktifkan' && (
              <p className="pb-teks-kecil">
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
              <div role="alert" className="pb-pesan pb-pesan-galat">{galat}</div>
            )}
            <div className="pb-baris">
              <Button type="button" disabled={sibuk} onClick={() => selesai()}>Batal</Button>
              <Button type="submit" variant="primary" disabled={sibuk}>
                {sibuk ? 'Memproses...' : mode === 'aktifkan' ? 'Aktifkan' : mode === 'ubah' ? 'Simpan PIN Baru' : 'Matikan PIN'}
              </Button>
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
