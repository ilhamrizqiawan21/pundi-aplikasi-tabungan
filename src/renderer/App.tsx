import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProfilSekolah, TahunAjaran, TemaAplikasi } from '../shared/types.js';

import { BerandaScreen } from './screens/BerandaScreen.js';
import { CatatTransaksiScreen } from './screens/CatatTransaksiScreen.js';
import { SiswaScreen } from './screens/SiswaScreen.js';
import { LaporanScreen } from './screens/LaporanScreen.js';
import { ImporScreen } from './screens/ImporScreen.js';
import { CadanganScreen } from './screens/CadanganScreen.js';
import { AkademikScreen } from './screens/AkademikScreen.js';
import { KenaikanScreen } from './screens/KenaikanScreen.js';
import { PengaturanScreen } from './screens/PengaturanScreen.js';

export type ScreenId =
  | 'beranda'
  | 'catat'
  | 'siswa'
  | 'laporan'
  | 'akademik'
  | 'kenaikan'
  | 'impor'
  | 'cadangan'
  | 'pengaturan';

interface ItemNav {
  id: ScreenId;
  label: string;
  judul: string;
  highlight?: boolean;
  /** Bila kosong, memakai Alt+nomor urut. */
  pintasan?: string;
}

// Urutan di sini = urutan menu = nomor Alt+1 sampai Alt+9 (DESIGN §6)
const NAV: ItemNav[] = [
  { id: 'beranda', label: 'Beranda', judul: 'Beranda (Kas Harian)' },
  { id: 'catat', label: 'Catat Transaksi', judul: 'Catat Transaksi', highlight: true, pintasan: 'Ctrl+K' },
  { id: 'siswa', label: 'Siswa', judul: 'Data Siswa & Buku Besar' },
  { id: 'laporan', label: 'Laporan', judul: 'Laporan Tabungan' },
  { id: 'akademik', label: 'Tahun Ajaran & Kelas', judul: 'Tahun Ajaran & Kelas' },
  { id: 'kenaikan', label: 'Kenaikan Kelas', judul: 'Kenaikan Kelas & Kelulusan' },
  { id: 'impor', label: 'Impor Data', judul: 'Impor Data Excel / CSV' },
  { id: 'cadangan', label: 'Cadangan', judul: 'Cadangan & Pemulihan' },
  { id: 'pengaturan', label: 'Pengaturan', judul: 'Pengaturan Aplikasi' },
];

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('beranda');
  const [profil, setProfil] = useState<ProfilSekolah | null>(null);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<TahunAjaran | null>(null);
  const [tema, setTema] = useState<TemaAplikasi>('putih');
  const kontenRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);

  // Pintasan global (DESIGN §6). Dinonaktifkan saat dialog terbuka agar tidak berpindah layar di belakangnya.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setScreen('catat');
        return;
      }

      if (e.altKey && !mod && !e.shiftKey) {
        const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
        const item = m ? NAV[Number(m[1]) - 1] : undefined;
        if (item) {
          e.preventDefault();
          setScreen(item.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Setelah berpindah layar, fokus ke konten agar Tab berikutnya langsung ke isi layar (Catat Transaksi memfokuskan pencarian sendiri)
  useEffect(() => {
    if (screen !== 'catat') kontenRef.current?.focus();
  }, [screen]);

  const muatTahunAjaranAktif = useCallback(() => {
    window.pundi.tahunAjaranDaftar().then((res) => {
      if (res.ok) setTahunAjaranAktif(res.data.find((ta) => ta.aktif === 1) || null);
    });
  }, []);

  useEffect(() => {
    if (window.pundi) {
      window.pundi.profilSekolahBaca().then((res) => {
        if (res.ok) setProfil(res.data);
      });
      muatTahunAjaranAktif();
      window.pundi.pengaturanBaca().then((res) => {
        if (res.ok && res.data.tema) {
          setTema(res.data.tema);
        }
      });
    }
  }, [muatTahunAjaranAktif]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar Navigasi */}
      <aside
        style={{
          width: '220px',
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
            Pundi
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Tabungan Siswa Offline
          </p>
        </div>

        <nav aria-label="Menu utama" style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV.map((n, idx) => (
            <NavButton
              key={n.id}
              active={screen === n.id}
              onClick={() => setScreen(n.id)}
              label={n.label}
              highlight={n.highlight}
              shortcut={n.pintasan ?? `Alt+${idx + 1}`}
            />
          ))}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--muted)' }}>
          Versi 0.1.0
        </div>
      </aside>

      {/* Area Konten Utama */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Bilah Atas */}
        <header
          style={{
            height: '56px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            backgroundColor: 'var(--bg)',
            flexShrink: 0,
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>
              {profil?.nama || 'Madrasah / Sekolah'}
            </span>
            {tahunAjaranAktif && (
              <span
                style={{
                  marginLeft: '12px',
                  fontSize: '12px',
                  padding: '2px 8px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--muted)',
                }}
              >
                T.A. {tahunAjaranAktif.nama}
              </span>
            )}
          </div>

          <button
            onClick={async () => {
              if (window.pundi) {
                const res = await window.pundi.backupBuat('Cadangan manual dari bilah atas');
                if (res.ok) {
                  alert('Cadangan berhasil dibuat.');
                } else {
                  alert(`Gagal membuat cadangan: ${res.pesan}`);
                }
              }
            }}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Cadangkan Cepat
          </button>
        </header>

        {/* Layar Aktif */}
        <main ref={kontenRef} tabIndex={-1} style={{ flex: 1, overflow: 'auto', padding: '24px', backgroundColor: 'var(--bg)', outline: 'none' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>
              {NAV.find((n) => n.id === screen)?.judul}
            </h2>

            {screen === 'beranda' && (
              <BerandaScreen onGoToCatat={() => setScreen('catat')} />
            )}
            {screen === 'catat' && <CatatTransaksiScreen />}
            {screen === 'siswa' && <SiswaScreen />}
            {screen === 'laporan' && <LaporanScreen />}
            {screen === 'akademik' && <AkademikScreen onChanged={muatTahunAjaranAktif} />}
            {screen === 'impor' && <ImporScreen />}
            {screen === 'cadangan' && <CadanganScreen />}
            {screen === 'pengaturan' && (
              <PengaturanScreen onThemeChange={(newTheme) => setTema(newTheme)} />
            )}

            {screen === 'kenaikan' && <KenaikanScreen />}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavButton({
  label,
  active,
  highlight,
  shortcut,
  onClick,
}: {
  label: string;
  active: boolean;
  highlight?: boolean;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '10px 12px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: active
          ? 'var(--accent)'
          : highlight
          ? 'var(--surface)'
          : 'transparent',
        color: active
          ? 'var(--accent-text)'
          : highlight
          ? 'var(--accent)'
          : 'var(--text)',
        fontWeight: active || highlight ? 600 : 500,
        fontSize: '13px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s ease',
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <span
          style={{
            fontSize: '10px',
            opacity: 0.7,
            border: `1px solid ${active ? 'var(--accent-text)' : 'var(--border)'}`,
            padding: '1px 4px',
            borderRadius: '3px',
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}
