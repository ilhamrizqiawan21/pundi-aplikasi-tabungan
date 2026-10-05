import type { Transaksi, Siswa, ProfilSekolah, UkuranStruk } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';

export function esc(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const LABEL_STRUK: Record<string, string> = {
  setoran: 'SETORAN',
  penarikan: 'PENARIKAN',
  biaya_adm: 'BIAYA ADMINISTRASI',
  saldo_awal: 'SALDO AWAL',
  pembalik: 'KOREKSI',
};

export function generateReceiptHtml(
  transaksi: Transaksi,
  siswa: Siswa,
  profil: ProfilSekolah,
  ukuran: UkuranStruk = '80'
): string {
  // Lebar kotak struk (termasuk garis gunting dan isi). Dibuat <= lebar kertas dikurangi margin 3 mm di tiap sisi,
  // sehingga muat di roll 58/80 mm maupun kertas biasa. `@page size: NNmm auto` tidak sah di Chromium dan
  // diabaikan, jadi ukuran halaman dibiarkan mengikuti printer.
  const widthMm = ukuran === '58' ? '50mm' : ukuran === '80' ? '72mm' : '100mm';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Struk Bukti Transaksi - ${esc(transaksi.nomor_bukti)}</title>
  <style>
    @page {
      margin: 3mm;
    }
    html, body { margin: 0; padding: 0; }
    @media screen { body { padding: 3mm; } }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${ukuran === '58' ? '10px' : '12px'};
      color: #000;
      line-height: 1.3;
    }
    /* Garis putus-putus = batas gunting */
    .struk {
      box-sizing: border-box;
      width: ${widthMm};
      padding: 2.5mm;
      border: 0.4mm dashed #000;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 3px; }
    .row > span:first-child { white-space: nowrap; }
    .row > span:last-child { text-align: right; min-width: 0; overflow-wrap: anywhere; }
    .struk { overflow-wrap: anywhere; }
  </style>
</head>
<body>
<div class="struk">
  <div class="text-center bold" style="font-size: 14px;">${esc(profil.nama)}</div>
  ${profil.alamat ? `<div class="text-center">${esc(profil.alamat)}${profil.kota ? `, ${esc(profil.kota)}` : ''}</div>` : ''}
  <div class="divider"></div>

  <div class="row"><span>No. Bukti:</span><span class="bold">${esc(transaksi.nomor_bukti)}</span></div>
  <div class="row"><span>Tanggal:</span><span>${esc(transaksi.tanggal)}</span></div>
  <div class="row"><span>Nama:</span><span class="bold">${esc(siswa.nama)}</span></div>
  <div class="row"><span>No. Rek:</span><span>${esc(siswa.nomor)}</span></div>
  <div class="row"><span>Kelas:</span><span>${esc(siswa.kelas_nama || '-')}</span></div>
  <div class="divider"></div>

  <div class="row bold" style="font-size: 13px;">
    <span>${LABEL_STRUK[transaksi.jenis] ?? 'KOREKSI'}</span>
    <span>${transaksi.nilai > 0 ? formatRupiah(transaksi.nilai) : formatRupiah(Math.abs(transaksi.nilai))}</span>
  </div>
  <div class="row bold">
    <span>SALDO SESUDAH:</span>
    <span>${formatRupiah(transaksi.saldo_setelah)}</span>
  </div>

  ${transaksi.keterangan ? `<div class="divider"></div><div>Ket: ${esc(transaksi.keterangan)}</div>` : ''}

  <div class="divider"></div>
  <div class="text-center" style="font-size: 10px; margin-top: 6px;">
    Terima kasih telah menabung.<br>
    Simpan struk ini sebagai bukti sah.
  </div>
</div>
</body>
</html>
  `.trim();
}
