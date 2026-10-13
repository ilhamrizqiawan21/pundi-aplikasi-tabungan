import { useState, useEffect, useRef, type FormEvent } from 'react';
import clsx from 'clsx';
import type { ProfilSekolahInput } from '../../shared/types.js';
import type { ScreenId } from '../App.js';
import { Button, Input, Field, Badge } from './ui/index.js';
import './OnboardingWizardModal.css';

interface OnboardingWizardModalProps {
  terbuka: boolean;
  onSelesai: (tujuanMenu?: ScreenId) => void;
}

type Step = 'profil' | 'tahun_ajaran' | 'kelas' | 'siswa';

export function OnboardingWizardModal({ terbuka, onSelesai }: OnboardingWizardModalProps) {
  const [step, setStep] = useState<Step>('profil');
  const [loading, setLoading] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Form Step 1: Profil
  const [namaSekolah, setNamaSekolah] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kota, setKota] = useState('');
  const [bendahara, setBendahara] = useState('');
  const [kepala, setKepala] = useState('');

  // Form Step 2: Tahun Ajaran
  const tahunIni = new Date().getFullYear();
  const [namaTahunAjaran, setNamaTahunAjaran] = useState(`${tahunIni}/${tahunIni + 1}`);
  const [mulaiTahun, setMulaiTahun] = useState(`${tahunIni}-07-01`);
  const [selesaiTahun, setSelesaiTahun] = useState(`${tahunIni + 1}-06-30`);
  const [createdTahunAjaranId, setCreatedTahunAjaranId] = useState<number | null>(null);

  // Form Step 3: Kelas
  const [tingkatKelas, setTingkatKelas] = useState(7);
  const [namaKelas, setNamaKelas] = useState('7A');
  const [kelasList, setKelasList] = useState<Array<{ id: number; nama: string; tingkat: number }>>([]);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terbuka) {
      firstInputRef.current?.focus();
    }
  }, [terbuka, step]);

  if (!terbuka) return null;

  // Keyboard trap focus & Escape navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      // Esc bertingkat: tidak langsung menutup tanpa konfirmasi jika data sudah diisi
    }
  };

  const handleSelesaikanSemua = async (tujuanMenu?: ScreenId) => {
    setLoading(true);
    try {
      await window.pundi.pengaturanSimpan({ onboarding_selesai: true });
      onSelesai(tujuanMenu);
    } catch {
      setGalat('Gagal menyimpan status penyiapan.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1 Submit: Simpan Profil
  const handleSubmitProfil = async (e: FormEvent) => {
    e.preventDefault();
    if (!namaSekolah.trim()) {
      setGalat('Nama sekolah atau madrasah wajib diisi.');
      return;
    }
    setLoading(true);
    setGalat(null);
    try {
      const profilData: ProfilSekolahInput = {
        nama: namaSekolah.trim(),
        alamat: alamat.trim() || null,
        kota: kota.trim() || null,
        bendahara: bendahara.trim() || null,
        kepala: kepala.trim() || null,
      };
      const res = await window.pundi.profilSekolahSimpan(profilData);
      if (res.ok) {
        setStep('tahun_ajaran');
      } else {
        setGalat(res.pesan || 'Gagal menyimpan profil sekolah.');
      }
    } catch {
      setGalat('Terjadi galat saat menyimpan profil.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Submit: Simpan Tahun Ajaran
  const handleSubmitTahunAjaran = async (e: FormEvent) => {
    e.preventDefault();
    if (!namaTahunAjaran.trim()) {
      setGalat('Nama tahun ajaran wajib diisi.');
      return;
    }
    setLoading(true);
    setGalat(null);
    try {
      const res = await window.pundi.tahunAjaranSimpan({
        nama: namaTahunAjaran.trim(),
        mulai: mulaiTahun,
        selesai: selesaiTahun,
        aktif: true,
      });
      if (res.ok) {
        setCreatedTahunAjaranId(res.data.id);
        setStep('kelas');
      } else {
        setGalat(res.pesan || 'Gagal menyimpan tahun ajaran.');
      }
    } catch {
      setGalat('Terjadi galat saat menyimpan tahun ajaran.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Tambah Kelas Tunggal
  const handleTambahKelas = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!createdTahunAjaranId) {
      setGalat('Tahun ajaran belum dibuat. Silakan kembali ke langkah sebelumnya.');
      return;
    }
    if (!namaKelas.trim()) {
      setGalat('Nama kelas wajib diisi.');
      return;
    }
    setLoading(true);
    setGalat(null);
    try {
      const res = await window.pundi.kelasSimpan({
        tahun_ajaran_id: createdTahunAjaranId,
        nama: namaKelas.trim(),
        tingkat: tingkatKelas,
        urutan: kelasList.length + 1,
      });
      if (res.ok) {
        setKelasList((prev) => [...prev, { id: res.data.id, nama: res.data.nama, tingkat: res.data.tingkat }]);
        setNamaKelas('');
      } else {
        setGalat(res.pesan || 'Gagal menambahkan kelas.');
      }
    } catch {
      setGalat('Terjadi galat saat menyimpan kelas.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Buat Preset Kelas Otomatis
  const handleBuatPresetKelas = async (daftarNama: string[], tingkat: number) => {
    if (!createdTahunAjaranId) return;
    setLoading(true);
    setGalat(null);
    try {
      for (let i = 0; i < daftarNama.length; i++) {
        const res = await window.pundi.kelasSimpan({
          tahun_ajaran_id: createdTahunAjaranId,
          nama: daftarNama[i],
          tingkat,
          urutan: kelasList.length + i + 1,
        });
        if (res.ok) {
          setKelasList((prev) => [...prev, { id: res.data.id, nama: res.data.nama, tingkat: res.data.tingkat }]);
        }
      }
    } catch {
      setGalat('Gagal membuat kelas otomatis.');
    } finally {
      setLoading(false);
    }
  };

  const stepsList: Array<{ id: Step; label: string; nomor: number }> = [
    { id: 'profil', label: '1. Profil Sekolah', nomor: 1 },
    { id: 'tahun_ajaran', label: '2. Tahun Ajaran', nomor: 2 },
    { id: 'kelas', label: '3. Data Kelas', nomor: 3 },
    { id: 'siswa', label: '4. Siswa & Mulai', nomor: 4 },
  ];

  return (
    <section
      ref={modalRef}
      role="region"
      aria-label="Selamat Datang di Pundi"
      className="onboarding-wizard"
      onKeyDown={handleKeyDown}
    >
      {/* Header Wizard */}
      <div className="onb-kepala">
        <div className="onb-kepala-baris">
          <div>
            <h3 id="onboarding-judul" className="onb-judul">Selamat Datang di Pundi</h3>
            <p id="onboarding-deskripsi" className="onb-deskripsi">
              Penyiapan awal aplikasi untuk pencatatan tabungan siswa yang rapi dan aman.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSelesaikanSemua()}
            disabled={loading}
            title="Lewati penyiapan wizard dan atur nanti"
          >
            Lewati Semua
          </Button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="onb-stepper">
          {stepsList.map((s) => {
            const aktif = step === s.id;
            const lewat = stepsList.findIndex((item) => item.id === step) > stepsList.findIndex((item) => item.id === s.id);
            return (
              <div key={s.id} className={clsx('onb-langkah', aktif && 'aktif', lewat && 'lewat')}>
                {s.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Wizard */}
      <div className="onb-isi">
        {galat && (
          <div role="alert" className="onb-galat">
            {galat}
          </div>
        )}

        {step === 'profil' && (
          <form onSubmit={handleSubmitProfil} className="onb-form">
            <Field label="Nama Sekolah / Madrasah" htmlFor="onb-sekolah" required>
              <Input
                ref={firstInputRef}
                id="onb-sekolah"
                value={namaSekolah}
                onChange={(e) => setNamaSekolah(e.target.value)}
                placeholder="Contoh: SMP Negeri 1 Contoh"
                required
              />
            </Field>

            <div className="onb-grid-2">
              <Field label="Kota / Kabupaten" htmlFor="onb-kota">
                <Input
                  id="onb-kota"
                  value={kota}
                  onChange={(e) => setKota(e.target.value)}
                  placeholder="Contoh: Bandung"
                />
              </Field>
              <Field label="Alamat Singkat" htmlFor="onb-alamat">
                <Input
                  id="onb-alamat"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Contoh: Jl. Merdeka No. 10"
                />
              </Field>
            </div>

            <div className="onb-grid-2">
              <Field label="Nama Bendahara" htmlFor="onb-bendahara">
                <Input
                  id="onb-bendahara"
                  value={bendahara}
                  onChange={(e) => setBendahara(e.target.value)}
                  placeholder="Nama pengelola tabungan"
                />
              </Field>
              <Field label="Nama Kepala Sekolah" htmlFor="onb-kepala">
                <Input
                  id="onb-kepala"
                  value={kepala}
                  onChange={(e) => setKepala(e.target.value)}
                  placeholder="Nama kepala sekolah"
                />
              </Field>
            </div>

            <div className="onb-aksi">
              <Button type="button" variant="secondary" onClick={() => setStep('tahun_ajaran')}>
                Lewati Langkah Ini
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan & Lanjut'}
              </Button>
            </div>
          </form>
        )}

        {step === 'tahun_ajaran' && (
          <form onSubmit={handleSubmitTahunAjaran} className="onb-form">
            <Field label="Nama Tahun Ajaran" htmlFor="onb-ta-nama" required>
              <Input
                ref={firstInputRef}
                id="onb-ta-nama"
                value={namaTahunAjaran}
                onChange={(e) => setNamaTahunAjaran(e.target.value)}
                placeholder="Contoh: 2026/2027"
                required
              />
            </Field>

            <div className="onb-grid-2">
              <Field label="Tanggal Mulai" htmlFor="onb-ta-mulai" required>
                <Input
                  id="onb-ta-mulai"
                  type="date"
                  value={mulaiTahun}
                  onChange={(e) => setMulaiTahun(e.target.value)}
                  required
                />
              </Field>
              <Field label="Tanggal Selesai" htmlFor="onb-ta-selesai" required>
                <Input
                  id="onb-ta-selesai"
                  type="date"
                  value={selesaiTahun}
                  onChange={(e) => setSelesaiTahun(e.target.value)}
                  required
                />
              </Field>
            </div>

            <p className="onb-catatan">
              Tahun ajaran ini akan otomatis diaktifkan untuk pencatatan siswa dan tabungan.
            </p>

            <div className="onb-aksi-sebaris">
              <Button type="button" variant="ghost" onClick={() => setStep('profil')}>
                Kembali
              </Button>
              <div className="onb-aksi-kelompok">
                <Button type="button" variant="secondary" onClick={() => setStep('kelas')}>
                  Lewati Langkah Ini
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan & Lanjut ke Kelas'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {step === 'kelas' && (
          <div className="onb-kolom">
            <div>
              <div className="onb-subjudul">Tambahkan Kelas untuk Siswa</div>
              <p className="onb-catatan-nol">
                Kelas memudahkan pencatatan setoran massal per kelas dan rekap tabungan.
              </p>
            </div>

            {/* Form Tambah Kelas Satuan */}
            <form onSubmit={handleTambahKelas} className="onb-form-kelas">
              <div className="onb-field-tingkat">
                <Field label="Tingkat" htmlFor="onb-tingkat">
                  <Input
                    id="onb-tingkat"
                    type="number"
                    min={1}
                    max={20}
                    value={tingkatKelas}
                    onChange={(e) => setTingkatKelas(Number(e.target.value))}
                  />
                </Field>
              </div>
              <div className="onb-field-nama">
                <Field label="Nama Kelas" htmlFor="onb-nama-kelas">
                  <Input
                    ref={firstInputRef}
                    id="onb-nama-kelas"
                    value={namaKelas}
                    onChange={(e) => setNamaKelas(e.target.value)}
                    placeholder="Contoh: 7A"
                  />
                </Field>
              </div>
              <Button type="submit" variant="secondary" disabled={loading || !namaKelas.trim()}>
                + Tambah
              </Button>
            </form>

            {/* Tombol Preset Cepat */}
            <div className="onb-preset">
              <span className="onb-preset-label">Atau buat kelas otomatis dengan 1 klik:</span>
              <div className="onb-preset-daftar">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBuatPresetKelas(['7A', '7B', '8A', '8B', '9A', '9B'], 7)}
                  disabled={loading}
                >
                  + Buat 7A-7B, 8A-8B, 9A-9B (SMP/MTs)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBuatPresetKelas(['1A', '1B', '2A', '2B', '3A', '3B'], 1)}
                  disabled={loading}
                >
                  + Buat 1A-1B, 2A-2B, 3A-3B (SD/MI)
                </Button>
              </div>
            </div>

            {/* Daftar Kelas yang Sudah Dibuat */}
            <div className="onb-daftar-kelas">
              <div className="onb-daftar-kelas-judul">Kelas yang Terdaftar ({kelasList.length}):</div>
              {kelasList.length === 0 ? (
                <div className="onb-daftar-kosong">
                  Belum ada kelas yang ditambahkan. Anda dapat membuatnya nanti di menu Akademik.
                </div>
              ) : (
                <div className="onb-preset-daftar">
                  {kelasList.map((k) => (
                    <Badge key={k.id} variant="neutral">
                      Kelas {k.nama} (Tingkat {k.tingkat})
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="onb-aksi-sebaris rapat">
              <Button type="button" variant="ghost" onClick={() => setStep('tahun_ajaran')}>
                Kembali
              </Button>
              <div className="onb-aksi-kelompok">
                <Button type="button" variant="secondary" onClick={() => setStep('siswa')}>
                  Lewati Langkah Ini
                </Button>
                <Button type="button" variant="primary" onClick={() => setStep('siswa')}>
                  Lanjut ke Siswa
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'siswa' && (
          <div className="onb-selesai">
            <div>
              <div className="onb-centang">✓</div>
              <div className="onb-selesai-judul">Penyiapan Awal Selesai!</div>
              <p className="onb-selesai-teks">
                Sekolah dan tahun ajaran Anda sudah siap. Anda dapat mengimpor data siswa dari berkas Excel/CSV atau langsung mulai mencatat tabungan.
              </p>
            </div>

            <div className="onb-pilihan">
              <div className="onb-kartu-pilihan">
                <div>
                  <div className="onb-kartu-judul">Impor dari Excel / CSV</div>
                  <div className="onb-kartu-teks">
                    Punya daftar siswa di file Excel? Impor sekaligus bersama saldo awal jika ada.
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="onb-kartu-tombol"
                  onClick={() => handleSelesaikanSemua('impor')}
                  disabled={loading}
                >
                  Buka Menu Impor
                </Button>
              </div>

              <div className="onb-kartu-pilihan">
                <div>
                  <div className="onb-kartu-judul">Mulai Masuk Aplikasi</div>
                  <div className="onb-kartu-teks">
                    Buka Beranda dan mulai tambahkan siswa atau langsung catat transaksi.
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="onb-kartu-tombol"
                  onClick={() => handleSelesaikanSemua('beranda')}
                  disabled={loading}
                >
                  Buka Beranda
                </Button>
              </div>
            </div>

            <div className="onb-aksi-awal">
              <Button type="button" variant="ghost" onClick={() => setStep('kelas')}>
                Kembali
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
