import type {
  ProfilSekolah,
  ItemRekapKelas,
  ItemLaporanSiswa,
  ItemLaporanTransaksi,
  Siswa,
  Transaksi,
} from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { formatTanggalIndonesia, formatWaktuWib } from '../../shared/tanggal.js';
import { esc } from './receipt.js';

function kopSekolahHtml(profil: ProfilSekolah): string {
  return `
    <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
      <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">${esc(profil.nama || 'TABUNGAN SISWA')}</h2>
      ${profil.alamat ? `<div style="font-size: 12px; margin-top: 2px;">${esc(profil.alamat)}${profil.kota ? ` - ${esc(profil.kota)}` : ''}</div>` : ''}
    </div>
  `;
}

function tandaTanganHtml(profil: ProfilSekolah): string {
  const tanggalHariIni = formatTanggalIndonesia(new Date());
  return `
    <div style="margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; font-size: 12px;">
      <div style="text-align: center; width: 200px;">
        <div>Mengetahui,</div>
        <div>Kepala Sekolah</div>
        <div style="height: 55px;"></div>
        <div style="font-weight: bold; text-decoration: underline;">${esc(profil.kepala || '( ................................... )')}</div>
      </div>
      <div style="text-align: center; width: 200px;">
        <div>${esc(profil.kota || 'Tempat')}, ${tanggalHariIni}</div>
        <div>Bendahara / Petugas</div>
        <div style="height: 55px;"></div>
        <div style="font-weight: bold; text-decoration: underline;">${esc(profil.bendahara || '( ................................... )')}</div>
      </div>
    </div>
  `;
}

const baseStyles = `
  @page {
    size: A4 portrait;
    margin: 15mm 12mm 15mm 12mm;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    color: #111;
    line-height: 1.4;
    margin: 0;
    padding: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 11px;
  }
  th, td {
    border: 1px solid #333;
    padding: 5px 8px;
  }
  th {
    background-color: #f2f2f2;
    font-weight: bold;
    text-align: center;
  }
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .bold { font-weight: bold; }
  .tabular-nums { font-variant-numeric: tabular-nums; }
  tr { page-break-inside: avoid; }
`;

