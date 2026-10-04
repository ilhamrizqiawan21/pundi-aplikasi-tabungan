import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from './Modal.js';
import type { Transaksi } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Koreksi Transaksi (Pembalik)">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Rincian Transaksi yang akan dikoreksi */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--surface)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--muted)' }}>Nomor Bukti</span>
            <strong>{transaksi.nomor_bukti}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--muted)' }}>Tanggal & Jenis</span>
            <span>
              {transaksi.tanggal} •{' '}
              <span style={{ fontWeight: 600, color: transaksi.nilai > 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {transaksi.jenis.toUpperCase()}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>Nominal</span>
            <strong style={{ color: transaksi.nilai > 0 ? 'var(--ok)' : 'var(--danger)' }}>
              {transaksi.nilai > 0 ? `+${formatRupiah(transaksi.nilai)}` : formatRupiah(transaksi.nilai)}
            </strong>
          </div>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--warn-text)',
            backgroundColor: 'var(--warn-bg)',
            border: '1px solid var(--warn)',
            padding: '8px 12px',
            borderRadius: '6px',
          }}
        >
          Transaksi lama tidak akan dihapus. Sistem akan mencatat transaksi pembalik sebesar{' '}
          <strong>{formatRupiah(-transaksi.nilai)}</strong> dengan keterangan alasan yang Anda berikan.
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              borderRadius: '6px',
              fontSize: '13px',
              border: '1px solid var(--danger)',
            }}
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="koreksi-alasan" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Alasan Koreksi <span style={{ color: 'var(--danger)' }}>*</span>
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
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--danger)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Memproses...' : 'Terapkan Koreksi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
