import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProfilSekolah, TahunAjaran, TemaAplikasi } from '../shared/types.js';

import logoUrl from './assets/logo.png';
import { formatWaktuWib } from '../shared/tanggal.js';
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

/** Cadangan lebih lama dari ini dianggap perlu diperbarui. */
const BATAS_HARI_CADANGAN = 7;

function ringkasCadangan(iso: string | null | undefined): { aman: boolean; judul: string; teks: string } {
  if (iso === undefined) return { aman: false, judul: 'Memeriksa cadangan', teks: '' };
  if (iso === null) return { aman: false, judul: 'Belum ada cadangan', teks: 'Cadangkan sekarang agar data aman.' };
  const umurHari = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  const waktu = formatWaktuWib(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return {
    aman: umurHari <= BATAS_HARI_CADANGAN,
    judul: umurHari <= BATAS_HARI_CADANGAN ? 'Data aman' : 'Perlu dicadangkan',
    teks: `Cadangan terakhir: ${waktu}.`,
  };
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('beranda');
  const [profil, setProfil] = useState<ProfilSekolah | null>(null);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<TahunAjaran | null>(null);
  const [tema, setTema] = useState<TemaAplikasi>('putih');
  // undefined = belum diketahui; null = belum pernah ada cadangan; string = waktu ISO cadangan terakhir
  const [cadanganTerakhir, setCadanganTerakhir] = useState<string | null | undefined>(undefined);
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

  const muatCadanganTerakhir = useCallback(async () => {
    if (!window.pundi) return;
    const res = await window.pundi.backupTerakhir();
    if (res.ok) setCadanganTerakhir(res.data?.tanggal ?? null);
  }, []);

  // Dimuat ulang tiap pindah layar agar cadangan dari menu Cadangan ikut tercermin
  useEffect(() => {
    void muatCadanganTerakhir();
  }, [screen, muatCadanganTerakhir]);

  const handleQuickBackup = async () => {
    if (!window.pundi || backingUp) return;
    setBackingUp(true);
    try {
      const res = await window.pundi.backupBuat('Cadangan cepat bilah samping');
      if (res.ok) {
        await muatCadanganTerakhir();
        alert('Cadangan berhasil dibuat.');
      } else {
        alert(`Gagal membuat cadangan: ${res.pesan}`);
      }
    } finally {
      setBackingUp(false);
    }
  };

  const cadangan = ringkasCadangan(cadanganTerakhir);
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
        className="app-sidebar"
        style={{
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
        <div className="brand-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={logoUrl}
            alt=""
            width={44}
            height={44}
            style={{ borderRadius: '10px', flexShrink: 0, background: '#FFFFFF', objectFit: 'contain' }}
          />
          <div className="rail-hide-visually">
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
                className="nav-item"
                title={n.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
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
                <div className="nav-item-inner" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'inline-flex', opacity: isActive ? 1 : 0.85 }}>
                    <Icon width={16} height={16} />
                  </span>
                  <span className="rail-hide-visually">{n.label}</span>
                </div>
                {n.pintasan ? (
                  <span
                    className="rail-hide-visually"
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
                    className="rail-hide-visually"
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

        {/* Status cadangan nyata (bukan teks tetap) + tombol cadangan cepat */}
        <div style={{ padding: '14px', borderTop: '1px solid var(--sidebar-border)' }}>
          <div
            className="sidebar-backup-card"
            title={`${cadangan.judul}. ${cadangan.teks}`}
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
                aria-hidden="true"
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '9999px',
                  backgroundColor: cadangan.aman ? 'var(--ok)' : 'var(--warn)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span className="rail-hide-visually" style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                {cadangan.judul}
              </span>
            </div>
            {cadangan.teks && (
              <p className="rail-hide-visually" style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.35 }}>
                {cadangan.teks}
              </p>
            )}
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
              <span className="rail-only" aria-hidden="true">
                <IconCadangan width={16} height={16} />
              </span>
              <span className="full-label">{backingUp ? 'Mencadangkan...' : 'Cadangkan sekarang'}</span>
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
