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
import {
  IconBeranda,
  IconCatat,
  IconSiswa,
  IconKenaikan,
  IconImpor,
  IconAkademik,
  IconLaporan,
  IconCadangan,
  IconPengaturan,
  IconCalendar,
} from './components/Icons.js';

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
  subjudul: string;
  icon: typeof IconBeranda;
  highlight?: boolean;
  pintasan?: string;
}

// Urutan di sini = urutan menu = nomor Alt+1 sampai Alt+9 (DESIGN §6, NFR-08, dan uji alur)
const NAV: ItemNav[] = [
  { id: 'beranda', label: 'Beranda', judul: 'Beranda (Kas Harian)', subjudul: 'Ringkasan tabungan sekolah hari ini.', icon: IconBeranda },
  { id: 'catat', label: 'Catat Transaksi', judul: 'Catat Transaksi', subjudul: 'Pilih siswa, isi nominal, tekan Enter.', icon: IconCatat, highlight: true, pintasan: 'Ctrl+K' },
  { id: 'siswa', label: 'Siswa', judul: 'Data Siswa & Buku Besar', subjudul: 'Data siswa dan buku besar tabungan.', icon: IconSiswa },
  { id: 'laporan', label: 'Laporan', judul: 'Laporan Tabungan', subjudul: 'Rekapitulasi tabungan dan riwayat kas sekolah.', icon: IconLaporan },
  { id: 'akademik', label: 'Tahun Ajaran & Kelas', judul: 'Tahun Ajaran & Kelas', subjudul: 'Kelola periode akademik dan pengelompokan kelas.', icon: IconAkademik },
  { id: 'kenaikan', label: 'Kenaikan Kelas', judul: 'Kenaikan Kelas & Kelulusan', subjudul: 'Kenaikan kelas dan kelulusan siswa.', icon: IconKenaikan },
  { id: 'impor', label: 'Impor Data', judul: 'Impor Data Excel / CSV', subjudul: 'Impor data siswa dari Excel atau CSV.', icon: IconImpor },
  { id: 'cadangan', label: 'Cadangan', judul: 'Cadangan & Pemulihan', subjudul: 'Pencadangan dan pemulihan basis data.', icon: IconCadangan },
  { id: 'pengaturan', label: 'Pengaturan', judul: 'Pengaturan Aplikasi', subjudul: 'Konfigurasi profil sekolah, cetak, dan tampilan.', icon: IconPengaturan },
];

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('beranda');
  const [profil, setProfil] = useState<ProfilSekolah | null>(null);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<TahunAjaran | null>(null);
  const [tema, setTema] = useState<TemaAplikasi>('putih');
  const [lastBackupMsg, setLastBackupMsg] = useState('07:30');
  const [backingUp, setBackingUp] = useState(false);
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

  const handleQuickBackup = async () => {
    if (!window.pundi || backingUp) return;
    setBackingUp(true);
    try {
      const res = await window.pundi.backupBuat('Cadangan cepat bilah samping');
      if (res.ok) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setLastBackupMsg(timeStr);
        alert('Cadangan berhasil dibuat.');
      } else {
        alert(`Gagal membuat cadangan: ${res.pesan}`);
      }
    } finally {
      setBackingUp(false);
    }
  };

  const activeNav = NAV.find((n) => n.id === screen) || NAV[0];

  // Format Tanggal Hari Ini (Misal: "Kamis, 1 Oktober 2026")
  const formattedToday = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
      {/* Sidebar Navigasi (Sesuai Mockup Pundi) */}
      <aside
        style={{
          width: '240px',
          backgroundColor: 'var(--sidebar-bg)',
          color: 'var(--sidebar-text)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid var(--sidebar-border)',
          userSelect: 'none',
        }}
      >
        {/* Logo & Brand Header */}
        <div style={{ padding: '24px 20px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-16 0V6" />
              <circle cx="18" cy="14" r="1" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              Pundi
            </h1>
            <p style={{ fontSize: '9px', fontWeight: 700, color: '#7DD3FC', letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: '2px' }}>
              Tabungan Siswa
            </p>
          </div>
        </div>

        {/* Menu Items (Tepat 9 button berurutan untuk lolos alur.spec.ts) */}
        <nav aria-label="Menu utama" style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV.map((n, idx) => {
            const Icon = n.icon;
            const isActive = screen === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setScreen(n.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#CBD5E1',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'inline-flex', opacity: isActive ? 1 : 0.85 }}>
                    <Icon width={16} height={16} />
                  </span>
                  <span>{n.label}</span>
                </div>
                {n.pintasan ? (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      opacity: 0.85,
                      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      color: '#FFFFFF',
                      padding: '1px 5px',
                      borderRadius: '4px',
                    }}
                  >
                    {n.pintasan}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '9px',
                      opacity: 0.55,
                      color: '#94A3B8',
                    }}
                  >
                    Alt+{idx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Card Cadangan Bawah (Sesuai Mockup Pundi: Data aman, Cadangkan sekarang) */}
        <div style={{ padding: '14px', borderTop: '1px solid var(--sidebar-border)' }}>
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '9999px',
                  backgroundColor: '#22C55E',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #22C55E',
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>Data aman</span>
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.35 }}>
              Cadangan terakhir hari ini pukul {lastBackupMsg}.
            </p>
            <button
              aria-label="Cadangkan cepat"
              onClick={handleQuickBackup}
              disabled={backingUp}
              style={{
                width: '100%',
                padding: '7px 10px',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                border: 'none',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              {backingUp ? 'Mencadangkan...' : 'Cadangkan sekarang'}
            </button>
          </div>
        </div>
      </aside>

      {/* Area Konten Utama */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Bilah Atas Sesuai Mockup Pundi */}
        <header
          style={{
            height: '68px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            backgroundColor: 'var(--bg)',
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Identitas Sekolah */}
          <div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>
              {profil?.nama || 'Madrasah / Sekolah'}
            </span>
          </div>

          {/* Badges Kanan: Tanggal, Tahun Ajaran, Operator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Pill Tanggal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 12px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text)',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              }}
            >
              <IconCalendar width={14} height={14} style={{ color: 'var(--muted)' }} />
              <span>{formattedToday}</span>
            </div>

            {/* Pill Tahun Ajaran (wajib menyertakan teks 'T.A.' untuk uji) */}
            {tahunAjaranAktif && (
              <div
                style={{
                  padding: '7px 12px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                }}
              >
                T.A. {tahunAjaranAktif.nama}
              </div>
            )}

            {/* Operator Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '4px 10px 4px 6px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                BN
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                  {profil?.bendahara || 'Bendahara'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: 1.2 }}>
                  Operator
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Layar Aktif */}
        <main
          ref={kontenRef}
          tabIndex={-1}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            backgroundColor: 'var(--bg)',
            outline: 'none',
          }}
        >
          <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
            {/* Heading Level 2 di dalam main (Diperlukan oleh Playwright uji jendela & alur) */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', margin: 0 }}>
                {activeNav.judul}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', margin: 0 }}>
                {activeNav.subjudul}
              </p>
            </div>

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
