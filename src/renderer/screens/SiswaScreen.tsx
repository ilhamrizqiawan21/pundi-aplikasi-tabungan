import { useState, useEffect, useCallback } from 'react';
import type { Siswa, Kelas, StatusSiswa, Transaksi } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { SiswaFormModal } from '../components/SiswaFormModal.js';
import { KoreksiModal } from '../components/KoreksiModal.js';
import { Modal } from '../components/Modal.js';

export function SiswaScreen() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [query, setQuery] = useState('');
  const [filterKelasId, setFilterKelasId] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<StatusSiswa | ''>('');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [siswaToEdit, setSiswaToEdit] = useState<Siswa | null>(null);

  // Detail & Riwayat Drawer/Modal
  const [detailSiswa, setDetailSiswa] = useState<Siswa | null>(null);
  const [riwayatList, setRiwayatList] = useState<Transaksi[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [koreksiTarget, setKoreksiTarget] = useState<Transaksi | null>(null);

  const fetchSiswa = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.pundi.siswaCari(
        query,
        filterKelasId === '' ? undefined : Number(filterKelasId),
        filterStatus === '' ? undefined : filterStatus
      );
      if (res.ok) {
        setSiswaList(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [query, filterKelasId, filterStatus]);

  const fetchKelas = async () => {
    const res = await window.pundi.kelasDaftar();
    if (res.ok) {
      setKelasList(res.data);
    }
  };

  useEffect(() => {
    fetchKelas();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSiswa();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchSiswa]);

  const handleOpenDetail = async (siswa: Siswa) => {
    setDetailSiswa(siswa);
    setLoadingRiwayat(true);
    try {
      const res = await window.pundi.transaksiRiwayat({ siswa_id: siswa.id, limit: 100 });
      if (res.ok) {
        setRiwayatList(res.data);
      }
    } finally {
      setLoadingRiwayat(false);
    }
  };

  const handleDelete = async (siswa: Siswa) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa "${siswa.nama}" (${siswa.nomor})?`)) {
      const res = await window.pundi.siswaHapus(siswa.id);
      if (res.ok) {
        fetchSiswa();
        if (detailSiswa?.id === siswa.id) {
          setDetailSiswa(null);
        }
      } else {
        alert(res.pesan);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, nomor rekening (T-...), atau NIS..."
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              fontSize: '13px',
            }}
          />

          <select
            value={filterKelasId}
            onChange={(e) => setFilterKelasId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              fontSize: '13px',
            }}
          >
            <option value="">Semua Kelas</option>
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                Kelas {k.nama}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StatusSiswa | '')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              fontSize: '13px',
            }}
          >
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="lulus">Lulus</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>

        <button
          onClick={() => {
            setSiswaToEdit(null);
            setIsFormOpen(true);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-text)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>+</span> Tambah Siswa
        </button>
      </div>

      {/* Tabel Siswa */}
      <div
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>No. Rekening</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>NIS</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Nama Siswa</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Kelas</th>
              <th style={{ padding: '10px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Saldo</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                  Memuat data siswa...
                </td>
              </tr>
            ) : siswaList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                  {query
                    ? `Tidak ada siswa yang cocok dengan "${query}".`
                    : 'Belum ada siswa. Tambah satu atau impor dari Excel.'}
                </td>
              </tr>
            ) : (
              siswaList.map((s) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleOpenDetail(s)}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--accent)' }}>
                    {s.nomor}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{s.nis || '-'}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{s.nama}</td>
                  <td style={{ padding: '10px 16px' }}>{s.kelas_nama || '-'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor:
                          s.status === 'aktif'
                            ? '#EAF7ED'
                            : s.status === 'lulus'
                            ? '#E8F0FA'
                            : '#FDEDEC',
                        color:
                          s.status === 'aktif'
                            ? 'var(--ok)'
                            : s.status === 'lulus'
                            ? 'var(--accent)'
                            : 'var(--danger)',
                      }}
                    >
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td
                    className="tabular-nums"
                    style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}
                  >
                    {formatRupiah(s.saldo || 0)}
                  </td>
                  <td
                    style={{ padding: '10px 16px', textAlign: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          setSiswaToEdit(s);
                          setIsFormOpen(true);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--surface)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Ubah
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--surface)',
                          color: 'var(--danger)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Tambah/Ubah Modal */}
      <SiswaFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => {
          fetchSiswa();
        }}
        siswaToEdit={siswaToEdit}
        kelasList={kelasList}
      />

      {/* Detail Siswa & Buku Besar Modal */}
      <Modal
        isOpen={Boolean(detailSiswa)}
        onClose={() => setDetailSiswa(null)}
        title={`Buku Besar — ${detailSiswa?.nama || ''} (${detailSiswa?.nomor || ''})`}
        width="700px"
      >
        {detailSiswa && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Info Siswa Ringkas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px',
                padding: '12px',
                backgroundColor: 'var(--surface)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--muted)', display: 'block' }}>NIS</span>
                <span style={{ fontWeight: 600 }}>{detailSiswa.nis || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Kelas</span>
                <span style={{ fontWeight: 600 }}>{detailSiswa.kelas_nama || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Status</span>
                <span style={{ fontWeight: 600 }}>{detailSiswa.status}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Saldo Saat Ini</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '14px' }}>
                  {formatRupiah(detailSiswa.saldo || 0)}
                </span>
              </div>
            </div>

            {/* Riwayat Mutasi / Buku Besar */}
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
              Riwayat Transaksi
            </h4>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '6px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 12px' }}>No. Bukti</th>
                    <th style={{ padding: '8px 12px' }}>Tanggal</th>
                    <th style={{ padding: '8px 12px' }}>Jenis</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Nominal</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Saldo</th>
                    <th style={{ padding: '8px 12px' }}>Keterangan</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRiwayat ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
                        Memuat riwayat...
                      </td>
                    </tr>
                  ) : riwayatList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
                        Belum ada riwayat transaksi untuk siswa ini.
                      </td>
                    </tr>
                  ) : (
                    riwayatList.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.nomor_bukti}</td>
                        <td style={{ padding: '8px 12px' }}>{t.tanggal}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              color: t.nilai > 0 ? 'var(--ok)' : 'var(--danger)',
                            }}
                          >
                            {t.jenis.toUpperCase()}
                          </span>
                        </td>
                        <td
                          className="tabular-nums"
                          style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: t.nilai > 0 ? 'var(--ok)' : 'var(--danger)',
                          }}
                        >
                          {t.nilai > 0 ? `+${formatRupiah(t.nilai)}` : formatRupiah(t.nilai)}
                        </td>
                        <td className="tabular-nums" style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {formatRupiah(t.saldo_setelah)}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>
                          {t.keterangan || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {t.jenis !== 'pembalik' && !t.membalik_id && (
                            <button
                              onClick={() => setKoreksiTarget(t)}
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--surface)',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              Koreksi
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                onClick={() => setDetailSiswa(null)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Koreksi Modal */}
      <KoreksiModal
        isOpen={Boolean(koreksiTarget)}
        onClose={() => setKoreksiTarget(null)}
        transaksi={koreksiTarget}
        onSuccess={() => {
          if (detailSiswa) {
            handleOpenDetail(detailSiswa);
          }
          fetchSiswa();
        }}
      />
    </div>
  );
}
