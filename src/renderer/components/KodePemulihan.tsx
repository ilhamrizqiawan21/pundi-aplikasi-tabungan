import { useState } from 'react';
import { tombolUtama } from '../styles/ui.js';

interface KodePemulihanProps {
  kode: string;
  onSelesai: () => void;
}

/** Menampilkan kode pemulihan sekali saja. Pengguna harus menyatakan sudah menyimpannya sebelum lanjut. */
export function KodePemulihan({ kode, onSelesai }: KodePemulihanProps) {
  const [paham, setPaham] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontSize: '13px', lineHeight: 1.6 }}>
        Tulis atau cetak <strong>kode pemulihan</strong> ini dan simpan di tempat aman, terpisah dari komputer.
        Kode ini satu-satunya cara membuka aplikasi bila PIN lupa, dan <strong>tidak akan ditampilkan lagi</strong>.
      </p>
      <div
        aria-label="Kode pemulihan"
        className="tabular-nums"
        style={{
          padding: '16px',
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 800,
          letterSpacing: '2px',
          fontFamily: 'ui-monospace, Consolas, monospace',
          border: '2px dashed var(--accent)',
          borderRadius: 'var(--radius-md)',
          userSelect: 'all',
        }}
      >
        {kode}
      </div>
      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
        <input type="checkbox" checked={paham} onChange={(e) => setPaham(e.target.checked)} />
        Saya sudah menyimpan kode pemulihan ini.
      </label>
      <div>
        <button type="button" style={{ ...tombolUtama, opacity: paham ? 1 : 0.5 }} disabled={!paham} onClick={onSelesai}>
          Selesai
        </button>
      </div>
    </div>
  );
}
