import { useState, useEffect, type FormEvent } from 'react';
import type { TemaAplikasi, UkuranStruk, HasilPeriksaIntegritas } from '../../shared/types.js';

interface PengaturanScreenProps {
  onThemeChange: (tema: TemaAplikasi) => void;
}

export function PengaturanScreen({ onThemeChange }: PengaturanScreenProps) {
  // Profil
  const [nama, setNama] = useState('');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {msg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: msg.type === 'ok' ? '#EAF7ED' : '#FDEDEC',
            color: msg.type === 'ok' ? 'var(--ok)' : 'var(--danger)',
            border: `1px solid ${msg.type === 'ok' ? '#C3E6CB' : '#FADBD8'}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Form Profil Sekolah */}
      <form
        onSubmit={handleSimpanProfil}
        style={{
          backgroundColor: 'var(--surface)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          Profil Sekolah & Madrasah (CAP-01)
        </h3>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
            Nama Sekolah / Lembaga <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Alamat Sekolah
            </label>
            <input
              type="text"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Contoh: Jl. Diponegoro No. 45"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Kota / Kabupaten
            </label>
            <input
              type="text"
              value={kota}
              onChange={(e) => setKota(e.target.value)}
              placeholder="Contoh: Surakarta"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Nama Bendahara Tabungan
            </label>
            <input
              type="text"
              value={bendahara}
              onChange={(e) => setBendahara(e.target.value)}
              placeholder="Nama bendahara"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Nama Kepala Sekolah / Madrasah
            </label>
            <input
              type="text"
              value={kepala}
              onChange={(e) => setKepala(e.target.value)}
              placeholder="Nama kepala sekolah"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            />
          </div>
        </div>

        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            borderBottom: '1px solid var(--border)',
            paddingBottom: '10px',
            marginTop: '8px',
          }}
        >
          Tampilan & Cetak (CAP-15 & D-10)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Tema Tampilan
            </label>
            <select
              value={tema}
              onChange={(e) => {
                const newTheme = e.target.value as TemaAplikasi;
                setTema(newTheme);
                onThemeChange(newTheme);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            >
              <option value="putih">Putih (Bawaan)</option>
              <option value="hijau">Hijau</option>
              <option value="biru">Biru</option>
              <option value="ungu">Ungu</option>
              <option value="grafit">Grafit (Gelap)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Ukuran Struk Bukti Transaksi
            </label>
            <select
              value={ukuranStruk}
              onChange={(e) => setUkuranStruk(e.target.value as UkuranStruk)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            >
              <option value="80">Termal 80 mm (Standar)</option>
              <option value="58">Termal 58 mm (Kecil)</option>
              <option value="a6">Kertas A6 / Kuitansi</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 22px',
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>

      {/* Pemeriksaan Integritas Saldo (CAP-17) */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Pemeriksaan Integritas Saldo (CAP-17)</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
              Memvalidasi setiap baris saldo berjalan dengan kalkulasi total transaksi pada basis data.
            </p>
          </div>
          <button
            onClick={handlePeriksaIntegritas}
            disabled={checkingIntegritas}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {checkingIntegritas ? 'Memeriksa...' : 'Periksa Sekarang'}
          </button>
        </div>

        {hasilIntegritas && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '6px',
              backgroundColor: hasilIntegritas.apakah_seimbang ? '#EAF7ED' : '#FDEDEC',
              border: `1px solid ${hasilIntegritas.apakah_seimbang ? '#C3E6CB' : '#FADBD8'}`,
              fontSize: '13px',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: hasilIntegritas.apakah_seimbang ? 'var(--ok)' : 'var(--danger)',
                fontSize: '14px',
                marginBottom: '4px',
              }}
            >
              {hasilIntegritas.apakah_seimbang
                ? '✓ Seluruh Saldo Seimbang (Nol Selisih)'
                : `⚠ Ditemukan Selisih pada ${hasilIntegritas.selisih.length} Siswa`}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Diperiksa {hasilIntegritas.total_siswa_diperiksa} siswa dan{' '}
              {hasilIntegritas.total_transaksi_diperiksa} transaksi.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
