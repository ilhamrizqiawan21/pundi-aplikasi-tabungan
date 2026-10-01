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

export function generateReceiptHtml(
  transaksi: Transaksi,
  siswa: Siswa,
  profil: ProfilSekolah,
  ukuran: UkuranStruk = '80'
): string {
  const widthMm = ukuran === '58' ? '54mm' : ukuran === '80' ? '76mm' : '100mm';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Struk Bukti Transaksi - ${esc(transaksi.nomor_bukti)}</title>
  <style>
    @page {
      size: ${widthMm} auto;
      margin: 2mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${ukuran === '58' ? '10px' : '12px'};
      width: ${widthMm};
      margin: 0 auto;
      color: #000;
      line-height: 1.3;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  </style>
</head>
<body>
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
    <span>${transaksi.jenis === 'setoran' ? 'SETORAN' : transaksi.jenis === 'penarikan' ? 'PENARIKAN' : 'KOREKSI'}</span>
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
</body>
</html>
  `.trim();
}
