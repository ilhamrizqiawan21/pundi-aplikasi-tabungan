import { useCallback, useEffect, useState } from 'react';
import type { HasilRekapBulanan, ItemSiswaPasif, TahunAjaran } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { formatTanggalIndonesia } from '../../shared/tanggal.js';
import { PratinjauCetakModal } from './PratinjauCetakModal.js';
import { Button, Field } from './ui/index.js';
import './panel-bersama.css';

interface RekapBulananPanelProps {
  tahunAjaranList: TahunAjaran[];
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const labelBulan = (b: string) => `${NAMA_BULAN[Number(b.slice(5)) - 1]} ${b.slice(0, 4)}`;
const pad = (n: number) => String(n).padStart(2, '0');

/** Rentang "12 bulan terakhir": tanggal 1 sebelas bulan lalu sampai akhir bulan ini. */
function duabelasBulanTerakhir(): { dari: string; sampai: string } {
  const sekarang = new Date();
  const awal = new Date(sekarang.getFullYear(), sekarang.getMonth() - 11, 1);
  const akhir = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0);
  return {
    dari: `${awal.getFullYear()}-${pad(awal.getMonth() + 1)}-01`,
    sampai: `${akhir.getFullYear()}-${pad(akhir.getMonth() + 1)}-${pad(akhir.getDate())}`,
  };
}

