import ExcelJS from 'exceljs';
import fs from 'node:fs';
import { getDb } from '../db/index.js';
import { LedgerService } from './ledger.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { parseRupiahKetat, formatRupiah } from '../../shared/rupiah.js';
import type {
  BarisImpor,
  HasilPratinjauImpor,
  OpsiImpor,
  PemetaanKolom,
  Result,
} from '../../shared/types.js';
import { ERROR_MESSAGES, type ErrorCode } from '../../shared/errors.js';

// Sinonim judul kolom (sudah dinormalisasi: huruf kecil, tanpa tanda baca). Nama kolom ditulis sendiri dari
// kebiasaan umum berkas Excel sekolah; bukan disalin dari aplikasi tertentu.
const SINONIM: Record<keyof PemetaanKolom, string[]> = {
  nama: ['nama', 'nama siswa', 'nama lengkap', 'nama murid', 'nama peserta didik', 'peserta didik', 'siswa', 'murid'],
  nis: ['nis', 'nisn', 'no induk', 'nomor induk', 'nomor induk siswa', 'nis nisn'],
  kelas: ['kelas', 'rombel', 'nama kelas', 'kelas rombel'],
  alamat: ['alamat', 'alamat siswa', 'alamat rumah'],
  saldo: ['saldo', 'saldo akhir', 'saldo tabungan', 'jumlah saldo', 'total saldo', 'saldo awal', 'tabungan', 'jumlah tabungan'],
};
const KATA_KUNCI: Record<keyof PemetaanKolom, string[]> = {
  nama: ['nama'],
  nis: ['nis', 'nisn'],
  kelas: ['kelas', 'rombel'],
  alamat: ['alamat'],
  saldo: ['saldo'],
};
// Judul yang memuat kata ini bukan nama siswa (mis. "Nama Ibu", "Nama Kelas")
const KATA_TOLAK_NAMA = ['ibu', 'ayah', 'bapak', 'wali', 'ortu', 'orang', 'kelas', 'sekolah', 'jenis'];
const URUTAN_FIELD: Array<keyof PemetaanKolom> = ['nama', 'nis', 'kelas', 'alamat', 'saldo'];
const BARIS_CONTOH = 3;
const BATAS_CARI_HEADER = 40;

const TIDAK_ADA: PemetaanKolom = { nama: -1, nis: -1, kelas: -1, alamat: -1, saldo: -1 };
const ROMAWI: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};

interface BarisMentah {
  nomor: number;
  teks: string[];
  mentah: unknown[];
}

class GagalImpor extends Error {
  constructor(
    public kode: ErrorCode,
    public pesan: string
  ) {
    super(pesan);
  }
}

function normalisasi(judul: string): string {
  return judul
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Menebak pemetaan dari judul kolom: kecocokan persis dengan sinonim didahulukan, lalu kata kunci utuh. */
export function tebakPemetaan(judul: string[]): PemetaanKolom {
  const norm = judul.map(normalisasi);
  const hasil: PemetaanKolom = { ...TIDAK_ADA };
  const terpakai = new Set<number>();

  for (const field of URUTAN_FIELD) {
    let terbaik = -1;
    let skorTerbaik = 0;
    norm.forEach((h, i) => {
      if (!h || terpakai.has(i)) return;
      const kata = h.split(' ');
      let skor = 0;
      if (SINONIM[field].includes(h)) skor = 3;
      else if (KATA_KUNCI[field].some((k) => kata.includes(k))) {
        skor = field === 'nama' && kata.some((k) => KATA_TOLAK_NAMA.includes(k)) ? 0 : 2;
      }
      if (skor > skorTerbaik) {
        skorTerbaik = skor;
        terbaik = i;
      }
    });
    if (terbaik !== -1) {
      hasil[field] = terbaik;
      terpakai.add(terbaik);
    }
  }
  return hasil;
}

/** "7A" menjadi 7, "VII B" menjadi 7; selain itu 1 (dapat diubah di menu Tahun Ajaran & Kelas). */
export function tingkatDariNama(nama: string): number {
  const angka = /^\s*(\d{1,2})/.exec(nama);
  if (angka) {
    const n = Number(angka[1]);
    return n >= 1 && n <= 20 ? n : 1;
  }
  const romawi = /^\s*(xii|xi|ix|x|viii|vii|vi|iv|v|iii|ii|i)/i.exec(nama);
  return romawi ? ROMAWI[romawi[1].toLowerCase()] : 1;
}

function nilaiSel(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return (v as { result?: unknown }).result ?? null;
    if ('richText' in v) return (v as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join('');
    if ('text' in v) return (v as { text: string }).text;
  }
  return v;
}

function deteksiPemisah(filePath: string): string {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const pertama = buf.toString('utf-8', 0, n).split(/\r?\n/)[0] ?? '';
    const baris = pertama.charCodeAt(0) === 0xfeff ? pertama.slice(1) : pertama; // buang BOM
    const hitung = (c: string) => baris.split(c).length - 1;
    const kandidat = [',', ';', '\t'].sort((a, b) => hitung(b) - hitung(a));
    return hitung(kandidat[0]) > 0 ? kandidat[0] : ',';
  } finally {
    fs.closeSync(fd);
  }
}

