import { useState, useEffect, useCallback } from 'react';
import type { RingkasanKasHarian, Transaksi, ItemRekapKelas } from '../../shared/types.js';
import { hariIniLokal, formatTanggalIndonesia } from '../../shared/tanggal.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { IconWallet } from '../components/Icons.js';

interface BerandaScreenProps {
  onGoToCatat: () => void;
}

interface ChartDayData {
  label: string;
  tanggal: string;
  setoran: number;
  penarikan: number;
}

export function BerandaScreen({ onGoToCatat }: BerandaScreenProps) {
  const [kas, setKas] = useState<RingkasanKasHarian | null>(null);
  const [transaksiList, setTransaksiList] = useState<Transaksi[]>([]);
  const [rekapKelas, setRekapKelas] = useState<ItemRekapKelas[]>([]);
  const [siswaCount, setSiswaCount] = useState(0);
  const [kelasCount, setKelasCount] = useState(0);
  const [chartData, setChartData] = useState<ChartDayData[]>([]);
  const [isSeimbang, setIsSeimbang] = useState<boolean | null>(true);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!window.pundi) return;
    setLoading(true);
    try {
      const today = hariIniLokal();
      const [kasRes, trxRes, siswaRes, rekapRes, integritasRes] = await Promise.all([
        window.pundi.laporanKasHarian(today),
        window.pundi.transaksiRiwayat({ limit: 10 }),
        window.pundi.siswaCari('', undefined, 'aktif'),
        window.pundi.laporanRekapKelas(),
        window.pundi.integritasPeriksa(),
      ]);

      if (kasRes.ok) setKas(kasRes.data);
      if (trxRes.ok) setTransaksiList(trxRes.data);
      if (siswaRes.ok) setSiswaCount(siswaRes.data.length);
      if (rekapRes.ok) {
        setRekapKelas(rekapRes.data);
        setKelasCount(rekapRes.data.length);
      }
      if (integritasRes.ok) setIsSeimbang(integritasRes.data.apakah_seimbang);

      // Hitung data 7 hari terakhir untuk grafik (dalam ribuan rupiah)
      const baseDate = new Date();
      // Siapkan 7 tanggal mundur
      const datePromises = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const dayLabel = `${dayNames[d.getDay()]} ${d.getDate()}`;
        datePromises.push(
          window.pundi.laporanKasHarian(dateStr).then((res) => ({
            label: dayLabel,
            tanggal: dateStr,
            setoran: res.ok ? Math.round(res.data.total_setoran / 1000) : 0,
            penarikan: res.ok ? Math.round(res.data.total_penarikan / 1000) : 0,
          }))
        );
      }
      const daysResult = await Promise.all(datePromises);
      setChartData(daysResult);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hitung jumlah transaksi setoran & penarikan hari ini
  const countSetoran = transaksiList.filter((t) => t.jenis === 'setoran' && t.tanggal === hariIniLokal()).length;
  const countPenarikan = transaksiList.filter((t) => t.jenis === 'penarikan' && t.tanggal === hariIniLokal()).length;

  // Nilai maksimum untuk skala grafik batang
  const maxChartVal = Math.max(
    ...chartData.map((d) => Math.max(d.setoran, d.penarikan)),
    100
  );

  // Nilai maksimum untuk progress bar kelas
  const maxClassSaldo = Math.max(...rekapKelas.map((k) => k.total_saldo), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ======================================================== */}
      {/* 4 STAT METRIC CARDS (Mockup Page 2)                      */}
      {/* ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
        {/* Card 1: Setoran Hari Ini */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '9999px',
              backgroundColor: '#EFF6FF',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            ↓
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
              Setoran hari ini
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginTop: '2px', letterSpacing: '-0.3px' }} className="tabular-nums">
              {formatRupiah(kas?.total_setoran || 0)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              {countSetoran || kas?.jumlah_transaksi ? `${countSetoran || kas?.jumlah_transaksi} transaksi` : '0 transaksi'}
            </div>
          </div>
        </div>

        {/* Card 2: Penarikan Hari Ini */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '9999px',
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            ↑
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
              Penarikan hari ini
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginTop: '2px', letterSpacing: '-0.3px' }} className="tabular-nums">
              {formatRupiah(kas?.total_penarikan || 0)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              {countPenarikan} transaksi
            </div>
          </div>
        </div>

        {/* Card 3: Siswa Aktif */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '9999px',
              backgroundColor: '#F3E8FF',
              color: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
              Siswa aktif
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginTop: '2px', letterSpacing: '-0.3px' }} className="tabular-nums">
              {siswaCount}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              {kelasCount} kelas
            </div>
          </div>
        </div>

        {/* Card 4: Total Saldo Siswa */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '9999px',
              backgroundColor: 'var(--ok-bg)',
              color: 'var(--ok)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconWallet width={20} height={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
              Total saldo siswa
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginTop: '2px', letterSpacing: '-0.3px' }} className="tabular-nums">
              {formatRupiah(kas?.saldo_seluruh_siswa || 0)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: isSeimbang ? 'var(--ok)' : 'var(--danger)', marginTop: '4px', fontWeight: 600 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: isSeimbang ? 'var(--ok)' : 'var(--danger)', display: 'inline-block' }} />
              <span>{isSeimbang ? 'Cocok dengan buku besar' : 'Perlu pemeriksaan saldo'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BARIS TENGAH: GRAFIK & SALDO PER KELAS (Mockup Page 2)    */}
      {/* ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '18px' }}>
        {/* Card Kiri: Setoran dan Penarikan (Grafik Batang) */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '22px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header Grafik */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Setoran dan penarikan
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', margin: 0 }}>
                7 hari kerja terakhir, dalam ribu rupiah
              </p>
            </div>

            {/* Legenda Grafik */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '9999px', backgroundColor: 'var(--accent)' }} />
                <span>Setoran</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '9999px', backgroundColor: '#F59E0B' }} />
                <span>Penarikan</span>
              </div>
            </div>
          </div>

          {/* Area Batang Grafik */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '170px', padding: '0 8px 10px', borderBottom: '1px solid var(--border)' }}>
            {chartData.map((d, idx) => {
              const hSetoran = Math.max(Math.round((d.setoran / maxChartVal) * 140), 6);
              const hPenarikan = Math.max(Math.round((d.penarikan / maxChartVal) * 140), 4);

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px' }}>
                    {/* Batang Setoran (Biru) */}
                    <div
                      title={`Setoran ${d.label}: Rp ${(d.setoran * 1000).toLocaleString('id-ID')}`}
                      style={{
                        width: '16px',
                        height: `${hSetoran}px`,
                        backgroundColor: 'var(--accent)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    {/* Batang Penarikan (Kuning/Amber) */}
                    <div
                      title={`Penarikan ${d.label}: Rp ${(d.penarikan * 1000).toLocaleString('id-ID')}`}
                      style={{
                        width: '16px',
                        height: `${hPenarikan}px`,
                        backgroundColor: '#F59E0B',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                  </div>
                  {/* Label Hari */}
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card Kanan: Saldo Per Kelas (Horizontal Progress Bars) */}
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '22px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Saldo per kelas
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {rekapKelas.length} kelas terdaftar
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
            {rekapKelas.slice(0, 6).map((k) => {
              const pct = Math.max(Math.round((k.total_saldo / maxClassSaldo) * 100), 5);
              return (
                <div key={k.kelas_id} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ width: '28px', fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                    {k.kelas_nama}
                  </span>
                  <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--bg)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: 'var(--accent)',
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', width: '95px', textAlign: 'right' }} className="tabular-nums">
                    {formatRupiah(k.total_saldo)}
                  </span>
                </div>
              );
            })}

            {rekapKelas.length === 0 && (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                Belum ada data kelas atau saldo
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BARIS BAWAH: TRANSAKSI TERBARU (Mockup Page 2)            */}
      {/* ======================================================== */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Transaksi terbaru
          </h3>
          <button
            onClick={onGoToCatat}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Lihat semua
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
              <th style={{ padding: '12px 22px', fontWeight: 600, fontSize: '11px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Waktu / Tanggal</th>
              <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Nama Siswa</th>
              <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Kelas</th>
              <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Jenis</th>
              <th style={{ padding: '12px 18px', fontWeight: 600, fontSize: '11px', letterSpacing: '0.6px', textTransform: 'uppercase', textAlign: 'right' }}>Nominal</th>
              <th style={{ padding: '12px 22px', fontWeight: 600, fontSize: '11px', letterSpacing: '0.6px', textTransform: 'uppercase', textAlign: 'right' }}>Saldo Sesudah</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                  Memuat data transaksi...
                </td>
              </tr>
            ) : transaksiList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                  Belum ada transaksi tercatat.
                </td>
              </tr>
            ) : (
              transaksiList.map((t) => {
                const isSetor = t.jenis === 'setoran' || (t.jenis === 'pembalik' && t.nilai > 0);
                const isTarik = t.jenis === 'penarikan' || (t.jenis === 'pembalik' && t.nilai < 0);
                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '13px 22px', color: 'var(--muted)', fontSize: '12px' }}>
                      {formatTanggalIndonesia(t.tanggal, { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '13px 18px', fontWeight: 600, color: 'var(--text)' }}>
                      {t.siswa_nama || '-'}
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        {t.kelas_nama || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSetor ? 'var(--ok-bg)' : isTarik ? 'var(--danger-bg)' : 'var(--bg)',
                          color: isSetor ? 'var(--ok-text)' : isTarik ? 'var(--danger-text)' : 'var(--muted)',
                        }}
                      >
                        {t.jenis === 'setoran' ? 'Setoran' : t.jenis === 'penarikan' ? 'Penarikan' : 'Koreksi'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '13px 18px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: isSetor ? 'var(--ok)' : isTarik ? 'var(--danger)' : 'var(--text)',
                      }}
                      className="tabular-nums"
                    >
                      {isSetor ? `+ ${formatRupiah(Math.abs(t.nilai))}` : `− ${formatRupiah(Math.abs(t.nilai))}`}
                    </td>
                    <td style={{ padding: '13px 22px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }} className="tabular-nums">
                      {formatRupiah(t.saldo_setelah)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
