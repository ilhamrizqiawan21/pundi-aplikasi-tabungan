import type {
  ProfilSekolah,
  ItemRekapKelas,
  ItemLaporanSiswa,
  ItemLaporanTransaksi,
  ItemSlipSaldo,
  HasilRekapBulanan,
  RingkasanKasHarian,
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
          <td class="text-center bold">${esc(LABEL_BUKU[t.jenis] ?? 'KOREKSI')}</td>
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

const LABEL_BUKU: Record<string, string> = {
  setoran: 'SETOR',
  penarikan: 'TARIK',
  biaya_adm: 'BIAYA ADM',
  saldo_awal: 'SALDO AWAL',
  pembalik: 'KOREKSI',
};

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


const LABEL_JENIS: Record<string, string> = {
  setoran: 'Setor',
  penarikan: 'Tarik',
  pembalik: 'Koreksi',
  saldo_awal: 'Saldo awal',
};

/** Slip saldo siswa (CAP-18): dua kolom per halaman A4, satu slip per siswa, garis potong tipis. */
export function generateSlipSaldoHtml(profil: ProfilSekolah, data: ItemSlipSaldo[], judulKelas: string): string {
  const dicetak = formatTanggalIndonesia(new Date());
  const slip = (s: ItemSlipSaldo): string => `
    <div class="slip">
      <div class="slip-kop">${esc(profil.nama || 'TABUNGAN SISWA')}</div>
      <div class="slip-judul">Slip Saldo Tabungan</div>
      <div class="slip-nama">${esc(s.nama)}</div>
      <div class="slip-meta">${esc(s.nomor)} &middot; Kelas ${esc(s.kelas_nama || '-')}</div>
      <div class="slip-saldo tabular-nums">${formatRupiah(s.saldo)}</div>
      <table class="slip-tabel">
        <tbody>
          ${
            s.transaksi.length === 0
              ? '<tr><td class="text-center" colspan="3">Belum ada transaksi.</td></tr>'
              : s.transaksi
                  .map(
                    (t) => `<tr>
            <td>${esc(t.tanggal)}</td>
            <td>${esc(LABEL_JENIS[t.jenis] ?? t.jenis)}</td>
            <td class="text-right tabular-nums">${t.nilai < 0 ? '-' : ''}${formatRupiah(Math.abs(t.nilai))}</td>
          </tr>`
                  )
                  .join('')
          }
        </tbody>
      </table>
      <div class="slip-kaki">Per ${esc(dicetak)}</div>
    </div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Slip Saldo ${esc(judulKelas)}</title>
  <style>
    ${baseStyles}
    .lembar { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .slip { box-sizing: border-box; height: 66mm; padding: 4mm 5mm; border: 0.3mm dashed #888; page-break-inside: avoid; overflow: hidden; }
    .slip-kop { font-size: 9pt; font-weight: bold; text-transform: uppercase; text-align: center; }
    .slip-judul { font-size: 8pt; text-align: center; color: #444; margin-bottom: 2mm; }
    .slip-nama { font-size: 11pt; font-weight: bold; }
    .slip-meta { font-size: 8pt; color: #444; }
    .slip-saldo { font-size: 15pt; font-weight: bold; margin: 1.5mm 0; }
    .slip-tabel { font-size: 8pt; margin-top: 0; }
    .slip-tabel td { border: none; border-bottom: 0.2mm solid #ccc; padding: 0.6mm 1mm; }
    .slip-kaki { font-size: 7pt; color: #666; margin-top: 1mm; text-align: right; }
  </style>
</head>
<body>
  <div class="lembar">
    ${data.length === 0 ? '<p>Tidak ada siswa pada kelas ini.</p>' : data.map(slip).join('')}
  </div>
</body>
</html>
  `.trim();
}

/** Berita acara penutupan kas harian: hitung kas yang seharusnya lawan uang fisik di laci. */
export function generateTutupKasHtml(
  profil: ProfilSekolah,
  kas: RingkasanKasHarian,
  kasAwal: number,
  uangFisik: number
): string {
  const seharusnya = kasAwal + kas.total_setoran - kas.total_penarikan;
  const selisih = uangFisik - seharusnya;
  const ketSelisih = selisih === 0 ? 'Sesuai' : selisih > 0 ? 'Lebih' : 'Kurang';
  const baris = (label: string, nilai: string, tebal = false): string => `
    <tr>
      <td class="text-left${tebal ? ' bold' : ''}">${esc(label)}</td>
      <td class="text-right tabular-nums${tebal ? ' bold' : ''}">${nilai}</td>
    </tr>`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Berita Acara Kas Harian ${esc(kas.tanggal)}</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${kopSekolahHtml(profil)}
  <div style="text-align: center; margin-bottom: 12px;">
    <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Berita Acara Penutupan Kas Harian</h3>
    <div style="font-size: 12px; margin-top: 2px;">Tanggal ${esc(formatTanggalIndonesia(kas.tanggal))}</div>
  </div>
  <table style="max-width: 420px; margin: 0 auto;">
    <tbody>
      ${baris('Kas awal di laci', formatRupiah(kasAwal))}
      ${baris('Setoran hari ini', formatRupiah(kas.total_setoran))}
      ${baris('Penarikan hari ini', `- ${formatRupiah(kas.total_penarikan)}`)}
      ${baris('Kas seharusnya', formatRupiah(seharusnya), true)}
      ${baris('Uang fisik hasil hitung', formatRupiah(uangFisik), true)}
      ${baris(`Selisih (${ketSelisih})`, `${selisih > 0 ? '+ ' : selisih < 0 ? '- ' : ''}${formatRupiah(Math.abs(selisih))}`, true)}
      ${baris('Jumlah transaksi', String(kas.jumlah_transaksi))}
      ${kas.total_biaya_adm !== 0 ? baris('Biaya administrasi (mengurangi saldo siswa, tidak memengaruhi kas)', formatRupiah(kas.total_biaya_adm)) : ''}
    </tbody>
  </table>
  ${tandaTanganHtml(profil)}
</body>
</html>
  `.trim();
}


const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-03" menjadi "Maret 2026". */
export function labelBulan(bulan: string): string {
  const [y, m] = bulan.split('-');
  return `${NAMA_BULAN[Number(m) - 1] ?? m} ${y}`;
}

/** Rekap bulanan (CAP-22): setoran, penarikan, jumlah transaksi, dan saldo akhir tiap bulan. */
export function generateRekapBulananHtml(profil: ProfilSekolah, data: HasilRekapBulanan, dari: string, sampai: string): string {
  const totalSetoran = data.baris.reduce((t, r) => t + r.setoran, 0);
  const totalPenarikan = data.baris.reduce((t, r) => t + r.penarikan, 0);
  const totalTransaksi = data.baris.reduce((t, r) => t + r.jumlah_transaksi, 0);
  const saldoAkhir = data.baris.length > 0 ? data.baris[data.baris.length - 1].saldo_akhir : data.saldo_awal;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rekap Bulanan ${esc(dari)} sampai ${esc(sampai)}</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${kopSekolahHtml(profil)}
  <div style="text-align: center; margin-bottom: 12px;">
    <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Rekap Tabungan per Bulan</h3>
    <div style="font-size: 12px; margin-top: 2px;">${esc(formatTanggalIndonesia(dari))} sampai ${esc(formatTanggalIndonesia(sampai))}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="text-left">Bulan</th>
        <th class="text-right">Setoran</th>
        <th class="text-right">Penarikan</th>
        <th class="text-right">Biaya Adm</th>
        <th class="text-right">Transaksi</th>
        <th class="text-right">Saldo Akhir Bulan</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-left">Saldo awal periode</td>
        <td></td><td></td><td></td><td></td>
        <td class="text-right tabular-nums">${formatRupiah(data.saldo_awal)}</td>
      </tr>
      ${data.baris
        .map(
          (r) => `<tr>
        <td class="text-left">${esc(labelBulan(r.bulan))}</td>
        <td class="text-right tabular-nums">${formatRupiah(r.setoran)}</td>
        <td class="text-right tabular-nums">${formatRupiah(r.penarikan)}</td>
        <td class="text-right tabular-nums">${formatRupiah(r.biaya_adm)}</td>
        <td class="text-right tabular-nums">${r.jumlah_transaksi}</td>
        <td class="text-right tabular-nums">${formatRupiah(r.saldo_akhir)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr style="background-color: #f2f2f2; font-weight: bold;">
        <td class="text-left">Total</td>
        <td class="text-right tabular-nums">${formatRupiah(totalSetoran)}</td>
        <td class="text-right tabular-nums">${formatRupiah(totalPenarikan)}</td>
        <td class="text-right tabular-nums">${formatRupiah(data.baris.reduce((t, r) => t + r.biaya_adm, 0))}</td>
        <td class="text-right tabular-nums">${totalTransaksi}</td>
        <td class="text-right tabular-nums">${formatRupiah(saldoAkhir)}</td>
      </tr>
    </tfoot>
  </table>
  ${tandaTanganHtml(profil)}
</body>
</html>
  `.trim();
}
