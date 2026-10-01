import { useState, useEffect, useCallback } from 'react';

interface ItemBackup {
  nama: string;
  jalur: string;
  ukuran: number;
  tanggal: string;
}

export function CadanganScreen() {
  const [backups, setBackups] = useState<ItemBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

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
            Cadangan & Pemulihan Basis Data (CAP-13)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Pundi menyimpan cadangan otomatis secara berkala. Sangat disarankan untuk menyalin berkas cadangan ke flashdisk atau media penyimpanan eksternal.
          </p>
        </div>

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
            flexShrink: 0,
          }}
        >
          {creating ? 'Membuat...' : 'Cadangkan Sekarang'}
        </button>
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
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Waktu Dibuat</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Ukuran</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                  Memuat daftar cadangan...
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                  Belum ada berkas cadangan. Klik "Cadangkan Sekarang" untuk membuat cadangan baru.
                </td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.nama} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{b.nama}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>
                    {new Date(b.tanggal).toLocaleString('id-ID')}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 16px', textAlign: 'right' }}>
                    {formatUkuran(b.ukuran)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