async function bacaBaris(filePath: string): Promise<BarisMentah[]> {
  const workbook = new ExcelJS.Workbook();
  if (filePath.toLowerCase().endsWith('.csv')) {
    // map identitas: tanpa ini ExcelJS mengubah teks seperti "50.000" menjadi angka 50 dan NIS "007" menjadi 7
    await workbook.csv.readFile(filePath, { parserOptions: { delimiter: deteksiPemisah(filePath) }, map: (v: unknown) => v });
  } else {
    await workbook.xlsx.readFile(filePath);
  }
  const lembar = workbook.worksheets[0];
  if (!lembar) throw new GagalImpor('FILE_TIDAK_VALID', 'Lembar kerja Excel tidak ditemukan.');

  const hasil: BarisMentah[] = [];
  lembar.eachRow({ includeEmpty: false }, (row, nomor) => {
    const teks: string[] = [];
    const mentah: unknown[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      const sel = row.getCell(c);
      teks.push((sel.text ?? '').toString().trim());
      mentah.push(nilaiSel(sel.value));
    }
    hasil.push({ nomor, teks, mentah });
  });
  return hasil;
}

export class ImporService {
  /**
   * CAP-04: berkas contoh berisi judul kolom yang dikenali dan dua baris fiktif, ditambah lembar petunjuk.
   * Isinya ditulis sendiri; tidak meniru format aplikasi lain.
   */
  public async buatContoh(targetPath: string): Promise<Result<{ berkas: string }>> {
    try {
      const wb = new ExcelJS.Workbook();
      const data = wb.addWorksheet('Siswa');
      data.columns = [
        { header: 'Nama Siswa', key: 'nama', width: 28 },
        { header: 'NIS', key: 'nis', width: 14 },
        { header: 'Kelas', key: 'kelas', width: 10 },
        { header: 'Alamat', key: 'alamat', width: 30 },
        { header: 'Saldo', key: 'saldo', width: 16, style: { numFmt: '#,##0' } },
      ];
      data.addRow({ nama: 'Contoh Siswa Satu', nis: '1001', kelas: '7A', alamat: 'Jl. Contoh No. 1', saldo: 50000 });
      data.addRow({ nama: 'Contoh Siswa Dua', nis: '1002', kelas: '7B', alamat: '', saldo: 0 });

      const petunjuk = wb.addWorksheet('Petunjuk');
      petunjuk.getColumn(1).width = 100;
      [
        'Hapus dua baris contoh, lalu isi data siswa Anda mulai dari baris kedua lembar "Siswa".',
        'Nama Siswa wajib diisi. NIS, Kelas, Alamat, dan Saldo boleh dikosongkan.',
        'NIS dipakai agar siswa yang sama tidak diimpor dua kali.',
        'Saldo berupa bilangan bulat rupiah tanpa sen, misalnya 50000 atau Rp 50.000. Saldo dicatat sebagai saldo awal.',
        'Kelas yang belum ada dibuat otomatis pada tahun ajaran aktif.',
        'Bila judul kolom berbeda, Anda dapat memilih kolomnya sendiri saat impor.',
      ].forEach((t) => petunjuk.addRow([t]));

      await wb.xlsx.writeFile(targetPath);
      return { ok: true, data: { berkas: targetPath } };
    } catch {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Gagal membuat berkas contoh.' };
    }
  }

