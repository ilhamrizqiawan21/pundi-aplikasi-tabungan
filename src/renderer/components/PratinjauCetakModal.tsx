import { useState } from 'react';
import { Modal } from './Modal.js';
import { Button } from './ui/index.js';
import './panel-bersama.css';

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
      <div className="pb-pratinjau">
        {pesan && (
          <div
            role={pesan.jenis === 'err' ? 'alert' : 'status'}
            className={`pb-pesan pb-pesan-kecil ${pesan.jenis === 'ok' ? 'pb-pesan-ok' : 'pb-pesan-galat'}`}
          >
            {pesan.teks}
          </div>
        )}

        {/* Iframe Document Preview */}
        <div className="pb-viewer">
          <div className={potret ? 'pb-lembar pb-lembar-potret' : 'pb-lembar'}>
            <iframe
              title="Pratinjau Dokumen"
              srcDoc={html}
              className={potret ? 'pb-iframe pb-iframe-potret' : 'pb-iframe'}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pb-aksi pb-aksi-bawah">
          {onSimpanPdf && (
            <Button type="button" onClick={handleSimpan} disabled={menyimpanPdf || mencetak}>
              {menyimpanPdf ? 'Menyimpan PDF...' : 'Simpan PDF'}
            </Button>
          )}
          <Button type="button" variant="primary" onClick={handleCetak} disabled={mencetak || menyimpanPdf}>
            {mencetak ? 'Mencetak...' : 'Cetak'}
          </Button>
          <Button type="button" onClick={onTutup}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
}
