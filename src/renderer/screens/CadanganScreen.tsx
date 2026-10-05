import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/Modal.js';
import { formatWaktuWib } from '../../shared/tanggal.js';

interface ItemBackup {
  nama: string;
  token: string;
  jenis: 'manual' | 'otomatis' | 'pre-restore';
  ukuran: number;
  tanggal: string;
}

const LABEL_JENIS: Record<ItemBackup['jenis'], string> = {
  manual: 'Manual',
  otomatis: 'Otomatis',
  'pre-restore': 'Pengaman sebelum pemulihan',
};

export function CadanganScreen() {
  const [backups, setBackups] = useState<ItemBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [target, setTarget] = useState<{ token: string; nama: string } | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.pundi.backupDaftar();
      if (res.ok) {
        setBackups(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleBuatCadangan = async () => {
    setCreating(true);
    setMsg(null);
    try {
      const res = await window.pundi.backupBuat('manual');
      if (res.ok) {
        setMsg({ text: `Cadangan berhasil dibuat (${res.data.berkas}).`, type: 'ok' });
        fetchBackups();
      } else {
        setMsg({ text: `Gagal membuat cadangan: ${res.pesan}`, type: 'err' });
      }
    } catch {
      setMsg({ text: 'Terjadi kesalahan saat membuat cadangan.', type: 'err' });
    } finally {
      setCreating(false);
    }
  };

  const handleSalinKeLuar = async () => {
    setMsg(null);
    const res = await window.pundi.backupSalinKeLuar();
    if (!res.ok) setMsg({ text: `Gagal menyalin cadangan: ${res.pesan}`, type: 'err' });
    else if (res.data) setMsg({ text: `Salinan cadangan tersimpan di folder pilihan Anda (${res.data.nama_berkas}).`, type: 'ok' });
  };

  const handlePilihBerkas = async () => {
    setMsg(null);
    const res = await window.pundi.dialogPilihFile({ ekstensi: ['sqlite'] });
    if (res.ok && res.data) {
      setTarget({ token: res.data.token, nama: res.data.nama_berkas });
    } else if (!res.ok) {
      setMsg({ text: res.pesan, type: 'err' });
    }
  };

  const handlePulihkan = async () => {
    if (!target) return;
    setRestoring(true);
    setMsg(null);
    try {
      const res = await window.pundi.backupRestore(target.token);
      if (res.ok) {
        // Muat ulang agar seluruh layar membaca data hasil pemulihan
        alert('Data berhasil dipulihkan. Pundi akan memuat ulang.');
        window.location.reload();
        return;
      }
      setMsg({ text: `Pemulihan dibatalkan: ${res.pesan}`, type: 'err' });
      setTarget(null);
    } catch {
      setMsg({ text: 'Terjadi kesalahan saat memulihkan data. Data Anda tidak diubah.', type: 'err' });
      setTarget(null);
    } finally {
      setRestoring(false);
    }
  };

  const formatUkuran = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', margin: '0 auto' }}>
      {/* Header & Aksi Cadangkan */}
      <div
        style={{
          padding: '20px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
            Cadangan dan pemulihan data
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Pundi menyimpan cadangan otomatis secara berkala. Sangat disarankan untuk menyalin berkas cadangan ke flashdisk atau media penyimpanan eksternal.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={handleSalinKeLuar}
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Salin ke flashdisk…
        </button>
        <button
          onClick={handlePilihBerkas}
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Pulihkan dari berkas…
        </button>
        <button
          onClick={handleBuatCadangan}
          disabled={creating}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-text)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {creating ? 'Membuat...' : 'Cadangkan Sekarang'}
        </button>
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: msg.type === 'ok' ? '#EAF7ED' : '#FDEDEC',
            color: msg.type === 'ok' ? 'var(--ok)' : 'var(--danger)',
            border: `1px solid ${msg.type === 'ok' ? '#C3E6CB' : '#FADBD8'}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Daftar Berkas Cadangan */}
      <div
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Daftar Berkas Cadangan Tersimpan</h4>
          <button
            onClick={fetchBackups}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Segarkan
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Nama Berkas Cadangan</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Jenis</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Waktu Dibuat</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Ukuran</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                  Memuat daftar cadangan...
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                  Belum ada berkas cadangan. Klik "Cadangkan Sekarang" untuk membuat cadangan baru.
                </td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.nama} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{b.nama}</td>
                  <td style={{ padding: '10px 16px' }}>{LABEL_JENIS[b.jenis]}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>
                    {formatWaktuWib(b.tanggal)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 16px', textAlign: 'right' }}>
                    {formatUkuran(b.ukuran)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => setTarget({ token: b.token, nama: b.nama })}
                      aria-label={`Pulihkan dari ${b.nama}`}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Pulihkan
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={target !== null}
        onClose={() => (restoring ? undefined : setTarget(null))}
        title="Pulihkan Data dari Cadangan"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              border: '1px solid var(--danger)',
              borderRadius: '6px',
              color: 'var(--danger)',
              fontWeight: 600,
            }}
          >
            Data yang ada sekarang akan diganti dengan isi berkas ini. Transaksi yang dicatat setelah cadangan itu dibuat tidak akan ada lagi.
          </div>
          <p>
            Berkas: <strong>{target?.nama}</strong>
          </p>
          <p style={{ color: 'var(--muted)' }}>
            Pundi membuat cadangan pengaman dari data saat ini terlebih dahulu, sehingga pemulihan masih bisa dibatalkan.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              autoFocus
              disabled={restoring}
              onClick={() => setTarget(null)}
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
              type="button"
              disabled={restoring}
              onClick={handlePulihkan}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--danger)',
                color: 'var(--accent-text)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {restoring ? 'Memulihkan...' : 'Pulihkan Sekarang'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
