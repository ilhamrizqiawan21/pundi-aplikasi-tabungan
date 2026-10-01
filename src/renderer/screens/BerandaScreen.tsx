import { useState, useEffect } from 'react';
import type { RingkasanKasHarian, Transaksi } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';

interface BerandaScreenProps {
  onGoToCatat: () => void;
}

export function BerandaScreen({ onGoToCatat }: BerandaScreenProps) {
  const [kas, setKas] = useState<RingkasanKasHarian | null>(null);
  const [transaksiList, setTransaksiList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().substring(0, 10);
      const [kasRes, trxRes] = await Promise.all([
        window.pundi.laporanKasHarian(today),
        window.pundi.transaksiRiwayat({ limit: 10 }),
      ]);

      if (kasRes.ok) setKas(kasRes.data);
      if (trxRes.ok) setTransaksiList(trxRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Kartu Ringkasan Kas Harian (DESIGN §4.1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <SummaryCard
          title="Total Setoran Hari Ini"
          value={formatRupiah(kas?.total_setoran || 0)}
          color="var(--ok)"
          subText="Pemasukan tabungan"
        />
        <SummaryCard
          title="Total Penarikan Hari Ini"
          value={formatRupiah(kas?.total_penarikan || 0)}
          color="var(--danger)"
          subText="Pengeluaran tabungan"
        />
        <SummaryCard
          title="Jumlah Transaksi Hari Ini"
          value={`${kas?.jumlah_transaksi || 0} transaksi`}
          color="var(--text)"
          subText="Aktivitas kas hari ini"
        />
        <SummaryCard
          title="Total Saldo Seluruh Siswa"
          value={formatRupiah(kas?.saldo_seluruh_siswa || 0)}
          color="var(--accent)"
          subText="Kewajiban tabungan sekolah"
        />
      </div>

      {/* Banner Tombol Aksi Utama */}
      <div
        style={{
          padding: '20px 24px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Pencatatan Cepat Siswa</h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
            Tekan <kbd style={{ padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)' }}>Ctrl + K</kbd> atau klik tombol di kanan untuk mulai mencatat setoran / penarikan.
          </p>
        </div>
        <button
          onClick={onGoToCatat}
          style={{
            padding: '10px 22px',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-text)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Catat Transaksi Sekarang →
        </button>
      </div>

      {/* 10 Transaksi Terakhir */}
      <div
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>10 Transaksi Terakhir</h3>
          <button
            onClick={fetchData}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Segarkan
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>No. Bukti</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Tanggal</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Nama Siswa</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Kelas</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Jenis</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Nominal</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Saldo Sesudah</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                  Memuat data...
                </td>
              </tr>
            ) : transaksiList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                  Belum ada transaksi yang tercatat.
                </td>
              </tr>
            ) : (
              transaksiList.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{t.nomor_bukti}</td>
                  <td style={{ padding: '10px 16px' }}>{t.tanggal}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{t.siswa_nama || '-'}</td>
                  <td style={{ padding: '10px 16px' }}>{t.kelas_nama || '-'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: t.nilai > 0 ? '#EAF7ED' : '#FDEDEC',
                        color: t.nilai > 0 ? 'var(--ok)' : 'var(--danger)',
                      }}
                    >
                      {t.jenis.toUpperCase()}
                    </span>
                  </td>
                  <td
                    className="tabular-nums"
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: t.nilai > 0 ? 'var(--ok)' : 'var(--danger)',
                    }}
                  >
                    {t.nilai > 0 ? `+${formatRupiah(t.nilai)}` : formatRupiah(t.nilai)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupiah(t.saldo_setelah)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color,
  subText,
}: {
  title: string;
  value: string;
  color: string;
  subText: string;
}) {
  return (
    <div
      style={{
        padding: '16px 18px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>{title}</span>
      <span className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700, color }}>
        {value}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{subText}</span>
    </div>
  );
}