  /**
   * CAP-04 dan CAP-14: membaca berkas Excel/CSV, menebak (atau memakai) pemetaan kolom, lalu memvalidasi tiap baris
   * untuk pratinjau sebelum disimpan. Kolom saldo (opsional) dipakai untuk migrasi saldo awal.
   */
  public async pratinjau(filePath: string, opsi: OpsiImpor = {}): Promise<Result<HasilPratinjauImpor>> {
    const db = getDb();
    try {
      const semua = await bacaBaris(filePath);
      if (semua.length === 0) {
        return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Berkas kosong.' };
      }

      // Cari baris judul: baris pertama (maks. 40 teratas) yang memuat kolom nama siswa
      let idxHeader = -1;
      let tebakan: PemetaanKolom = { ...TIDAK_ADA };
      for (let i = 0; i < Math.min(semua.length, BATAS_CARI_HEADER); i++) {
        const t = tebakPemetaan(semua[i].teks);
        if (t.nama !== -1) {
          idxHeader = i;
          tebakan = t;
          break;
        }
      }
      const adaHeader = idxHeader !== -1;
      if (!adaHeader) idxHeader = 0;
      const pemetaan = opsi.pemetaan ?? tebakan;

      const lebar = Math.max(...semua.slice(0, idxHeader + 1 + BARIS_CONTOH).map((b) => b.teks.length));
      const kolom = Array.from({ length: lebar }, (_, i) => semua[idxHeader].teks[i] || `Kolom ${i + 1}`);
      const data = semua.slice(idxHeader + 1);
      const contoh = data.slice(0, BARIS_CONTOH).map((b) => Array.from({ length: lebar }, (_, i) => b.teks[i] ?? ''));

      const hasilKosong: HasilPratinjauImpor = {
        kolom,
        baris_header: semua[idxHeader].nomor,
        pemetaan,
        contoh,
        total_baris: 0,
        valid_count: 0,
        invalid_count: 0,
        total_saldo: 0,
        jumlah_dengan_saldo: 0,
        kelas_baru: [],
        peringatan: ['Pilih kolom yang berisi nama siswa.'],
        baris: [],
      };
      if (pemetaan.nama === -1) return { ok: true, data: hasilKosong };

      const aktifTa = db.prepare(`SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1`).get() as { id: number } | undefined;
      const kelasAda = new Set(
        aktifTa
          ? (db.prepare(`SELECT nama FROM kelas WHERE tahun_ajaran_id = ?`).all(aktifTa.id) as Array<{ nama: string }>).map(
              (k) => k.nama.trim().toLowerCase()
            )
          : []
      );
      const nisAda = new Set(
        (db.prepare(`SELECT nis FROM siswa WHERE nis IS NOT NULL`).all() as Array<{ nis: string }>).map((r) =>
          r.nis.trim().toLowerCase()
        )
      );
      const namaAda = new Set(
        (db.prepare(`SELECT nama FROM siswa`).all() as Array<{ nama: string }>).map((r) => r.nama.trim().toLowerCase())
      );

      const nisDiBerkas = new Set<string>();
      const kelasBaru = new Map<string, string>();
      const baris: BarisImpor[] = [];
      let totalSaldo = 0;
      let denganSaldo = 0;
      let namaSama = 0;

      for (const b of data) {
        if (b.teks.every((t) => t === '')) continue;
        const ambil = (i: number) => (i === -1 ? '' : (b.teks[i] ?? ''));
        const nama = ambil(pemetaan.nama).trim();
        const nis = ambil(pemetaan.nis).trim() || null;
        const kelas = ambil(pemetaan.kelas).trim() || null;
        const alamat = ambil(pemetaan.alamat).trim() || null;

        let valid = true;
        let alasan: string | undefined;
        let catatan: string | undefined;
        let saldo: number | null = null;

        if (!nama) {
          valid = false;
          alasan = 'Nama siswa tidak boleh kosong';
        } else if (nis) {
          const k = nis.toLowerCase();
          if (nisAda.has(k)) {
            valid = false;
            alasan = `NIS "${nis}" sudah terdaftar di sistem`;
          } else if (nisDiBerkas.has(k)) {
            valid = false;
            alasan = `NIS "${nis}" duplikat dalam berkas impor ini`;
          } else {
            nisDiBerkas.add(k);
          }
        }

        if (valid && pemetaan.saldo !== -1) {
          const p = parseRupiahKetat(b.mentah[pemetaan.saldo] ?? b.teks[pemetaan.saldo]);
          if (!p.ok) {
            valid = false;
            alasan = `Saldo: ${p.alasan}`;
          } else if (p.nilai > 0) {
            saldo = p.nilai;
          }
        }

        if (valid) {
          if (!nis && namaAda.has(nama.toLowerCase())) {
            catatan = 'Nama sama dengan siswa yang sudah ada (tanpa NIS tidak bisa dipastikan orang yang sama)';
            namaSama++;
          }
          if (saldo) {
            totalSaldo += saldo;
            denganSaldo++;
          }
          if (kelas && aktifTa && !kelasAda.has(kelas.toLowerCase())) kelasBaru.set(kelas.toLowerCase(), kelas);
        }

        baris.push({ nomor_baris: b.nomor, nama, nis, kelas, alamat, saldo, valid, alasan_galat: alasan, catatan });
      }

      const peringatan: string[] = [];
      if (pemetaan.kelas !== -1 && !aktifTa && baris.some((x) => x.kelas)) {
        peringatan.push(
          'Belum ada tahun ajaran aktif, sehingga kelas di berkas tidak akan dipasang. Buat tahun ajaran di menu Tahun Ajaran & Kelas lebih dulu bila kelas ingin ikut.'
        );
      }
      if (kelasBaru.size > 0) {
        peringatan.push(`${kelasBaru.size} kelas belum ada dan akan dibuat otomatis (tingkat ditebak dari namanya).`);
      }
      if (namaSama > 0) {
        peringatan.push(`${namaSama} siswa bernama sama dengan siswa yang sudah ada. Periksa agar tidak menggandakan.`);
      }

      const validCount = baris.filter((x) => x.valid).length;
      return {
        ok: true,
        data: {
          kolom,
          baris_header: semua[idxHeader].nomor,
          pemetaan,
          contoh,
          total_baris: baris.length,
          valid_count: validCount,
          invalid_count: baris.length - validCount,
          total_saldo: totalSaldo,
          jumlah_dengan_saldo: denganSaldo,
          kelas_baru: [...kelasBaru.values()],
          peringatan,
          baris,
        },
      };
    } catch (err) {
      if (err instanceof GagalImpor) return { ok: false, kode: err.kode, pesan: err.pesan };
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Gagal membaca berkas. Pastikan format Excel/CSV valid.' };
    }
  }

