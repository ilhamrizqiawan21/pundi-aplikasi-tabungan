import { useState } from 'react';
import type { HasilPratinjauImpor } from '../../shared/types.js';

export function ImporScreen() {
  const [selectedFile, setSelectedFile] = useState<{ token: string; nama_berkas: string } | null>(null);
  const [pratinjau, setPratinjau] = useState<HasilPratinjauImpor | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePilihFile = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setPratinjau(null);

    const res = await window.pundi.dialogPilihFile({ ekstensi: ['xlsx', 'csv'] });
    if (res.ok && res.data) {
      setSelectedFile(res.data);
      setLoading(true);
      try {
        const pRes = await window.pundi.imporPratinjau(res.data.token);
        if (pRes.ok) {
          setPratinjau(pRes.data);
        } else {
          setErrorMsg(pRes.pesan);
        }
      } catch {
        setErrorMsg('Gagal membaca berkas.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTerapkan = async () => {
    if (!selectedFile || !pratinjau) return;
    if (pratinjau.invalid_count > 0) {
      setErrorMsg('Perbaiki baris bermasalah terlebih dahulu sebelum menerapkan impor.');
      return;
    }

    setImporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await window.pundi.imporTerapkan(selectedFile.token);
      if (res.ok) {
        setSuccessMsg(`Berhasil mengimpor ${res.data.jumlah_diimpor} data siswa secara atomik.`);
        setPratinjau(null);
        setSelectedFile(null);
      } else {
        setErrorMsg(res.pesan);
      }
    } catch {
      setErrorMsg('Terjadi kesalahan saat menerapkan impor data.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Kartu Panduan */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--surface)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
            Impor Siswa dari Excel / CSV (CAP-04)
          </h3>
          <p style={{ color: 'var(--muted)' }}>
            Pastikan berkas Excel Anda memiliki header: <strong>Nama Siswa</strong>, <strong>NIS</strong> (opsional), <strong>Kelas</strong> (opsional), dan <strong>Alamat</strong> (opsional).
          </p>
        </div>

        <button
          onClick={handlePilihFile}
          style={{
            padding: '10px 18px',
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
          Pilih Berkas Excel / CSV
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
          Menganalisis berkas dan memvalidasi baris...
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#FDEDEC',
            color: 'var(--danger)',
            borderRadius: '6px',
            border: '1px solid #FADBD8',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#EAF7ED',
            color: 'var(--ok)',
            borderRadius: '6px',
            border: '1px solid #C3E6CB',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ✓ {successMsg}
        </div>
      )}

      {/* Pratinjau Baris Impor */}
      {pratinjau && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Ringkasan Validasi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--surface)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Total Baris</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{pratinjau.total_baris} baris</div>
            </div>
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#EAF7ED',
                borderRadius: '6px',
                border: '1px solid #C3E6CB',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--ok)' }}>Baris Valid</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ok)' }}>
                {pratinjau.valid_count} baris
              </div>
            </div>
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: pratinjau.invalid_count > 0 ? '#FDEDEC' : 'var(--surface)',
                borderRadius: '6px',
                border: pratinjau.invalid_count > 0 ? '1px solid #FADBD8' : '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '12px', color: pratinjau.invalid_count > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                Baris Bermasalah
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: pratinjau.invalid_count > 0 ? 'var(--danger)' : 'var(--text)',
                }}
              >
                {pratinjau.invalid_count} baris
              </div>
            </div>
          </div>

          {/* Tabel Pratinjau */}
          <div
            style={{
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
              maxHeight: '380px',
              overflowY: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '8px 12px' }}>Baris</th>
                  <th style={{ padding: '8px 12px' }}>Nama Siswa</th>
                  <th style={{ padding: '8px 12px' }}>NIS</th>
                  <th style={{ padding: '8px 12px' }}>Kelas</th>
                  <th style={{ padding: '8px 12px' }}>Status Validasi</th>
                </tr>
              </thead>
              <tbody>
                {pratinjau.baris.map((b) => (
                  <tr
                    key={b.nomor_baris}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: b.valid ? 'transparent' : '#FDF2E9',
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{b.nomor_baris}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{b.nama || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{b.nis || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{b.kelas || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {b.valid ? (
                        <span style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Valid</span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          ✕ {b.alasan_galat}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tombol Terapkan */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={() => {
                setPratinjau(null);
                setSelectedFile(null);
              }}
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
              onClick={handleTerapkan}
              disabled={importing || pratinjau.invalid_count > 0}
              style={{
                padding: '8px 22px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: pratinjau.invalid_count === 0 ? 'var(--ok)' : '#BDC3C7',
                color: '#fff',
                fontWeight: 600,
                cursor: pratinjau.invalid_count === 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {importing ? 'Menerapkan Impor...' : `Terapkan Impor (${pratinjau.valid_count} Siswa)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
