import { useState } from 'react';
import { Button } from './ui/index.js';
import './panel-bersama.css';

interface KodePemulihanProps {
  kode: string;
  onSelesai: () => void;
}

/** Menampilkan kode pemulihan sekali saja. Pengguna harus menyatakan sudah menyimpannya sebelum lanjut. */
export function KodePemulihan({ kode, onSelesai }: KodePemulihanProps) {
  const [paham, setPaham] = useState(false);
  return (
    <div className="pb-kolom">
      <p className="pb-teks">
        Tulis atau cetak <strong>kode pemulihan</strong> ini dan simpan di tempat aman, terpisah dari komputer.
        Kode ini satu-satunya cara membuka aplikasi bila PIN lupa, dan <strong>tidak akan ditampilkan lagi</strong>.
      </p>
      <div
        aria-label="Kode pemulihan"
        className="tabular-nums pb-kode"
      >
        {kode}
      </div>
      <label className="pb-centang">
        <input type="checkbox" checked={paham} onChange={(e) => setPaham(e.target.checked)} />
        Saya sudah menyimpan kode pemulihan ini.
      </label>
      <div>
        <Button type="button" variant="primary" disabled={!paham} onClick={onSelesai}>
          Selesai
        </Button>
      </div>
    </div>
  );
}
