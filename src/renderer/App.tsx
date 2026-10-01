import { useState, useEffect, useCallback } from 'react';
import type { ProfilSekolah, TahunAjaran, TemaAplikasi } from '../shared/types.js';

import { BerandaScreen } from './screens/BerandaScreen.js';
import { CatatTransaksiScreen } from './screens/CatatTransaksiScreen.js';
import { SiswaScreen } from './screens/SiswaScreen.js';
import { LaporanScreen } from './screens/LaporanScreen.js';
import { ImporScreen } from './screens/ImporScreen.js';
import { CadanganScreen } from './screens/CadanganScreen.js';
import { AkademikScreen } from './screens/AkademikScreen.js';
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

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('beranda');
  const [profil, setProfil] = useState<ProfilSekolah | null>(null);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<TahunAjaran | null>(null);
  const [tema, setTema] = useState<TemaAplikasi>('putih');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);

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

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <NavButton
            active={screen === 'beranda'}
            onClick={() => setScreen('beranda')}
            label="Beranda"
            shortcut="Alt+1"
          />
          <NavButton
            active={screen === 'catat'}
            onClick={() => setScreen('catat')}
            label="Catat Transaksi"
            highlight
            shortcut="Ctrl+K"
          />
          <NavButton
            active={screen === 'siswa'}
            onClick={() => setScreen('siswa')}
            label="Siswa"
          />
          <NavButton
            active={screen === 'laporan'}
            onClick={() => setScreen('laporan')}
            label="Laporan"
          />
          <NavButton
            active={screen === 'akademik'}
            onClick={() => setScreen('akademik')}
            label="Tahun Ajaran & Kelas"
          />
          <NavButton
            active={screen === 'kenaikan'}
            onClick={() => setScreen('kenaikan')}
            label="Kenaikan Kelas"
          />
          <NavButton
            active={screen === 'impor'}
            onClick={() => setScreen('impor')}
            label="Impor Data"
          />
          <NavButton
            active={screen === 'cadangan'}
            onClick={() => setScreen('cadangan')}
            label="Cadangan"
          />
          <NavButton
            active={screen === 'pengaturan'}
            onClick={() => setScreen('pengaturan')}
            label="Pengaturan"
          />
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
        <main style={{ flex: 1, overflow: 'auto', padding: '24px', backgroundColor: 'var(--bg)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>
              {screen === 'beranda' && 'Beranda (Kas Harian)'}
              {screen === 'catat' && 'Catat Transaksi'}
              {screen === 'siswa' && 'Data Siswa & Buku Besar'}
              {screen === 'laporan' && 'Laporan Tabungan'}
              {screen === 'akademik' && 'Tahun Ajaran & Kelas'}
              {screen === 'kenaikan' && 'Kenaikan Kelas & Kelulusan'}
              {screen === 'impor' && 'Impor Data Excel / CSV'}
              {screen === 'cadangan' && 'Cadangan & Pemulihan'}
              {screen === 'pengaturan' && 'Pengaturan Aplikasi'}
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

            {screen === 'kenaikan' && (
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                Modul Kenaikan Kelas & Kelulusan dijadwalkan pada rilis 0.2 (CAP-12).
              </p>
            )}
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
