import ExcelJS from 'exceljs';
import { getDb } from '../db/index.js';
import type { Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

export interface BarisImporSiswa {
  nomor_baris: number;
  nama: string;
  nis: string | null;
  kelas: string | null;
  alamat: string | null;
  valid: boolean;
  alasan_galat?: string;
}

export interface HasilPratinjauImpor {
  total_baris: number;
  valid_count: number;
  invalid_count: number;
  baris: BarisImporSiswa[];
}

export class ImporService {
  /**
   * CAP-04: Membaca dan memvalidasi berkas Excel/CSV untuk pratinjau sebelum disimpan
   */
  public async pratinjau(filePath: string): Promise<Result<HasilPratinjauImpor>> {
    const db = getDb();
    try {
      const workbook = new ExcelJS.Workbook();
      if (filePath.endsWith('.csv')) {
        await workbook.csv.readFile(filePath);
      } else {
        await workbook.xlsx.readFile(filePath);
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Lembar kerja Excel tidak ditemukan.' };
      }

      const barisList: BarisImporSiswa[] = [];
      const nisSet = new Set<string>();

      // Ambil NIS yang sudah ada di basis data untuk deteksi duplikasi
      const existingNisRows = db.prepare(`SELECT nis FROM siswa WHERE nis IS NOT NULL`).all() as Array<{
        nis: string;
      }>;
      const existingNis = new Set(existingNisRows.map((r) => r.nis.trim().toLowerCase()));

      let headerFound = false;
      let colMap = { nama: -1, nis: -1, kelas: -1, alamat: -1 };

      worksheet.eachRow((row, rowNumber) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        const strValues = values.map((v) => (v ? String(v).trim() : ''));

        if (!headerFound) {
          // Cari header
          for (let i = 0; i < strValues.length; i++) {
            const h = strValues[i].toLowerCase();
            if (h.includes('nama')) colMap.nama = i;
            if (h.includes('nis')) colMap.nis = i;
            if (h.includes('kelas')) colMap.kelas = i;
            if (h.includes('alamat')) colMap.alamat = i;
          }

          if (colMap.nama !== -1) {
            headerFound = true;
          }
          return;
        }

        // Jika baris kosong seluruhnya, lewati
        if (strValues.every((v) => v === '')) return;

        const rawNama = colMap.nama !== -1 ? strValues[colMap.nama] || '' : '';
        const rawNis = colMap.nis !== -1 ? strValues[colMap.nis] || '' : '';
        const rawKelas = colMap.kelas !== -1 ? strValues[colMap.kelas] || '' : '';
        const rawAlamat = colMap.alamat !== -1 ? strValues[colMap.alamat] || '' : '';

        const nama = rawNama.trim();
        const nis = rawNis.trim() || null;
        const kelas = rawKelas.trim() || null;
        const alamat = rawAlamat.trim() || null;

        let valid = true;
        let alasanGalat: string | undefined;

        if (!nama) {
          valid = false;
          alasanGalat = 'Nama siswa tidak boleh kosong';
        } else if (nis) {
          const lowerNis = nis.toLowerCase();
          if (existingNis.has(lowerNis)) {
            valid = false;
            alasanGalat = `NIS "${nis}" sudah terdaftar di sistem`;
          } else if (nisSet.has(lowerNis)) {
            valid = false;
            alasanGalat = `NIS "${nis}" duplikat dalam berkas impor ini`;
          } else {
            nisSet.add(lowerNis);
          }
        }

        barisList.push({
          nomor_baris: rowNumber,
          nama,
          nis,
          kelas,
          alamat,
          valid,
          alasan_galat: alasanGalat,
        });
      });

      const validCount = barisList.filter((b) => b.valid).length;
      const invalidCount = barisList.filter((b) => !b.valid).length;

      return {
        ok: true,
        data: {
          total_baris: barisList.length,
          valid_count: validCount,
          invalid_count: invalidCount,
          baris: barisList,
        },
      };
    } catch {
      return { ok: false, kode: 'FILE_TIDAK_VALID', pesan: 'Gagal membaca berkas. Pastikan format Excel/CSV valid.' };
    }
  }

  /**
   * CAP-04: Menerapkan impor data siswa secara atomik dalam satu transaksi SQL
   */
  public async terapkan(filePath: string): Promise<Result<{ jumlah_diimpor: number }>> {
    const pratinjauRes = await this.pratinjau(filePath);
    if (!pratinjauRes.ok) {
      return pratinjauRes;
    }

    const { baris, invalid_count } = pratinjauRes.data;
    if (invalid_count > 0) {
      return {
        ok: false,
        kode: 'VALIDASI_GAGAL',
        pesan: `Terdapat ${invalid_count} baris bermasalah. Perbaiki berkas lalu coba kembali (impor atomik).`,
      };
    }

    const db = getDb();
    const dibuatPada = new Date().toISOString();

    try {
      let count = 0;

      const tx = db.transaction(() => {
        const aktifTa = db.prepare(`SELECT id FROM tahun_ajaran WHERE aktif = 1 LIMIT 1`).get() as {
          id: number;
        } | undefined;

        // Catat entri impor
        const filename = filePath.split(/[\\/]/).pop() || 'impor_siswa.xlsx';
        const imporInsert = db.prepare(`
          INSERT INTO impor (jenis, nama_berkas, jumlah_baris, dibuat_pada)
          VALUES ('siswa', ?, ?, ?)
        `).run(filename, baris.length, dibuatPada);

        const imporId = Number(imporInsert.lastInsertRowid);

        for (const b of baris) {
          // Buat nomor rekening unik sekuensial
          db.prepare(`
            INSERT INTO sekuens (nama, nilai) VALUES ('nomor_siswa', 1)
            ON CONFLICT(nama) DO UPDATE SET nilai = nilai + 1
          `).run();

          const seqRow = db.prepare(`SELECT nilai FROM sekuens WHERE nama = 'nomor_siswa'`).get() as {
            nilai: number;
          };
          const nomor = `T-${seqRow.nilai.toString().padStart(6, '0')}`;

          const siswaInsert = db.prepare(`
            INSERT INTO siswa (nomor, nis, nama, alamat, status, dibuat_pada)
            VALUES (?, ?, ?, ?, 'aktif', ?)
          `).run(nomor, b.nis, b.nama, b.alamat, dibuatPada);

          const siswaId = Number(siswaInsert.lastInsertRowid);

          // Jika ada kelas dan tahun ajaran aktif, hubungkan penempatan kelas
          if (aktifTa && b.kelas) {
            let kelasRow = db.prepare(`
              SELECT id FROM kelas WHERE tahun_ajaran_id = ? AND LOWER(nama) = LOWER(?) LIMIT 1
            `).get(aktifTa.id, b.kelas) as { id: number } | undefined;

            // Jika kelas belum ada di tahun ajaran aktif, buatkan otomatis
            if (!kelasRow) {
              const kInsert = db.prepare(`
                INSERT INTO kelas (tahun_ajaran_id, nama, tingkat, urutan)
                VALUES (?, ?, 1, 1)
              `).run(aktifTa.id, b.kelas);
              kelasRow = { id: Number(kInsert.lastInsertRowid) };
            }

            db.prepare(`
              INSERT INTO penempatan (siswa_id, kelas_id, tahun_ajaran_id)
              VALUES (?, ?, ?)
            `).run(siswaId, kelasRow.id, aktifTa.id);
          }

          count++;
        }

        db.prepare(`
          INSERT INTO audit_log (waktu, aksi, entitas, entitas_id, ringkasan)
          VALUES (?, 'impor.siswa', 'impor', ?, ?)
        `).run(dibuatPada, imporId, `Impor siswa sebanyak ${count} baris`);
      });

      tx();

      return { ok: true, data: { jumlah_diimpor: count } };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