  /**
   * CAP-04 dan CAP-14: menerapkan impor secara atomik dalam satu transaksi SQL (semua atau tidak sama sekali).
   * Saldo awal dicatat lewat LedgerService. Bila angka kontrol diberikan, harus cocok dengan isi berkas.
   */
  public async terapkan(
    filePath: string,
    opsi: OpsiImpor = {}
  ): Promise<Result<{ jumlah_diimpor: number; jumlah_saldo_awal: number; total_saldo: number }>> {
    const pratinjauRes = await this.pratinjau(filePath, opsi);
    if (!pratinjauRes.ok) return pratinjauRes;

    const hasil = pratinjauRes.data;
    if (hasil.pemetaan.nama === -1) {
      return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Pilih kolom yang berisi nama siswa.' };
    }
    if (hasil.invalid_count > 0) {
      return {
        ok: false,
        kode: 'VALIDASI_GAGAL',
        pesan: `Terdapat ${hasil.invalid_count} baris bermasalah. Perbaiki berkas lalu coba kembali (impor atomik).`,
      };
    }
    if (hasil.valid_count === 0) {
      return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Tidak ada baris siswa yang dapat diimpor.' };
    }

    const kontrol = opsi.kontrol;
    if (kontrol?.jumlah_siswa !== undefined && kontrol.jumlah_siswa !== hasil.valid_count) {
      return {
        ok: false,
        kode: 'VALIDASI_GAGAL',
        pesan: `Jumlah siswa di berkas (${hasil.valid_count}) tidak sama dengan angka kontrol (${kontrol.jumlah_siswa}). Tidak ada data yang diubah.`,
      };
    }
    if (kontrol?.total_saldo !== undefined && kontrol.total_saldo !== hasil.total_saldo) {
      return {
        ok: false,
        kode: 'VALIDASI_GAGAL',
        pesan: `Total saldo di berkas (${formatRupiah(hasil.total_saldo)}) tidak sama dengan angka kontrol (${formatRupiah(kontrol.total_saldo)}). Tidak ada data yang diubah.`,
      };
    }

    const tanggalSaldo = opsi.tanggal_saldo_awal || hariIniLokal();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalSaldo)) {
      return { ok: false, kode: 'VALIDASI_GAGAL', pesan: 'Tanggal saldo awal tidak valid.' };
    }

    const db = getDb();
    const ledger = new LedgerService();
    const dibuatPada = new Date().toISOString();

    try {
      let jumlah = 0;
      let jumlahSaldo = 0;

      const tx = db.transaction(() => {
        const aktifTa = db.prepare(`SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1`).get() as { id: number } | undefined;

        const nama = filePath.split(/[\\/]/).pop() || 'impor_siswa.xlsx';
        const imporId = Number(
          db
            .prepare(`INSERT INTO impor (jenis, nama_berkas, jumlah_baris, dibuat_pada) VALUES (?, ?, ?, ?)`)
            .run(hasil.total_saldo > 0 ? 'siswa_saldo' : 'siswa', nama, hasil.baris.length, dibuatPada).lastInsertRowid
        );

        const naikSekuens = db.prepare(
          `INSERT INTO sekuens (nama, nilai) VALUES ('nomor_siswa', 1) ON CONFLICT(nama) DO UPDATE SET nilai = nilai + 1`
        );
        const bacaSekuens = db.prepare(`SELECT nilai FROM sekuens WHERE nama = 'nomor_siswa'`);
        const sisipSiswa = db.prepare(
          `INSERT INTO siswa (nomor, nis, nama, alamat, status, dibuat_pada) VALUES (?, ?, ?, ?, 'aktif', ?)`
        );
        const cariKelas = db.prepare(`SELECT id FROM kelas WHERE tahun_ajaran_id = ? AND LOWER(nama) = LOWER(?) LIMIT 1`);
        const sisipKelas = db.prepare(`INSERT INTO kelas (tahun_ajaran_id, nama, tingkat, urutan) VALUES (?, ?, ?, 1)`);
        const sisipPenempatan = db.prepare(`INSERT INTO penempatan (siswa_id, kelas_id, tahun_ajaran_id) VALUES (?, ?, ?)`);

        for (const b of hasil.baris) {
          naikSekuens.run();
          const seq = (bacaSekuens.get() as { nilai: number }).nilai;
          const nomor = `T-${seq.toString().padStart(6, '0')}`;
          const siswaId = Number(sisipSiswa.run(nomor, b.nis, b.nama, b.alamat, dibuatPada).lastInsertRowid);

          if (aktifTa && b.kelas) {
            let kelasId = (cariKelas.get(aktifTa.id, b.kelas) as { id: number } | undefined)?.id;
            if (kelasId === undefined) {
              kelasId = Number(sisipKelas.run(aktifTa.id, b.kelas, tingkatDariNama(b.kelas)).lastInsertRowid);
            }
            sisipPenempatan.run(siswaId, kelasId, aktifTa.id);
          }

          if (b.saldo) {
            const r = ledger.saldoAwal({
              siswa_id: siswaId,
              nominal: b.saldo,
              tanggal: tanggalSaldo,
              impor_id: imporId,
              keterangan: 'Saldo awal (impor)',
            });
            if (!r.ok) throw new GagalImpor(r.kode as ErrorCode, r.pesan);
            jumlahSaldo++;
          }
          jumlah++;
        }

        // Ringkasan hanya jumlah, tanpa nama atau nominal (NFR-02)
        db.prepare(
          `INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan) VALUES (?, 'impor.siswa', 'impor', ?, ?)`
        ).run(dibuatPada, imporId, `Impor siswa sebanyak ${jumlah} baris, ${jumlahSaldo} dengan saldo awal`);
      });
      tx();

      return { ok: true, data: { jumlah_diimpor: jumlah, jumlah_saldo_awal: jumlahSaldo, total_saldo: hasil.total_saldo } };
    } catch (err) {
      if (err instanceof GagalImpor) return { ok: false, kode: err.kode, pesan: err.pesan };
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
