import { useState, useEffect, useCallback } from 'react';
import type { RingkasanKasHarian, Transaksi, ItemRekapKelas } from '../../shared/types.js';
import { hariIniLokal, formatTanggalIndonesia } from '../../shared/tanggal.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { IconWallet } from '../components/Icons.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  EmptyState,
} from '../components/ui/index.js';
import './BerandaScreen.css';

/** Nominal panjang (miliaran) mendapat kartu yang memberi ruang penuh pada angka agar tidak meluber. */
const kelasKartu = (n: number) =>
  formatRupiah(n).length >= 14 ? 'kartu-metrik kartu-metrik-panjang' : 'kartu-metrik';

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

  const countSetoran = transaksiList.filter((t) => t.jenis === 'setoran' && t.tanggal === hariIniLokal()).length;
  const countPenarikan = transaksiList.filter((t) => t.jenis === 'penarikan' && t.tanggal === hariIniLokal()).length;

  const maxChartVal = Math.max(
    ...chartData.map((d) => Math.max(d.setoran, d.penarikan)),
    100
  );

  const maxClassSaldo = Math.max(...rekapKelas.map((k) => k.total_saldo), 1);

  return (
    <div className="beranda-container">
      {/* 1. Empat Kartu Ringkasan Metrik */}
      <div className="grid-metrik">
        {/* Setoran Hari Ini */}
        <Card className={`ui-card-metrik ${kelasKartu(kas?.total_setoran || 0)}`}>
          <div className="metrik-icon metrik-icon-setor">↓</div>
          <div className="kartu-metrik-isi">
            <div className="metrik-label">Setoran hari ini</div>
            <div className="metrik-nilai tabular-nums nilai-uang">
              {formatRupiah(kas?.total_setoran || 0)}
            </div>
            <div className="metrik-sub">
              {countSetoran || kas?.jumlah_transaksi
                ? `${countSetoran || kas?.jumlah_transaksi} transaksi`
                : '0 transaksi'}
            </div>
          </div>
        </Card>

        {/* Penarikan Hari Ini */}
        <Card className={`ui-card-metrik ${kelasKartu(kas?.total_penarikan || 0)}`}>
          <div className="metrik-icon metrik-icon-tarik">↑</div>
          <div className="kartu-metrik-isi">
            <div className="metrik-label">Penarikan hari ini</div>
            <div className="metrik-nilai tabular-nums nilai-uang">
              {formatRupiah(kas?.total_penarikan || 0)}
            </div>
            <div className="metrik-sub">{countPenarikan} transaksi</div>
          </div>
        </Card>

        {/* Siswa Aktif */}
        <Card className="ui-card-metrik kartu-metrik">
          <div className="metrik-icon metrik-icon-siswa">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="kartu-metrik-isi">
            <div className="metrik-label">Siswa aktif</div>
            <div className="metrik-nilai tabular-nums nilai-uang nilai-besar">
              {siswaCount}
            </div>
            <div className="metrik-sub">{kelasCount} kelas</div>
          </div>
        </Card>

        {/* Total Saldo Siswa */}
        <Card className={`ui-card-metrik ${kelasKartu(kas?.saldo_seluruh_siswa || 0)}`}>
          <div className="metrik-icon metrik-icon-saldo">
            <IconWallet width={20} height={20} />
          </div>
          <div className="kartu-metrik-isi">
            <div className="metrik-label">Total saldo siswa</div>
            <div className="metrik-nilai tabular-nums nilai-uang">
              {formatRupiah(kas?.saldo_seluruh_siswa || 0)}
            </div>
            <div className={`status-saldo ${isSeimbang ? 'status-saldo-ok' : 'status-saldo-err'}`}>
              <span className="status-saldo-titik" />
              <span>{isSeimbang ? 'Cocok dengan buku besar' : 'Perlu pemeriksaan saldo'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Baris Tengah: Grafik & Saldo Per Kelas */}
      <div className="beranda-grid-tengah">
        {/* Grafik Batang 7 Hari */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Setoran dan penarikan</CardTitle>
              <span className="metrik-label">7 hari kerja terakhir, dalam ribu rupiah</span>
            </div>
            <div className="grafik-legenda">
              <div className="grafik-legenda-item">
                <span className="grafik-legenda-titik grafik-legenda-setor" />
                <span>Setoran</span>
              </div>
              <div className="grafik-legenda-item">
                <span className="grafik-legenda-titik grafik-legenda-tarik" />
                <span>Penarikan</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grafik-area">
              {chartData.map((d, idx) => {
                const hSetoran = Math.max(Math.round((d.setoran / maxChartVal) * 140), 6);
                const hPenarikan = Math.max(Math.round((d.penarikan / maxChartVal) * 140), 4);
                return (
                  <div key={idx} className="grafik-kolom">
                    <div className="grafik-batang-group">
                      <div
                        title={`Setoran ${d.label}: Rp ${(d.setoran * 1000).toLocaleString('id-ID')}`}
                        className="grafik-batang grafik-batang-setor"
                        style={{ height: `${hSetoran}px` }}
                      />
                      <div
                        title={`Penarikan ${d.label}: Rp ${(d.penarikan * 1000).toLocaleString('id-ID')}`}
                        className="grafik-batang grafik-batang-tarik"
                        style={{ height: `${hPenarikan}px` }}
                      />
                    </div>
                    <span className="grafik-label">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Saldo per Kelas */}
        <Card>
          <CardHeader>
            <CardTitle>Saldo per kelas</CardTitle>
            <span className="metrik-label">{rekapKelas.length} kelas terdaftar</span>
          </CardHeader>
          <CardContent>
            <div className="kelas-list">
              {rekapKelas.slice(0, 6).map((k) => {
                const pct = Math.max(Math.round((k.total_saldo / maxClassSaldo) * 100), 5);
                return (
                  <div key={k.kelas_id} className="kelas-row">
                    <span className="kelas-nama">{k.kelas_nama}</span>
                    <div className="kelas-bar-track">
                      <div className="kelas-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="kelas-saldo tabular-nums">
                      {formatRupiah(k.total_saldo)}
                    </span>
                  </div>
                );
              })}
              {rekapKelas.length === 0 && (
                <div className="kelas-kosong">
                  Belum ada data kelas atau saldo
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Baris Bawah: Transaksi Terbaru */}
      <Card>
        <CardHeader>
          <CardTitle>Transaksi terbaru</CardTitle>
          <Button variant="ghost" size="sm" onClick={onGoToCatat}>
            Lihat semua
          </Button>
        </CardHeader>
        <div className="ui-table-container beranda-tabel">
          <table className="tabel tabel-kartu">
            <thead>
              <tr>
                <th>Waktu / Tanggal</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Jenis</th>
                <th className="angka">Nominal</th>
                <th className="angka">Saldo Sesudah</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[1, 2, 3, 4].map((idx) => (
                    <tr key={idx}>
                      <td data-label="Waktu / Tanggal"><Skeleton width="100px" height="16px" /></td>
                      <td data-label="Nama Siswa"><Skeleton width="150px" height="16px" /></td>
                      <td data-label="Kelas"><Skeleton width="60px" height="18px" /></td>
                      <td data-label="Jenis"><Skeleton width="70px" height="18px" /></td>
                      <td data-label="Nominal" className="angka"><Skeleton width="90px" height="16px" /></td>
                      <td data-label="Saldo Sesudah" className="angka"><Skeleton width="90px" height="16px" /></td>
                    </tr>
                  ))}
                </>
              ) : transaksiList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="kosong beranda-kosong">
                    <EmptyState
                      title="Belum ada transaksi tercatat."
                      description="Mulai catat setoran atau penarikan siswa hari ini."
                      action={
                        <Button variant="primary" size="sm" onClick={onGoToCatat}>
                          + Catat Transaksi Baru
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                transaksiList.map((t) => {
                  const isSetor = t.jenis === 'setoran' || (t.jenis === 'pembalik' && t.nilai > 0);
                  const isTarik = t.jenis === 'penarikan' || (t.jenis === 'pembalik' && t.nilai < 0);
                  const jenisLabel = t.jenis === 'setoran' ? 'Setoran' : t.jenis === 'penarikan' ? 'Penarikan' : 'Koreksi';
                  const badgeVariant = isSetor ? 'ok' : isTarik ? 'danger' : 'neutral';

                  return (
                    <tr key={t.id}>
                      <td data-label="Waktu / Tanggal" className="beranda-waktu">
                        {formatTanggalIndonesia(t.tanggal, { day: 'numeric', month: 'short' })}
                      </td>
                      <td data-label="Nama Siswa" className="beranda-tebal">{t.siswa_nama || '-'}</td>
                      <td data-label="Kelas">
                        <Badge variant="neutral">{t.kelas_nama || '-'}</Badge>
                      </td>
                      <td data-label="Jenis">
                        <Badge variant={badgeVariant}>{jenisLabel}</Badge>
                      </td>
                      <td
                        data-label="Nominal"
                        className={`angka beranda-nominal ${isSetor ? 'beranda-nominal-setor' : isTarik ? 'beranda-nominal-tarik' : ''}`}
                      >
                        {isSetor ? `+ ${formatRupiah(Math.abs(t.nilai))}` : `− ${formatRupiah(Math.abs(t.nilai))}`}
                      </td>
                      <td data-label="Saldo Sesudah" className="angka beranda-tebal">
                        {formatRupiah(t.saldo_setelah)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