/** Grafik batang setoran dan penarikan per bulan. SVG buatan sendiri (tanpa pustaka luar); angka lengkap ada di tabel. */
function GrafikBulanan({ baris }: { baris: HasilRekapBulanan['baris'] }) {
  const lebar = 720;
  const tinggi = 220;
  const kiri = 8;
  const bawah = 26;
  const atas = 10;
  const maks = Math.max(1, ...baris.map((b) => Math.max(b.setoran, b.penarikan)));
  const lebarGrup = (lebar - kiri * 2) / Math.max(baris.length, 1);
  const lebarBatang = Math.min(22, lebarGrup / 2.6);
  const skala = (v: number) => ((tinggi - bawah - atas) * v) / maks;
  return (
    <svg viewBox={`0 0 ${lebar} ${tinggi}`} role="img" aria-label="Grafik setoran dan penarikan per bulan" className="pb-grafik">
      <line x1={kiri} x2={lebar - kiri} y1={tinggi - bawah} y2={tinggi - bawah} stroke="var(--border)" />
      {baris.map((b, i) => {
        const x = kiri + i * lebarGrup + lebarGrup / 2;
        return (
          <g key={b.bulan}>
            <rect x={x - lebarBatang - 1} y={tinggi - bawah - skala(b.setoran)} width={lebarBatang} height={skala(b.setoran)} rx={3} fill="var(--ok)">
              <title>{`${labelBulan(b.bulan)}: setoran ${formatRupiah(b.setoran)}`}</title>
            </rect>
            <rect x={x + 1} y={tinggi - bawah - skala(b.penarikan)} width={lebarBatang} height={skala(b.penarikan)} rx={3} fill="var(--danger)">
              <title>{`${labelBulan(b.bulan)}: penarikan ${formatRupiah(b.penarikan)}`}</title>
            </rect>
            <text x={x} y={tinggi - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {BULAN_PENDEK[Number(b.bulan.slice(5)) - 1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** CAP-22: rekap per bulan (grafik, tabel, Excel, cetak) dan daftar siswa bersaldo yang lama tidak bertransaksi. */
export function RekapBulananPanel({ tahunAjaranList }: RekapBulananPanelProps) {
  const [rentang, setRentang] = useState<string>('12bulan'); // '12bulan' atau id tahun ajaran
  const [bulanPasif, setBulanPasif] = useState(3);
  const [hasil, setHasil] = useState<HasilRekapBulanan | null>(null);
  const [pasif, setPasif] = useState<ItemSiswaPasif[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<{ html: string; judul: string } | null>(null);

  // Tahun ajaran aktif jadi pilihan awal bila ada
  useEffect(() => {
    const aktif = tahunAjaranList.find((t) => t.aktif === 1);
    if (aktif) setRentang(String(aktif.id));
  }, [tahunAjaranList]);

  const hitungRentang = useCallback((): { dari: string; sampai: string } => {
    const ta = rentang === '12bulan' ? undefined : tahunAjaranList.find((t) => String(t.id) === rentang);
    return ta ? { dari: ta.mulai, sampai: ta.selesai } : duabelasBulanTerakhir();
  }, [rentang, tahunAjaranList]);

  useEffect(() => {
    const { dari, sampai } = hitungRentang();
    window.pundi.laporanRekapBulanan(dari, sampai).then((res) => {
      if (res.ok) {
        setHasil(res.data);
        setGalat(null);
      } else {
        setHasil(null);
        setGalat(res.pesan);
      }
    });
  }, [hitungRentang]);

  useEffect(() => {
    window.pundi.laporanSiswaPasif(bulanPasif).then((res) => res.ok && setPasif(res.data));
  }, [bulanPasif]);

  const ekspor = async () => {
    setPesan(null);
    const { dari, sampai } = hitungRentang();
    const res = await window.pundi.laporanEkspor({ jenis: 'rekapBulanan', dari, sampai });
    if (!res.ok) setGalat(res.pesan);
    else if (res.data) setPesan(`Laporan disimpan sebagai ${res.data.nama_berkas}.`);
  };

  const cetak = async () => {
    setPesan(null);
    const { dari, sampai } = hitungRentang();
    const res = await window.pundi.cetakLaporanHtml({ jenis: 'rekapBulanan', dari, sampai });
    if (res.ok) setPratinjau(res.data);
    else setGalat(res.pesan);
  };

  const totalSetoran = hasil?.baris.reduce((t, b) => t + b.setoran, 0) ?? 0;
  const totalPenarikan = hasil?.baris.reduce((t, b) => t + b.penarikan, 0) ?? 0;
  const adaTransaksi = (hasil?.baris.some((b) => b.jumlah_transaksi > 0)) ?? false;

  return (
    <div className="pb-kolom-lebar">
      <section className="ui-card pb-periode" aria-label="Pilih periode">
        <Field label="Periode" htmlFor="rb-rentang">
          <select id="rb-rentang" className="ui-input" value={rentang} onChange={(e) => setRentang(e.target.value)}>
            <option value="12bulan">12 bulan terakhir</option>
            {tahunAjaranList.map((t) => (
              <option key={t.id} value={String(t.id)}>T.A. {t.nama}{t.aktif ? ' (Aktif)' : ''}</option>
            ))}
          </select>
        </Field>
        <Button type="button" onClick={cetak} disabled={!hasil}>Cetak / PDF</Button>
        <Button type="button" onClick={ekspor} disabled={!hasil}>Ekspor Excel</Button>
      </section>

      {galat && (
        <div role="alert" className="pb-pesan pb-pesan-galat">
          {galat}
        </div>
      )}
      {pesan && (
        <div role="status" className="pb-pesan pb-pesan-ok">
          {pesan}
        </div>
      )}

      {hasil && (
        <section className="ui-card" aria-labelledby="rb-judul">
          <div className="ui-card-header">
            <h3 id="rb-judul" className="pb-judul">Setoran dan penarikan per bulan</h3>
            <span className="pb-legenda">
              <span><span aria-hidden="true" className="pb-ok">■</span> Setoran</span>
              <span><span aria-hidden="true" className="pb-danger">■</span> Penarikan</span>
            </span>
          </div>
          {adaTransaksi ? (
            <div className="pb-kartu-isi">
              <GrafikBulanan baris={hasil.baris} />
            </div>
          ) : (
            <p className="pb-kosong">
              Belum ada setoran atau penarikan pada periode ini.
            </p>
          )}
          <table className="tabel">
            <thead>
              <tr>
                <th>Bulan</th>
                <th className="angka">Setoran</th>
                <th className="angka">Penarikan</th>
                <th className="angka">Biaya adm</th>
                <th className="angka">Transaksi</th>
                <th className="angka">Saldo akhir bulan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="pb-muted">
                <td colSpan={5}>Saldo awal periode</td>
                <td className="angka">{formatRupiah(hasil.saldo_awal)}</td>
              </tr>
              {hasil.baris.map((b) => (
                <tr key={b.bulan}>
                  <td>{labelBulan(b.bulan)}</td>
                  <td className="angka pb-ok">{formatRupiah(b.setoran)}</td>
                  <td className="angka pb-danger">{formatRupiah(b.penarikan)}</td>
                  <td className="angka">{formatRupiah(b.biaya_adm)}</td>
                  <td className="angka">{b.jumlah_transaksi}</td>
                  <td className="angka pb-tebal">{formatRupiah(b.saldo_akhir)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pb-tebal-besar">
                <td>Total</td>
                <td className="angka">{formatRupiah(totalSetoran)}</td>
                <td className="angka">{formatRupiah(totalPenarikan)}</td>
                <td className="angka">{formatRupiah(hasil.baris.reduce((t, b) => t + b.biaya_adm, 0))}</td>
                <td className="angka">{hasil.baris.reduce((t, b) => t + b.jumlah_transaksi, 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <section className="ui-card" aria-labelledby="rb-pasif-judul">
        <div className="ui-card-header">
          <div>
            <h3 id="rb-pasif-judul" className="pb-judul">Saldo mengendap</h3>
            <p className="pb-sub">
              Siswa aktif yang masih bersaldo tetapi tidak bertransaksi selama:
            </p>
          </div>
          <select aria-label="Lama tidak bertransaksi" className="ui-input pb-select-auto" value={bulanPasif} onChange={(e) => setBulanPasif(Number(e.target.value))}>
            {[1, 3, 6, 12].map((n) => (
              <option key={n} value={n}>{n} bulan</option>
            ))}
          </select>
        </div>
        {pasif.length === 0 ? (
          <p className="pb-kosong">
            Tidak ada siswa bersaldo yang diam selama {bulanPasif} bulan atau lebih.
          </p>
        ) : (
          <table className="tabel">
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Kelas</th>
                <th>Transaksi terakhir</th>
                <th className="angka">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {pasif.map((s) => (
                <tr key={s.siswa_id}>
                  <td>
                    <div className="pb-nama">{s.nama}</div>
                    <div className="pb-nomor">{s.nomor}</div>
                  </td>
                  <td>{s.kelas_nama ?? '-'}</td>
                  <td>{s.transaksi_terakhir ? formatTanggalIndonesia(s.transaksi_terakhir) : '-'}</td>
                  <td className="angka pb-tebal">{formatRupiah(s.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {pratinjau && (
        <PratinjauCetakModal
          terbuka
          judul="Rekap Bulanan"
          html={pratinjau.html}
          onTutup={() => setPratinjau(null)}
          onSimpanPdf={async () => {
            const { dari, sampai } = hitungRentang();
            await window.pundi.cetakLaporanPdf({ jenis: 'rekapBulanan', dari, sampai });
          }}
        />
      )}
    </div>
  );
}
