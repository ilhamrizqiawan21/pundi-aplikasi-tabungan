import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProfilSekolahTampilan, StatusKunci, TahunAjaran, TemaAplikasi } from '../shared/types.js';
import { LayarKunci } from './components/LayarKunci.js';
import { Button, ToastProvider, useToast } from './components/ui/index.js';

import logoUrl from './assets/logo.png';
import './styles/app-shell.css';
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
import { BantuanScreen } from './screens/BantuanScreen.js';
import { OnboardingWizardModal } from './components/OnboardingWizardModal.js';
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
  IconPanelKiri,
  IconCalendar,
  getInitials,
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
  | 'pengaturan'
  | 'bantuan';

interface ItemNav {
  id: ScreenId;
  label: string;
  judul: string;
  subjudul: string;
  icon: typeof IconBeranda;
  highlight?: boolean;
  grup: GrupNav;
}

type GrupNav = 'harian' | 'data' | 'sistem';

// Kelompok menu (palet warna di tokens.css). Urutan NAV tetap = Alt+1..9, kelompok selalu berurutan
const LABEL_GRUP: Record<GrupNav, string> = { harian: 'Harian', data: 'Data & Laporan', sistem: 'Sistem' };
const KUNCI_BILAH_SAMPING = 'pundi.bilahSamping';
/** Di bawah lebar ini bilah samping selalu menjadi rel ikon (sama dengan titik henti layout.css). */
const LEBAR_REL_PAKSA = '(max-width: 1099px)';

// Urutan di sini = urutan menu = nomor Alt+1 sampai Alt+9 (DESIGN §6, NFR-08, dan uji alur)
const NAV: ItemNav[] = [
  { id: 'beranda', label: 'Beranda', judul: 'Beranda (Kas Harian)', subjudul: 'Ringkasan tabungan sekolah hari ini.', icon: IconBeranda, grup: 'harian' },
  { id: 'catat', label: 'Catat Transaksi', judul: 'Catat Transaksi', subjudul: 'Pilih siswa, isi nominal, tekan Enter.', icon: IconCatat, highlight: true, grup: 'harian' },
  { id: 'siswa', label: 'Siswa', judul: 'Data Siswa & Buku Besar', subjudul: 'Data siswa dan buku besar tabungan.', icon: IconSiswa, grup: 'data' },
  { id: 'laporan', label: 'Laporan', judul: 'Laporan Tabungan', subjudul: 'Rekapitulasi tabungan dan riwayat kas sekolah.', icon: IconLaporan, grup: 'data' },
  { id: 'akademik', label: 'Tahun Ajaran & Kelas', judul: 'Tahun Ajaran & Kelas', subjudul: 'Kelola periode akademik dan pengelompokan kelas.', icon: IconAkademik, grup: 'data' },
  { id: 'kenaikan', label: 'Kenaikan Kelas', judul: 'Kenaikan Kelas & Kelulusan', subjudul: 'Kenaikan kelas dan kelulusan siswa.', icon: IconKenaikan, grup: 'data' },
  { id: 'impor', label: 'Impor Data', judul: 'Impor Data Excel / CSV', subjudul: 'Impor data siswa dari Excel atau CSV.', icon: IconImpor, grup: 'data' },
  { id: 'cadangan', label: 'Cadangan', judul: 'Cadangan & Pemulihan', subjudul: 'Pencadangan dan pemulihan basis data.', icon: IconCadangan, grup: 'sistem' },
  { id: 'pengaturan', label: 'Pengaturan', judul: 'Pengaturan Aplikasi', subjudul: 'Konfigurasi profil sekolah, cetak, dan tampilan.', icon: IconPengaturan, grup: 'sistem' },
];

// Bantuan bukan bagian menu utama (menu tetap sembilan = Alt+1..9); dibuka lewat tombol di bilah atas atau F1
const NAV_BANTUAN = { judul: 'Bantuan', subjudul: 'Panduan singkat, pintasan keyboard, dan keterangan aplikasi.' };

