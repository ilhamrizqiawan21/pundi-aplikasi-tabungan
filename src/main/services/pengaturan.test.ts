import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDb, closeDb, getDb } from '../db/index.js';
import { PengaturanService } from './pengaturan.js';
import { PengaturanSimpanSchema, ProfilSekolahSimpanSchema } from '../../shared/schemas.js';

describe('PengaturanService (CAP-01, CAP-15)', () => {
  let tmpDir: string;
  const svc = new PengaturanService();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pundi-pengaturan-test-'));
    initDb({ dbPath: path.join(tmpDir, 'test.sqlite'), migrationsDir: path.join(process.cwd(), 'migrations') });
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('profil: kolom yang dikosongkan pengguna benar-benar kosong, bukan dipertahankan', () => {
    const a = svc.profilSimpan({ nama: 'SD Contoh', alamat: 'Jl. Fiktif 1', kota: 'Kota Fiktif', bendahara: 'Bu A', kepala: 'Pak B' });
    expect(a.ok && a.data.alamat).toBe('Jl. Fiktif 1');

    const b = svc.profilSimpan({ nama: 'SD Contoh', alamat: null, kota: null, bendahara: null, kepala: null });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.data).toMatchObject({ nama: 'SD Contoh', alamat: null, kota: null, bendahara: null, kepala: null });
  });

  it('profil: nama kosong/spasi memakai nama bawaan, logo tidak diubah lewat jalur ini', () => {
    getDb().prepare(`UPDATE profil_sekolah SET logo_rel_path = 'logo.png' WHERE id = 1`).run();
    const r = svc.profilSimpan({ nama: '   ' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.nama).toBe('Madrasah / Sekolah');
      expect(r.data.logo_rel_path).toBe('logo.png');
    }
  });

  it('pengaturan: hanya kunci yang diizinkan yang tertulis; pin_hash dan folder_backup tidak bisa diubah/dibaca', () => {
    const r = svc.pengaturanSimpan({
      tema: 'biru',
      pin_hash: 'x',
      folder_backup: 'C:/Windows',
    } as never);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.tema).toBe('biru');
      expect(Object.keys(r.data).sort()).toEqual(['backup_otomatis', 'tema', 'ukuran_struk']);
    }
    const baris = getDb().prepare(`SELECT kunci, nilai_json FROM pengaturan WHERE kunci IN ('pin_hash','folder_backup')`).all();
    expect(baris).toEqual(expect.arrayContaining([{ kunci: 'pin_hash', nilai_json: 'null' }, { kunci: 'folder_backup', nilai_json: '""' }]));
  });

  it('skema IPC membuang jalur berkas, hash PIN, dan tema/ukuran di luar daftar', () => {
    const p = PengaturanSimpanSchema.parse({ tema: 'putih', pin_hash: 'x', folder_backup: 'C:/x' });
    expect(p).toEqual({ tema: 'putih' });
    expect(PengaturanSimpanSchema.safeParse({ tema: 'merah' }).success).toBe(false);
    const q = ProfilSekolahSimpanSchema.parse({ nama: 'SD', logo_rel_path: '../../rahasia.png' });
    expect(q).toEqual({ nama: 'SD' });
  });
});
