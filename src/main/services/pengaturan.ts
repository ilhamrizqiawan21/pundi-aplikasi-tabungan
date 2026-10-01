import { getDb } from '../db/index.js';
import type { ProfilSekolah, Pengaturan, Result } from '../../shared/types.js';
import { ERROR_MESSAGES } from '../../shared/errors.js';

export class PengaturanService {
  public profilBaca(): Result<ProfilSekolah> {
    const db = getDb();
    try {
      const row = db.prepare(`SELECT * FROM profil_sekolah WHERE id = 1`).get() as ProfilSekolah | undefined;
      if (!row) {
        return {
          ok: true,
          data: {
            id: 1,
            nama: 'Madrasah / Sekolah',
            alamat: null,
            kota: null,
            bendahara: null,
            kepala: null,
            logo_rel_path: null,
            diubah_pada: new Date().toISOString(),
          },
        };
      }
      return { ok: true, data: row };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public profilSimpan(data: Partial<ProfilSekolah>): Result<ProfilSekolah> {
    const db = getDb();
    const diubahPada = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO profil_sekolah (id, nama, alamat, kota, bendahara, kepala, logo_rel_path, diubah_pada)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          nama = COALESCE(excluded.nama, profil_sekolah.nama),
          alamat = COALESCE(excluded.alamat, profil_sekolah.alamat),
          kota = COALESCE(excluded.kota, profil_sekolah.kota),
          bendahara = COALESCE(excluded.bendahara, profil_sekolah.bendahara),
          kepala = COALESCE(excluded.kepala, profil_sekolah.kepala),
          logo_rel_path = COALESCE(excluded.logo_rel_path, profil_sekolah.logo_rel_path),
          diubah_pada = excluded.diubah_pada
      `).run(
        data.nama || 'Madrasah / Sekolah',
        data.alamat || null,
        data.kota || null,
        data.bendahara || null,
        data.kepala || null,
        data.logo_rel_path || null,
        diubahPada
      );

      return this.profilBaca();
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public pengaturanBaca(): Result<Pengaturan> {
    const db = getDb();
    try {
      const rows = db.prepare(`SELECT kunci, nilai_json FROM pengaturan`).all() as Array<{
        kunci: string;
        nilai_json: string;
      }>;

      const map: Record<string, unknown> = {};
      for (const r of rows) {
        try {
          map[r.kunci] = JSON.parse(r.nilai_json);
        } catch {
          map[r.kunci] = r.nilai_json;
        }
      }

      const pengaturan: Pengaturan = {
        tema: (map['tema'] as Pengaturan['tema']) || 'putih',
        folder_backup: (map['folder_backup'] as string) || '',
        backup_otomatis: map['backup_otomatis'] !== undefined ? Boolean(map['backup_otomatis']) : true,
        ukuran_struk: (map['ukuran_struk'] as Pengaturan['ukuran_struk']) || '80',
        pin_hash: (map['pin_hash'] as string) || null,
      };

      return { ok: true, data: pengaturan };
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }

  public pengaturanSimpan(data: Partial<Pengaturan>): Result<Pengaturan> {
    const db = getDb();
    const diubahPada = new Date().toISOString();
    try {
      const tx = db.transaction(() => {
        for (const [kunci, nilai] of Object.entries(data)) {
          if (nilai !== undefined) {
            db.prepare(`
              INSERT INTO pengaturan (kunci, nilai_json, diubah_pada)
              VALUES (?, ?, ?)
              ON CONFLICT(kunci) DO UPDATE SET nilai_json = excluded.nilai_json, diubah_pada = excluded.diubah_pada
            `).run(kunci, JSON.stringify(nilai), diubahPada);
          }
        }
      });
      tx();

      return this.pengaturanBaca();
    } catch {
      return { ok: false, kode: 'DATABASE_ERROR', pesan: ERROR_MESSAGES.DATABASE_ERROR };
    }
  }
}