/** Cadangan lebih lama dari ini dianggap perlu diperbarui. */
const BATAS_HARI_CADANGAN = 7;
/** Salinan ke flashdisk/drive lain lebih lama dari ini memicu pengingat di Beranda (CAP-21). */
const BATAS_HARI_SALINAN_LUAR = 14;

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

interface AplikasiUtamaProps {
  /** PIN aktif: tombol Kunci tampil di bilah atas. */
  pinAktif: boolean;
  onKunci: () => void;
}

function AplikasiUtama({ pinAktif, onKunci }: AplikasiUtamaProps) {
  const [screen, setScreen] = useState<ScreenId>('beranda');
  const [profil, setProfil] = useState<ProfilSekolahTampilan | null>(null);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<TahunAjaran | null>(null);
  const [tema, setTema] = useState<TemaAplikasi>('putih');
  const [showOnboarding, setShowOnboarding] = useState(false);
  // undefined = belum diketahui; null = belum pernah ada cadangan; string = waktu ISO cadangan terakhir
  const [cadanganTerakhir, setCadanganTerakhir] = useState<string | null | undefined>(undefined);
  // Waktu salinan luar terakhir; undefined = belum diketahui. Pengingat dapat ditutup selama sesi ini.
  const [salinanLuarTerakhir, setSalinanLuarTerakhir] = useState<string | null | undefined>(undefined);
  const [pengingatDitutup, setPengingatDitutup] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const kontenRef = useRef<HTMLElement>(null);
  const { showToast } = useToast();
  const [bilahCiut, setBilahCiut] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KUNCI_BILAH_SAMPING) === 'ciut';
    } catch {
      return false;
    }
  });
  const [layarSempit, setLayarSempit] = useState<boolean>(() => window.matchMedia(LEBAR_REL_PAKSA).matches);
  const rel = bilahCiut || layarSempit;

  const ubahBilah = useCallback(() => {
    setBilahCiut((sekarang) => {
      const baru = !sekarang;
      try {
        localStorage.setItem(KUNCI_BILAH_SAMPING, baru ? 'ciut' : 'lebar');
      } catch {
        // penyimpanan tidak tersedia: pilihan hanya berlaku selama sesi ini
      }
      return baru;
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(LEBAR_REL_PAKSA);
    const onChange = (e: MediaQueryListEvent) => setLayarSempit(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);

  // Pintasan global (DESIGN §6). Dinonaktifkan saat dialog terbuka agar tidak berpindah layar di belakangnya.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        ubahBilah();
        return;
      }

      if (e.key === 'F1' && !mod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setScreen('bantuan');
        return;
      }

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
  }, [ubahBilah]);

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
      window.pundi.pengaturanBaca().then(async (res) => {
        if (res.ok) {
          if (res.data.tema) {
            setTema(res.data.tema);
          }
          if (!res.data.onboarding_selesai) {
            const taRes = await window.pundi.tahunAjaranDaftar();
            if (taRes.ok && taRes.data.length === 0) {
              setShowOnboarding(true);
            }
          }
        }
      });
    }
  }, [muatTahunAjaranAktif]);

  const handleOnboardingSelesai = useCallback(async (tujuanMenu?: ScreenId) => {
    setShowOnboarding(false);
    if (window.pundi) {
      const profRes = await window.pundi.profilSekolahBaca();
      if (profRes.ok) setProfil(profRes.data);
      muatTahunAjaranAktif();
    }
    if (tujuanMenu) {
      setScreen(tujuanMenu);
    }
  }, [muatTahunAjaranAktif]);

  const muatCadanganTerakhir = useCallback(async () => {
    if (!window.pundi) return;
    const res = await window.pundi.backupTerakhir();
    if (res.ok) setCadanganTerakhir(res.data?.tanggal ?? null);
    const luar = await window.pundi.backupTerakhirKeLuar();
    if (luar.ok) setSalinanLuarTerakhir(luar.data);
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
        showToast('Cadangan berhasil dibuat.');
      } else {
        showToast(`Gagal membuat cadangan: ${res.pesan}`, 'danger');
      }
    } finally {
      setBackingUp(false);
    }
  };

  const cadangan = ringkasCadangan(cadanganTerakhir);
  const umurSalinanLuar =
    salinanLuarTerakhir === undefined
      ? null
      : salinanLuarTerakhir === null
        ? Infinity
        : Math.floor((Date.now() - new Date(salinanLuarTerakhir).getTime()) / 86_400_000);
  const perluSalinanLuar = screen === 'beranda' && !pengingatDitutup && umurSalinanLuar !== null && umurSalinanLuar > BATAS_HARI_SALINAN_LUAR;
  const activeNav = screen === 'bantuan' ? NAV_BANTUAN : NAV.find((n) => n.id === screen) || NAV[0];

  // Format Tanggal Hari Ini (Misal: "Kamis, 1 Oktober 2026")
  const formattedToday = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="app-shell">
      {/* Bilah samping: navigasi utama */}
      <aside className={rel ? 'app-sidebar ciut' : 'app-sidebar'} id="bilah-samping">
        {/* Logo & Brand Header */}
        <div className="brand-header">
          <img src={logoUrl} alt="" width={44} height={44} className="brand-logo" />
          <div className="rail-hide-visually brand-teks">
            <h1 className="brand-nama">Pundi</h1>
            <p className="brand-tagline">Tabungan Siswa</p>
          </div>
          {!layarSempit && (
            <button
              type="button"
              className="sidebar-toggle"
              onClick={ubahBilah}
              aria-expanded={!bilahCiut}
              aria-controls="bilah-samping"
              aria-label={bilahCiut ? 'Bentangkan bilah samping' : 'Ciutkan bilah samping'}
              title={bilahCiut ? 'Bentangkan bilah samping (Ctrl+B)' : 'Ciutkan bilah samping (Ctrl+B)'}
            >
              <IconPanelKiri width={16} height={16} />
            </button>
          )}
        </div>

        {/* Menu utama: sembilan tombol, urutannya sama dengan pintasan Alt+1 sampai Alt+9 */}
        <nav aria-label="Menu utama" className="sidebar-nav">
          {(['harian', 'data', 'sistem'] as GrupNav[]).map((g) => (
            <div key={g} role="group" aria-label={LABEL_GRUP[g]} className={`nav-grup nav-grup-${g}`}>
              <div className="nav-grup-label" aria-hidden="true">
                {LABEL_GRUP[g]}
              </div>
              {NAV.filter((n) => n.grup === g).map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setScreen(n.id)}
                    aria-current={screen === n.id ? 'page' : undefined}
                    className="nav-item"
                    title={n.label}
                  >
                    <div className="nav-item-inner">
                      <span className="nav-item-ikon">
                        <Icon width={16} height={16} />
                      </span>
                      <span className="rail-hide-visually">{n.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Status cadangan nyata (bukan teks tetap) + tombol cadangan cepat */}
        <div className="sidebar-footer">
          <div className="sidebar-backup-card" title={`${cadangan.judul}. ${cadangan.teks}`}>
            <div className="sidebar-backup-status">
              <span aria-hidden="true" className={cadangan.aman ? 'sidebar-backup-titik aman' : 'sidebar-backup-titik'} />
              <span className="rail-hide-visually sidebar-backup-judul">{cadangan.judul}</span>
            </div>
            {cadangan.teks && <p className="rail-hide-visually sidebar-backup-teks">{cadangan.teks}</p>}
            <button
              aria-label="Cadangkan cepat"
              onClick={handleQuickBackup}
              disabled={backingUp}
              className="sidebar-backup-tombol"
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
      <div className="app-shell-isi">
        {/* Bilah atas: sekolah, tanggal, tahun ajaran, operator */}
        <header className="app-header">
          {/* Identitas Sekolah */}
          <div className="header-sekolah-wrap">
            <span className="header-sekolah-text">{profil?.nama || 'Madrasah / Sekolah'}</span>
          </div>

          {/* Badges Kanan: Tanggal, Tahun Ajaran, Operator */}
          <div className="header-badges-container">
            {/* Pill Tanggal */}
            <div className="header-pill">
              <IconCalendar width={14} height={14} className="header-pill-ikon" />
              <span>{formattedToday}</span>
            </div>

            {/* Pill Tahun Ajaran (wajib menyertakan teks 'T.A.' untuk uji) */}
            {tahunAjaranAktif && <div className="header-pill header-pill-ta">T.A. {tahunAjaranAktif.nama}</div>}

            <Button
              type="button"
              size="sm"
              className="header-bantuan"
              onClick={() => setScreen('bantuan')}
              aria-current={screen === 'bantuan' ? 'page' : undefined}
              title="Bantuan (F1)"
            >
              Bantuan
            </Button>

            {pinAktif && (
              <Button type="button" size="sm" onClick={onKunci} title="Kunci aplikasi sekarang">
                Kunci
              </Button>
            )}

            {/* Operator Pill */}
            <div className="header-pill header-pill-operator">
              <div className="header-avatar">{getInitials(profil?.bendahara || 'Bendahara')}</div>
              <div className="header-operator-teks">
                <span className="header-operator-nama">{profil?.bendahara || 'Bendahara'}</span>
                <span className="header-operator-peran">Operator</span>
              </div>
            </div>
          </div>
        </header>

        {/* Layar Aktif */}
        <main ref={kontenRef} tabIndex={-1} className="app-main-content">
          <div className="app-konten-lebar">
            {/* Judul layar aktif */}
            <div className="app-judul-layar">
              <h2>{activeNav.judul}</h2>
              <p>{activeNav.subjudul}</p>
            </div>

            {perluSalinanLuar && (
              <div role="region" aria-label="Pengingat salinan cadangan" className="pengingat-salinan">
                <span>
                  <strong>Simpan salinan data di flashdisk.</strong>{' '}
                  {umurSalinanLuar === Infinity
                    ? 'Belum pernah ada salinan di luar komputer ini. Bila komputer rusak, data tabungan bisa hilang.'
                    : `Salinan terakhir di luar komputer ini ${umurSalinanLuar} hari lalu.`}
                </span>
                <span className="pengingat-salinan-aksi">
                  <Button type="button" size="sm" onClick={() => setPengingatDitutup(true)}>
                    Nanti saja
                  </Button>
                  <Button type="button" size="sm" variant="primary" onClick={() => setScreen('cadangan')}>
                    Salin sekarang
                  </Button>
                </span>
              </div>
            )}

            <div key={screen} className="animate-fade-in">
              {screen === 'beranda' && (
                <>
                  {showOnboarding && (
                    <OnboardingWizardModal
                      terbuka={showOnboarding}
                      onSelesai={handleOnboardingSelesai}
                    />
                  )}
                  <BerandaScreen onGoToCatat={() => setScreen('catat')} />
                </>
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
              {screen === 'bantuan' && <BantuanScreen />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Pintu masuk aplikasi (CAP-16): bila PIN aktif dan belum dibuka, hanya halaman PIN yang tampil dan tidak ada
 * data yang dimuat. Layar utama baru dipasang setelah kunci terbuka.
 */
export default function App() {
  const [status, setStatus] = useState<StatusKunci | null>(null);

  const muatStatus = useCallback(async () => {
    const r = await window.pundi.kunciStatus();
    if (r.ok) setStatus(r.data);
  }, []);

  useEffect(() => {
    if (!window.pundi) return; // mode pratinjau di peramban biasa (tanpa Electron)
    void muatStatus();
    window.addEventListener('pundi:kunci-berubah', muatStatus);
    return () => window.removeEventListener('pundi:kunci-berubah', muatStatus);
  }, [muatStatus]);

  if (!window.pundi) return <ToastProvider><AplikasiUtama pinAktif={false} onKunci={() => undefined} /></ToastProvider>;
  if (!status) return null;
  if (status.aktif && !status.terbuka) return <LayarKunci onBuka={muatStatus} />;
  return (
    <ToastProvider>
      <AplikasiUtama
        pinAktif={status.aktif}
        onKunci={async () => {
          await window.pundi.kunciKunciSekarang();
          await muatStatus();
        }}
      />
    </ToastProvider>
  );
}
