import { useState } from 'react';
import { Modal } from './Modal.js';
import { tombol, tombolUtama } from '../styles/ui.js';

interface PratinjauCetakModalProps {
  terbuka: boolean;
  judul: string;
  html: string;
  onTutup: () => void;
  onSimpanPdf?: () => Promise<void> | void;
  /** Lembar sempit berorientasi potret (mis. struk); tanpa ini lembar selebar pratinjau (laporan). */
  potret?: boolean;
}

export function PratinjauCetakModal({
  terbuka,
  judul,
  html,
  onTutup,
  onSimpanPdf,
  potret = false,
}: PratinjauCetakModalProps) {
  const [mencetak, setMencetak] = useState(false);
  const [menyimpanPdf, setMenyimpanPdf] = useState(false);
  const [pesan, setPesan] = useState<{ teks: string; jenis: 'ok' | 'err' } | null>(null);

  if (!terbuka) return null;

  const handleCetak = async () => {
    setPesan(null);
    setMencetak(true);
    try {
      const res = await window.pundi.cetakHtml(html);
      if (res.ok) {
        setPesan({ teks: 'Perintah cetak berhasil dikirim ke printer.', jenis: 'ok' });
      } else {
        setPesan({ teks: res.pesan || 'Pencetakan dibatalkan atau gagal.', jenis: 'err' });
      }
    } catch {
      setPesan({ teks: 'Terjadi galat saat memproses cetak.', jenis: 'err' });
    } finally {
      setMencetak(false);
    }
  };

  const handleSimpan = async () => {
    if (!onSimpanPdf) return;
    setPesan(null);
    setMenyimpanPdf(true);
    try {
      await onSimpanPdf();
    } finally {
      setMenyimpanPdf(false);
    }
  };

  return (
    <Modal isOpen={terbuka} title={`Pratinjau Cetak: ${judul}`} onClose={onTutup} width="880px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
        {pesan && (
          <div
            role={pesan.jenis === 'err' ? 'alert' : 'status'}
            style={{
              padding: '8px 12px',
              border: `1px solid ${pesan.jenis === 'ok' ? 'var(--ok)' : 'var(--danger)'}`,
              color: pesan.jenis === 'ok' ? 'var(--ok)' : 'var(--danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
            }}
          >
            {pesan.teks}
          </div>
        )}

        {/* Iframe Document Preview */}
        <div
          style={{
            backgroundColor: 'var(--viewer-bg)',
            padding: '20px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            justifyContent: 'center',
            maxHeight: '65vh',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              width: potret ? '420px' : '100%',
              maxWidth: '100%',
              minHeight: '400px',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <iframe
              title="Pratinjau Dokumen"
              srcDoc={html}
              style={{
                width: '100%',
                height: potret ? '520px' : '480px',
                border: 'none',
                display: 'block',
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          {onSimpanPdf && (
            <button
              type="button"
              style={tombol}
              onClick={handleSimpan}
              disabled={menyimpanPdf || mencetak}
            >
              {menyimpanPdf ? 'Menyimpan PDF...' : 'Simpan PDF'}
            </button>
          )}
          <button
            type="button"
            style={tombolUtama}
            onClick={handleCetak}
            disabled={mencetak || menyimpanPdf}
          >
            {mencetak ? 'Mencetak...' : 'Cetak'}
          </button>
          <button
            type="button"
            style={tombol}
            onClick={onTutup}
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
