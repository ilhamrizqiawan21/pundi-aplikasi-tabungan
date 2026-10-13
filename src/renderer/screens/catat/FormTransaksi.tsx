import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { JenisTransaksi } from '../../../shared/types.js';
import { formatRupiah, parseRupiah } from '../../../shared/rupiah.js';
import { Button } from '../../components/ui/index.js';
import { IconCalendar, IconCheck } from '../../components/Icons.js';

const NOMINAL_CEPAT = [10000, 20000, 50000, 100000];

interface FormTransaksiProps {
  jenis: JenisTransaksi;
  onJenisChange: (jenis: JenisTransaksi) => void;
  bolehSetor: boolean;
  nominalRaw: string;
  onNominalChange: (nilai: string) => void;
  onNominalKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  onTambahNominal: (tambah: number) => void;
  nominalInputRef: RefObject<HTMLInputElement>;
  tanggal: string;
  onTanggalChange: (nilai: string) => void;
  keterangan: string;
  onKeteranganChange: (nilai: string) => void;
  saldoSesudah: number;
  sedangMenyimpan: boolean;
  adaSiswa: boolean;
  onGantiSiswa: () => void;
  onSubmit: (e: FormEvent) => void;
}

/** Form transaksi baru: nominal besar, pilihan setoran/penarikan, tanggal, keterangan. */
export function FormTransaksi(props: FormTransaksiProps) {
  const { jenis, bolehSetor, nominalRaw, nominalInputRef } = props;

  return (
    <form className="catat-form" onSubmit={props.onSubmit}>
      <div className="catat-form-header">
        <h3 className="catat-form-judul">Transaksi baru</h3>

        <div className="catat-segmented">
          <button
            type="button"
            disabled={!bolehSetor}
            title={bolehSetor ? undefined : 'Siswa lulus/keluar tidak dapat menyetor; hanya penarikan sisa saldo.'}
            className={jenis === 'setoran' ? 'catat-segmented-btn active-setor' : 'catat-segmented-btn'}
            onClick={() => {
              props.onJenisChange('setoran');
              nominalInputRef.current?.focus();
            }}
          >
            <span>↓</span> Setoran
          </button>
          <button
            type="button"
            className={jenis === 'penarikan' ? 'catat-segmented-btn active-tarik' : 'catat-segmented-btn'}
            onClick={() => {
              props.onJenisChange('penarikan');
              nominalInputRef.current?.focus();
            }}
          >
            <span>↑</span> Penarikan
          </button>
        </div>
      </div>

      <div>
        <label className="catat-label" htmlFor="catat-nominal">
          NOMINAL
        </label>
        <div className="catat-nominal-input-box">
          <input
            id="catat-nominal"
            ref={nominalInputRef}
            type="text"
            placeholder="Rp 0"
            value={nominalRaw}
            className={`catat-nominal-input ${jenis} tabular-nums`}
            onChange={(e) => {
              const angka = parseRupiah(e.target.value);
              props.onNominalChange(angka === 0 ? '' : formatRupiah(angka));
            }}
            onKeyDown={props.onNominalKeyDown}
          />
          <div className="catat-enter-pill">
            <span>Enter</span>
            <span>↵</span>
          </div>
        </div>

        <div className="catat-chips">
          {NOMINAL_CEPAT.map((amt) => (
            <button key={amt} type="button" className="catat-chip" onClick={() => props.onTambahNominal(amt)}>
              + {formatRupiah(amt).replace('Rp ', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="catat-baris-dua">
        <div>
          <label className="catat-label rapat" htmlFor="catat-tanggal">
            TANGGAL
          </label>
          <div className="catat-tanggal-box">
            <IconCalendar width={15} height={15} />
            <input
              id="catat-tanggal"
              type="date"
              className="catat-tanggal-input"
              value={props.tanggal}
              onChange={(e) => props.onTanggalChange(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="catat-label rapat" htmlFor="catat-keterangan">
            KETERANGAN (OPSIONAL)
          </label>
          <input
            id="catat-keterangan"
            type="text"
            className="catat-teks-input"
            value={props.keterangan}
            onChange={(e) => props.onKeteranganChange(e.target.value)}
            placeholder="Misalnya: setoran mingguan"
          />
        </div>
      </div>

      <div className="catat-form-footer">
        <div>
          <div className="catat-footer-label">Saldo sesudah transaksi</div>
          <div className="catat-footer-nilai tabular-nums">{formatRupiah(props.saldoSesudah)}</div>
        </div>

        <div className="catat-footer-aksi">
          <Button type="button" onClick={props.onGantiSiswa}>
            Ganti Siswa (Esc)
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={props.sedangMenyimpan || !props.adaSiswa}
            iconLeft={<IconCheck width={16} height={16} />}
          >
            <span>Simpan transaksi</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
