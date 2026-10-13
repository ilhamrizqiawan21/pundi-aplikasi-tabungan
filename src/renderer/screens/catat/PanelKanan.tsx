import type { Siswa, Transaksi, RingkasanKasHarian } from '../../../shared/types.js';
import { formatTanggalIndonesia } from '../../../shared/tanggal.js';
import { formatRupiah } from '../../../shared/rupiah.js';

interface PanelKananProps {
  kasHariIni: RingkasanKasHarian | null;
  siswaTerpilih: Siswa | null;
  riwayat: Transaksi[];
}

function namaJenis(jenis: Transaksi['jenis']): string {
  if (jenis === 'setoran') return 'Setoran';
  if (jenis === 'penarikan') return 'Penarikan';
  return 'Koreksi';
}

/** Kolom kanan Catat Transaksi: ringkasan kas hari ini dan riwayat siswa terpilih. */
export function PanelKanan({ kasHariIni, siswaTerpilih, riwayat }: PanelKananProps) {
  const adaRiwayat = Boolean(siswaTerpilih) && riwayat.length > 0;

  return (
    <section className="catat-kanan">
      <div className="catat-panel catat-kartu">
        <h4 className="catat-kartu-judul ruang">Ringkasan hari ini</h4>

        <div className="catat-ringkas-grid">
          <div>
            <div className="catat-ringkas-label">Setoran</div>
            <div className="catat-ringkas-nilai ok tabular-nums">{formatRupiah(kasHariIni?.total_setoran || 0)}</div>
          </div>
          <div>
            <div className="catat-ringkas-label">Penarikan</div>
            <div className="catat-ringkas-nilai bahaya tabular-nums">
              {formatRupiah(kasHariIni?.total_penarikan || 0)}
            </div>
          </div>
        </div>

        <div className="catat-ringkas-foot">{kasHariIni?.jumlah_transaksi || 0} transaksi tercatat hari ini</div>
      </div>

      <div className="catat-panel catat-kartu catat-kartu-riwayat">
        <div className="catat-riwayat-judul-baris">
          <h4 className="catat-kartu-judul">Riwayat siswa</h4>
          <span className="catat-riwayat-lihat">Lihat semua</span>
        </div>

        {adaRiwayat ? (
          <div className="catat-riwayat-list">
            {riwayat.map((trx) => {
              const isSetor = trx.jenis === 'setoran' || (trx.jenis === 'pembalik' && trx.nilai > 0);
              const warna = isSetor ? 'ok' : 'bahaya';
              return (
                <div key={trx.id} className="catat-riwayat-item">
                  <div className="catat-riwayat-kiri">
                    <div className={`catat-riwayat-ikon ${warna}`}>{isSetor ? '+' : '−'}</div>
                    <div>
                      <div className="catat-riwayat-jenis">{namaJenis(trx.jenis)}</div>
                      <div className="catat-riwayat-tgl">
                        {formatTanggalIndonesia(trx.tanggal, { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                  <div className={`catat-riwayat-nilai ${warna} tabular-nums`}>{formatRupiah(Math.abs(trx.nilai))}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="catat-riwayat-kosong">
            {siswaTerpilih ? 'Belum ada riwayat transaksi' : 'Pilih siswa untuk melihat riwayat'}
          </div>
        )}
      </div>
    </section>
  );
}
