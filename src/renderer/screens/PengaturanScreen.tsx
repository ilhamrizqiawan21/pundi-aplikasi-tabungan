import { useState, useEffect, type FormEvent } from 'react';
import type { TemaAplikasi, UkuranStruk, HasilPeriksaIntegritas } from '../../shared/types.js';
import './PengaturanScreen.css';
import { KeamananPanel } from '../components/KeamananPanel.js';
import { RiwayatAktivitasPanel } from '../components/RiwayatAktivitasPanel.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from '../components/ui/index.js';

interface PengaturanScreenProps {
  onThemeChange: (tema: TemaAplikasi) => void;
}

export function PengaturanScreen({ onThemeChange }: PengaturanScreenProps) {
  // Profil
  const [nama, setNama] = useState('Madrasah / Sekolah');
  const [alamat, setAlamat] = useState('');
  const [kota, setKota] = useState('');
  const [bendahara, setBendahara] = useState('');
  const [kepala, setKepala] = useState('');

  // Pengaturan
  const [tema, setTema] = useState<TemaAplikasi>('putih');
  const [ukuranStruk, setUkuranStruk] = useState<UkuranStruk>('80');

  // Integritas (CAP-17)
  const [hasilIntegritas, setHasilIntegritas] = useState<HasilPeriksaIntegritas | null>(null);
  const [checkingIntegritas, setCheckingIntegritas] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    window.pundi.profilSekolahBaca().then((res) => {
      if (res.ok) {
        setNama(res.data.nama || '');
        setAlamat(res.data.alamat || '');
        setKota(res.data.kota || '');
        setBendahara(res.data.bendahara || '');
        setKepala(res.data.kepala || '');
      }
    });

    window.pundi.pengaturanBaca().then((res) => {
      if (res.ok) {
        setTema(res.data.tema);
        setUkuranStruk(res.data.ukuran_struk);
      }
    });
  }, []);

  const handleSimpanProfil = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const pRes = await window.pundi.profilSekolahSimpan({
        nama,
        alamat: alamat.trim() || null,
        kota: kota.trim() || null,
        bendahara: bendahara.trim() || null,
        kepala: kepala.trim() || null,
      });

      const sRes = await window.pundi.pengaturanSimpan({
        tema,
        ukuran_struk: ukuranStruk,
      });

      if (pRes.ok && sRes.ok) {
        onThemeChange(tema);
        setMsg({ text: 'Pengaturan dan profil sekolah berhasil disimpan.', type: 'ok' });
      } else {
        setMsg({ text: 'Gagal menyimpan pengaturan.', type: 'err' });
      }
    } catch {
      setMsg({ text: 'Terjadi kesalahan sistem saat menyimpan pengaturan.', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  const handlePeriksaIntegritas = async () => {
    setCheckingIntegritas(true);
    setHasilIntegritas(null);
    try {
      const res = await window.pundi.integritasPeriksa();
      if (res.ok) {
        setHasilIntegritas(res.data);
      }
    } finally {
      setCheckingIntegritas(false);
    }
  };

  return (
    <div className="pg-halaman">
      {msg && (
        <div
          role={msg.type === 'err' ? 'alert' : 'status'}
          className={`pg-pesan ${msg.type === 'ok' ? 'pg-pesan-ok' : 'pg-pesan-err'}`}
        >
          {msg.text}
        </div>
      )}

      {/* Form Profil Sekolah */}
      <form onSubmit={handleSimpanProfil}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profil sekolah</CardTitle>
              <CardDescription>Nama dan informasi sekolah untuk kop dokumen dan struk cetak</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pg-isi">
            <div>
              <label htmlFor="profil-nama" className="pg-label">
                Nama Sekolah / Lembaga <span className="pg-wajib">*</span>
              </label>
              <input
                id="profil-nama"
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="pg-kontrol"
              />
            </div>

            <div className="pg-grid-dua">
              <div>
                <label htmlFor="profil-alamat" className="pg-label">
                  Alamat Sekolah
                </label>
                <input
                  id="profil-alamat"
                  type="text"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Contoh: Jl. Diponegoro No. 45"
                  className="pg-kontrol"
                />
              </div>

              <div>
                <label htmlFor="profil-kota" className="pg-label">
                  Kota / Kabupaten
                </label>
                <input
                  id="profil-kota"
                  type="text"
                  value={kota}
                  onChange={(e) => setKota(e.target.value)}
                  placeholder="Contoh: Surakarta"
                  className="pg-kontrol"
                />
              </div>
            </div>

            <div className="pg-grid-dua">
              <div>
                <label htmlFor="profil-bendahara" className="pg-label">
                  Nama Bendahara Tabungan
                </label>
                <input
                  id="profil-bendahara"
                  type="text"
                  value={bendahara}
                  onChange={(e) => setBendahara(e.target.value)}
                  placeholder="Nama bendahara"
                  className="pg-kontrol"
                />
              </div>

              <div>
                <label htmlFor="profil-kepala" className="pg-label">
                  Nama Kepala Sekolah / Madrasah
                </label>
                <input
                  id="profil-kepala"
                  type="text"
                  value={kepala}
                  onChange={(e) => setKepala(e.target.value)}
                  placeholder="Nama kepala sekolah"
                  className="pg-kontrol"
                />
              </div>
            </div>

            <div className="pg-tampilan">
              <CardTitle className="pg-tampilan-judul">Tampilan dan cetak</CardTitle>

              <div className="pg-grid-dua">
                <div>
                  <label htmlFor="tema-select" className="pg-label">
                    Tema Tampilan
                  </label>
                  <select
                    id="tema-select"
                    value={tema}
                    onChange={(e) => {
                      const newTheme = e.target.value as TemaAplikasi;
                      setTema(newTheme);
                      onThemeChange(newTheme);
                    }}
                    className="pg-kontrol"
                  >
                    <option value="putih">Putih (Bawaan)</option>
                    <option value="hijau">Hijau</option>
                    <option value="biru">Biru</option>
                    <option value="ungu">Ungu</option>
                    <option value="grafit">Grafit (Gelap)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ukuran-struk-select" className="pg-label">
                    Ukuran Struk Bukti Transaksi
                  </label>
                  <select
                    id="ukuran-struk-select"
                    value={ukuranStruk}
                    onChange={(e) => setUkuranStruk(e.target.value as UkuranStruk)}
                    className="pg-kontrol"
                  >
                    <option value="80">Termal 80 mm (Standar)</option>
                    <option value="58">Termal 58 mm (Kecil)</option>
                    <option value="a6">Kertas A6 / Kuitansi</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Pemeriksaan Integritas Saldo (CAP-17) */}
      <Card className="pg-integritas">
        <div className="pg-integritas-kepala">
          <div>
            <h3 className="pg-integritas-judul">
              Pemeriksaan saldo
            </h3>
            <p className="pg-integritas-ket">
              Memvalidasi setiap baris saldo berjalan dengan kalkulasi total transaksi pada basis data.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePeriksaIntegritas}
            disabled={checkingIntegritas}
          >
            {checkingIntegritas ? 'Memeriksa...' : 'Periksa Sekarang'}
          </Button>
        </div>

        {hasilIntegritas && (
          <div className={`pg-hasil ${hasilIntegritas.apakah_seimbang ? 'pg-hasil-ok' : 'pg-hasil-err'}`}>
            <div className="pg-hasil-judul">
              {hasilIntegritas.apakah_seimbang
                ? 'Seluruh saldo seimbang (nol selisih)'
                : `Ditemukan selisih pada ${hasilIntegritas.selisih.length} siswa`}
            </div>
            <div className="pg-hasil-ket">
              Diperiksa {hasilIntegritas.total_siswa_diperiksa} siswa dan{' '}
              {hasilIntegritas.total_transaksi_diperiksa} transaksi.
            </div>
          </div>
        )}
      </Card>

      <KeamananPanel />
      <RiwayatAktivitasPanel />
    </div>
  );
}