export function generateLaporanKelasHtml(
  profil: ProfilSekolah,
  data: ItemRekapKelas[],
  tahunAjaranNama?: string
): string {
  const totalSiswa = data.reduce((s, r) => s + r.jumlah_siswa, 0);
  const totalSetoran = data.reduce((s, r) => s + r.total_setoran, 0);
  const totalPenarikan = data.reduce((s, r) => s + r.total_penarikan, 0);
  const totalSaldo = data.reduce((s, r) => s + r.total_saldo, 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laporan Rekap Saldo Per Kelas</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${kopSekolahHtml(profil)}
  <div style="text-align: center; margin-bottom: 12px;">
    <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Laporan Rekap Saldo Tabungan per Kelas</h3>
    <div style="font-size: 12px; color: #444; margin-top: 2px;">
      Tahun Ajaran: ${esc(tahunAjaranNama || 'Semua Tahun Ajaran')}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px;">No.</th>
        <th class="text-left">Kelas</th>
        <th style="width: 90px;">Jumlah Siswa</th>
        <th class="text-right" style="width: 110px;">Total Setoran</th>
        <th class="text-right" style="width: 110px;">Total Penarikan</th>
        <th class="text-right" style="width: 120px;">Total Saldo</th>
      </tr>
    </thead>
    <tbody>
      ${data.length === 0 ? `
        <tr>
          <td colspan="6" class="text-center" style="padding: 20px;">Belum ada data pada filter ini.</td>
        </tr>
      ` : data.map((r, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="bold">Kelas ${esc(r.kelas_nama)}</td>
          <td class="text-center">${r.jumlah_siswa}</td>
          <td class="text-right tabular-nums">${formatRupiah(r.total_setoran)}</td>
          <td class="text-right tabular-nums">${formatRupiah(r.total_penarikan)}</td>
          <td class="text-right tabular-nums bold">${formatRupiah(r.total_saldo)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background-color: #f2f2f2; font-weight: bold;">
        <td colspan="2" class="text-center">TOTAL KESELURUHAN</td>
        <td class="text-center">${totalSiswa}</td>
        <td class="text-right tabular-nums">${formatRupiah(totalSetoran)}</td>
        <td class="text-right tabular-nums">${formatRupiah(totalPenarikan)}</td>
        <td class="text-right tabular-nums">${formatRupiah(totalSaldo)}</td>
      </tr>
    </tfoot>
  </table>

  ${tandaTanganHtml(profil)}
</body>
</html>
  `.trim();
}

export function generateLaporanSiswaHtml(
  profil: ProfilSekolah,
  data: ItemLaporanSiswa[],
  subjudul?: string
): string {
  const totalSetoran = data.reduce((s, r) => s + r.total_setoran, 0);
  const totalPenarikan = data.reduce((s, r) => s + r.total_penarikan, 0);
  const totalSaldo = data.reduce((s, r) => s + r.saldo_akhir, 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laporan Rekap Saldo Per Siswa</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${kopSekolahHtml(profil)}
  <div style="text-align: center; margin-bottom: 12px;">
    <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Laporan Rekap Saldo Tabungan Siswa</h3>
    ${subjudul ? `<div style="font-size: 12px; color: #444; margin-top: 2px;">${esc(subjudul)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">No.</th>
        <th style="width: 80px;">No. Rek</th>
        <th style="width: 70px;">NIS</th>
        <th class="text-left">Nama Siswa</th>
        <th style="width: 70px;">Kelas</th>
        <th class="text-right" style="width: 100px;">Setoran</th>
        <th class="text-right" style="width: 100px;">Penarikan</th>
        <th class="text-right" style="width: 110px;">Saldo Akhir</th>
      </tr>
    </thead>
    <tbody>
      ${data.length === 0 ? `
        <tr>
          <td colspan="8" class="text-center" style="padding: 20px;">Belum ada data siswa.</td>
        </tr>
      ` : data.map((s, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="text-center bold">${esc(s.nomor)}</td>
          <td class="text-center">${esc(s.nis || '-')}</td>
          <td>${esc(s.nama)}</td>
          <td class="text-center">${esc(s.kelas_nama || '-')}</td>
          <td class="text-right tabular-nums">${formatRupiah(s.total_setoran)}</td>
          <td class="text-right tabular-nums">${formatRupiah(s.total_penarikan)}</td>
          <td class="text-right tabular-nums bold">${formatRupiah(s.saldo_akhir)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background-color: #f2f2f2; font-weight: bold;">
        <td colspan="5" class="text-center">TOTAL KESELURUHAN (${data.length} Siswa)</td>
        <td class="text-right tabular-nums">${formatRupiah(totalSetoran)}</td>
        <td class="text-right tabular-nums">${formatRupiah(totalPenarikan)}</td>
        <td class="text-right tabular-nums">${formatRupiah(totalSaldo)}</td>
      </tr>
    </tfoot>
  </table>

  ${tandaTanganHtml(profil)}
</body>
</html>
  `.trim();
}

export function generateLaporanTransaksiHtml(
  profil: ProfilSekolah,
  data: ItemLaporanTransaksi[],
  dari: string,
  sampai: string,
  filterInfo?: string
): string {
  const totalMasuk = data.reduce((s, r) => s + (r.nilai > 0 ? r.nilai : 0), 0);
  const totalKeluar = data.reduce((s, r) => s + (r.nilai < 0 ? Math.abs(r.nilai) : 0), 0);
  const selisih = totalMasuk - totalKeluar;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laporan Transaksi Tabungan</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${kopSekolahHtml(profil)}
  <div style="text-align: center; margin-bottom: 12px;">
    <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Laporan Transaksi Tabungan Siswa</h3>
    <div style="font-size: 12px; color: #444; margin-top: 2px;">
      Periode: ${formatTanggalIndonesia(dari)} s/d ${formatTanggalIndonesia(sampai)}
      ${filterInfo ? ` | ${esc(filterInfo)}` : ''}
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; background: #fafafa; border: 1px solid #ccc; padding: 6px 12px; border-radius: 4px;">
    <div>Jumlah Transaksi: <strong>${data.length}</strong></div>
    <div>Total Masuk: <strong style="color: #0b7a40;">${formatRupiah(totalMasuk)}</strong></div>
    <div>Total Keluar: <strong style="color: #b31d28;">${formatRupiah(totalKeluar)}</strong></div>
    <div>Selisih Bersih: <strong>${formatRupiah(selisih)}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px;">No.</th>
        <th style="width: 70px;">Tanggal</th>
        <th style="width: 85px;">No. Bukti</th>
        <th class="text-left">Nama Siswa</th>
        <th style="width: 60px;">No. Rek</th>
        <th style="width: 55px;">Kelas</th>
        <th style="width: 65px;">Jenis</th>
        <th class="text-right" style="width: 95px;">Nilai</th>
      </tr>
    </thead>
    <tbody>
      ${data.length === 0 ? `
        <tr>
          <td colspan="8" class="text-center" style="padding: 20px;">Tidak ada transaksi pada periode ini.</td>
        </tr>
      ` : data.map((t, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="text-center">${esc(t.tanggal)}</td>
          <td class="text-center bold">${esc(t.nomor_bukti)}</td>
          <td>${esc(t.siswa_nama)}</td>
          <td class="text-center">${esc(t.siswa_nomor)}</td>
          <td class="text-center">${esc(t.kelas_nama || '-')}</td>
          <td class="text-center bold">${t.jenis === 'setoran' ? 'SETOR' : t.jenis === 'penarikan' ? 'TARIK' : 'KOREKSI'}</td>
          <td class="text-right tabular-nums bold" style="${t.nilai > 0 ? 'color: #0b7a40;' : 'color: #b31d28;'}">
            ${t.nilai > 0 ? `+${formatRupiah(t.nilai)}` : formatRupiah(t.nilai)}
          </td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background-color: #f2f2f2; font-weight: bold;">
        <td colspan="7" class="text-center">TOTAL MASUK</td>
        <td class="text-right tabular-nums" style="color: #0b7a40;">${formatRupiah(totalMasuk)}</td>
      </tr>
      <tr style="background-color: #f2f2f2; font-weight: bold;">
        <td colspan="7" class="text-center">TOTAL KELUAR</td>
        <td class="text-right tabular-nums" style="color: #b31d28;">${formatRupiah(totalKeluar)}</td>
      </tr>
      <tr style="background-color: #e6e6e6; font-weight: bold;">
        <td colspan="7" class="text-center">SELISIH BERSIH</td>
        <td class="text-right tabular-nums">${formatRupiah(selisih)}</td>
      </tr>
    </tfoot>
  </table>

  ${tandaTanganHtml(profil)}
</body>
</html>
  `.trim();
}

export function generateBukuBesarSiswaHtml(
  profil: ProfilSekolah,
  siswa: Siswa,
  transaksi: Transaksi[]
): string {
  let runningTotalSetoran = 0;
  let runningTotalPenarikan = 0;

  for (const t of transaksi) {
    if (t.nilai > 0) runningTotalSetoran += t.nilai;
    else if (t.nilai < 0) runningTotalPenarikan += Math.abs(t.nilai);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Buku Besar Tabungan - ${esc(siswa.nama)} (${esc(siswa.nomor)})</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${kopSekolahHtml(profil)}
  <div style="text-align: center; margin-bottom: 12px;">
    <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Buku Besar Rekening Tabungan Siswa</h3>
    <div style="font-size: 11px; color: #444; margin-top: 2px;">
      Dicetak pada: ${formatWaktuWib(new Date())}
    </div>
  </div>

  <table style="width: 100%; border: 1px solid #ccc; margin-bottom: 12px; font-size: 12px; background: #fafafa;">
    <tr>
      <td style="border: none; padding: 4px 8px; width: 120px;"><strong>No. Rekening:</strong></td>
      <td style="border: none; padding: 4px 8px; width: 220px; font-weight: bold; color: #1a4fa0;">${esc(siswa.nomor)}</td>
      <td style="border: none; padding: 4px 8px; width: 100px;"><strong>Kelas:</strong></td>
      <td style="border: none; padding: 4px 8px;">${esc(siswa.kelas_nama || '-')}</td>
    </tr>
    <tr>
      <td style="border: none; padding: 4px 8px;"><strong>Nama Siswa:</strong></td>
      <td style="border: none; padding: 4px 8px; font-weight: bold;">${esc(siswa.nama)}</td>
      <td style="border: none; padding: 4px 8px;"><strong>Status:</strong></td>
      <td style="border: none; padding: 4px 8px;">${esc(siswa.status.toUpperCase())}</td>
    </tr>
    <tr>
      <td style="border: none; padding: 4px 8px;"><strong>NIS:</strong></td>
      <td style="border: none; padding: 4px 8px;">${esc(siswa.nis || '-')}</td>
      <td style="border: none; padding: 4px 8px;"><strong>Saldo Saat Ini:</strong></td>
      <td style="border: none; padding: 4px 8px; font-weight: bold; font-size: 13px; color: #1a4fa0;">${formatRupiah(siswa.saldo ?? 0)}</td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th style="width: 25px;">No.</th>
        <th style="width: 75px;">Tanggal</th>
        <th style="width: 90px;">No. Bukti</th>
        <th style="width: 65px;">Jenis</th>
        <th class="text-right" style="width: 85px;">Setoran</th>
        <th class="text-right" style="width: 85px;">Penarikan</th>
        <th class="text-right" style="width: 95px;">Saldo</th>
        <th class="text-left">Keterangan</th>
      </tr>
    </thead>
    <tbody>
      ${transaksi.length === 0 ? `
        <tr>
          <td colspan="8" class="text-center" style="padding: 20px;">Belum ada riwayat transaksi.</td>
        </tr>
      ` : transaksi.map((t, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="text-center">${esc(t.tanggal)}</td>
          <td class="text-center bold">${esc(t.nomor_bukti)}</td>
          <td class="text-center bold">${t.jenis === 'setoran' ? 'SETOR' : t.jenis === 'penarikan' ? 'TARIK' : 'KOREKSI'}</td>
          <td class="text-right tabular-nums" style="color: #0b7a40;">${t.nilai > 0 ? formatRupiah(t.nilai) : '-'}</td>
          <td class="text-right tabular-nums" style="color: #b31d28;">${t.nilai < 0 ? formatRupiah(Math.abs(t.nilai)) : '-'}</td>
          <td class="text-right tabular-nums bold">${formatRupiah(t.saldo_setelah)}</td>
          <td style="font-size: 10px; color: #444;">${esc(t.keterangan || '-')}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background-color: #f2f2f2; font-weight: bold;">
        <td colspan="4" class="text-center">TOTAL MUTASI</td>
        <td class="text-right tabular-nums" style="color: #0b7a40;">${formatRupiah(runningTotalSetoran)}</td>
        <td class="text-right tabular-nums" style="color: #b31d28;">${formatRupiah(runningTotalPenarikan)}</td>
        <td class="text-right tabular-nums">${formatRupiah(siswa.saldo ?? 0)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  ${tandaTanganHtml(profil)}
</body>
</html>
  `.trim();
}
