import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { Siswa } from '../../../shared/types.js';
import { formatRupiah } from '../../../shared/rupiah.js';
import { Button } from '../../components/ui/index.js';
import { StudentAvatar, IconSearch } from '../../components/Icons.js';

interface DaftarSiswaPanelProps {
  query: string;
  onQueryChange: (nilai: string) => void;
  onSearchKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  hasil: Siswa[];
  indeksFokus: number;
  siswaTerpilih: Siswa | null;
  onPilih: (siswa: Siswa) => void;
  onBukaSetoranKelas: () => void;
  onBukaBiayaAdm: () => void;
}

function labelMeta(s: Siswa): string {
  const kelas = s.kelas_nama ? `${s.kelas_nama} · ` : '';
  const status = s.status !== 'aktif' ? ` · ${s.status === 'lulus' ? 'Lulus' : 'Keluar'}` : '';
  return `${kelas}${s.nomor}${status}`;
}

/** Kolom kiri Catat Transaksi: pencarian dan daftar siswa (navigasi keyboard penuh, DESIGN §6). */
export function DaftarSiswaPanel({
  query,
  onQueryChange,
  onSearchKeyDown,
  searchInputRef,
  hasil,
  indeksFokus,
  siswaTerpilih,
  onPilih,
  onBukaSetoranKelas,
  onBukaBiayaAdm,
}: DaftarSiswaPanelProps) {
  return (
    <section className="catat-kiri">
      <div className="catat-kiri-header">
        <div className="catat-kiri-title-row">
          <h3 className="catat-kiri-judul">Pilih siswa</h3>
          <span className="catat-kiri-jumlah">{hasil.length} siswa</span>
        </div>
        <div className="catat-kiri-action-grid">
          <Button type="button" size="sm" onClick={onBukaSetoranKelas}>
            Setoran per Kelas
          </Button>
          <Button type="button" size="sm" onClick={onBukaBiayaAdm}>
            Biaya Adm
          </Button>
        </div>
      </div>

      <div className="catat-cari-wrapper">
        <div className="catat-cari-icon">
          <IconSearch width={15} height={15} />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          className="catat-cari-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Ketik nama siswa, nomor rekening (T-...), atau NIS..."
        />
      </div>

      <div className="catat-siswa-list" tabIndex={0} role="region" aria-label="Daftar Siswa">
        {hasil.map((s, idx) => {
          const terpilih = siswaTerpilih?.id === s.id;
          const fokus = idx === indeksFokus && !siswaTerpilih;
          const kelas = terpilih ? 'catat-siswa-item selected' : fokus ? 'catat-siswa-item focused' : 'catat-siswa-item';
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              className={kelas}
              onClick={() => onPilih(s)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPilih(s);
                }
              }}
            >
              <div className="catat-siswa-info">
                <StudentAvatar name={s.nama} size={32} fontSize={11} />
                <div className="catat-siswa-teks">
                  <div className="catat-siswa-nama">{s.nama}</div>
                  <div className="catat-siswa-meta">{labelMeta(s)}</div>
                </div>
              </div>
              <div className="catat-siswa-saldo">{formatRupiah(s.saldo ?? 0)}</div>
            </div>
          );
        })}

        {hasil.length === 0 && <div className="catat-kosong-list">Tidak ada siswa yang cocok</div>}
      </div>
    </section>
  );
}
