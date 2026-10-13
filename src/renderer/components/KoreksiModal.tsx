import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from './Modal.js';
import type { Transaksi } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { Button } from './ui/index.js';
import './panel-bersama.css';

interface KoreksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pembalik: Transaksi) => void;
  transaksi: Transaksi | null;
}

export function KoreksiModal({
  isOpen,
  onClose,
  onSuccess,
  transaksi,
}: KoreksiModalProps) {
  const [alasan, setAlasan] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setAlasan('');
    setErrorMsg(null);
  }, [isOpen, transaksi]);

  if (!transaksi) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!alasan.trim() || alasan.trim().length < 3) {
      setErrorMsg('Alasan koreksi wajib diisi (minimal 3 karakter).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await window.pundi.transaksiBalik({
        transaksi_id: transaksi.id,
        alasan: alasan.trim(),
      });

      if (res.ok) {
        onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(res.pesan);
      }
    } catch {
      setErrorMsg('Terjadi kesalahan saat memproses koreksi transaksi.');
    } finally {
      setLoading(false);
    }
  };

  const warnaNilai = transaksi.nilai > 0 ? 'pb-ok' : 'pb-danger';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Koreksi Transaksi (Pembalik)">
      <form onSubmit={handleSubmit} className="pb-kolom">
        {/* Rincian Transaksi yang akan dikoreksi */}
        <div className="pb-rincian">
          <div className="pb-sebelah pb-sebelah-rapat">
            <span className="pb-muted">Nomor Bukti</span>
            <strong>{transaksi.nomor_bukti}</strong>
          </div>
          <div className="pb-sebelah pb-sebelah-rapat">
            <span className="pb-muted">Tanggal & Jenis</span>
            <span>
              {transaksi.tanggal} •{' '}
              <span className={`pb-tebal ${warnaNilai}`}>{transaksi.jenis.toUpperCase()}</span>
            </span>
          </div>
          <div className="pb-sebelah">
            <span className="pb-muted">Nominal</span>
            <strong className={warnaNilai}>
              {transaksi.nilai > 0 ? `+${formatRupiah(transaksi.nilai)}` : formatRupiah(transaksi.nilai)}
            </strong>
          </div>
        </div>

        <div className="pb-peringatan">
          Transaksi lama tidak akan dihapus. Sistem akan mencatat transaksi pembalik sebesar{' '}
          <strong>{formatRupiah(-transaksi.nilai)}</strong> dengan keterangan alasan yang Anda berikan.
        </div>

        {errorMsg && (
          <div role="alert" className="pb-pesan pb-pesan-galat pb-pesan-galat-solid">
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="koreksi-alasan" className="pb-label-biasa">
            Alasan Koreksi <span className="pb-danger">*</span>
          </label>
          <input
            id="koreksi-alasan"
            type="text"
            required
            maxLength={255}
            autoFocus
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: Salah input nominal oleh bendahara"
            className="ui-input"
          />
        </div>

        <div className="pb-aksi pb-aksi-atas">
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="danger" disabled={loading}>
            {loading ? 'Memproses...' : 'Terapkan Koreksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
