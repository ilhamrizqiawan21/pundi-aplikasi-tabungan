import { useState, useEffect, useCallback, useRef } from 'react';
import type { Siswa, Kelas, StatusSiswa, Transaksi } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { formatTanggalIndonesia } from '../../shared/tanggal.js';
import { SiswaFormModal } from '../components/SiswaFormModal.js';
import { KoreksiModal } from '../components/KoreksiModal.js';
import { PratinjauCetakModal } from '../components/PratinjauCetakModal.js';
import {
  StudentAvatar,
  IconSearch,
  IconPrint,
  IconPdf,
  IconUndo,
} from '../components/Icons.js';

export function SiswaScreen() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [query, setQuery] = useState('');
  const [filterKelasId, setFilterKelasId] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<StatusSiswa | ''>('');
  const [selectedTingkat, setSelectedTingkat] = useState<string>('semua');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [siswaToEdit, setSiswaToEdit] = useState<Siswa | null>(null);

  // Detail Siswa Terpilih & Riwayat Buku Besar
  const [detailSiswa, setDetailSiswa] = useState<Siswa | null>(null);
  const [riwayatList, setRiwayatList] = useState<Transaksi[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [koreksiTarget, setKoreksiTarget] = useState<Transaksi | null>(null);

  // Pratinjau Cetak / PDF State
  const [pratinjauData, setPratinjauData] = useState<{
    html: string;
    judul: string;
    onSimpanPdf?: () => Promise<void>;
  } | null>(null);
  const [cetakLoading, setCetakLoading] = useState(false);

  const handleCetakBukuBesar = async (siswa: Siswa) => {
    setCetakLoading(true);
    try {
      const res = await window.pundi.cetakLaporanHtml({
        jenis: 'bukuBesar',
        siswaId: siswa.id,
      });
      if (res.ok) {
        setPratinjauData({
          html: res.data.html,
          judul: `Buku Besar - ${siswa.nama}`,
          onSimpanPdf: async () => {
            await window.pundi.cetakLaporanPdf({
              jenis: 'bukuBesar',
              siswaId: siswa.id,
            });
          },
        });
      }
    } finally {
      setCetakLoading(false);
    }
  };

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
    const ta = await window.pundi.tahunAjaranDaftar();
    const aktif = ta.ok ? ta.data.find((t) => t.aktif === 1) : undefined;
    if (!aktif) {
      setKelasList([]);
      return;
    }
    const res = await window.pundi.kelasDaftar(aktif.id);
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
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchSiswa]);

  const detailRef = useRef<HTMLElement>(null);

  const handleOpenDetail = useCallback(async (siswa: Siswa) => {
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
  }, []);

  // Pilih otomatis siswa pertama jika belum ada yang terpilih (seperti mockup)
  useEffect(() => {
    if (!detailSiswa && siswaList.length > 0) {
      handleOpenDetail(siswaList[0]);
    } else if (detailSiswa) {
      const updated = siswaList.find((s) => s.id === detailSiswa.id);
      if (updated && updated.saldo !== detailSiswa.saldo) {
        setDetailSiswa(updated);
      }
    }
  }, [siswaList, detailSiswa, handleOpenDetail]);

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

  // Filter siswa berdasarkan filter tingkat (7, 8, 9 atau semua)
  const filteredSiswa = siswaList.filter((s) => {
    if (selectedTingkat === 'semua') return true;
    if (selectedTingkat === 'aktif') return s.status === 'aktif';
    return s.kelas_nama?.startsWith(selectedTingkat);
  });

  return (
    <div className="grid-siswa">
      {/* ======================================================== */}
      {/* PANEL KIRI: DAFTAR SISWA                                 */}
      {/* ======================================================== */}
      <section
        className="siswa-daftar"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflow: 'hidden',
        }}
      >
        {/* Header Daftar Siswa & Tombol Tambah */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Daftar siswa
            </h3>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--muted)',
                backgroundColor: 'var(--bg)',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid var(--border)',
              }}
            >
              {siswaList.length} siswa
            </span>
          </div>

          <button
            onClick={() => {
              setSiswaToEdit(null);
              setIsFormOpen(true);
            }}
            style={{
              padding: '7px 14px',
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
            }}
          >
            <span>+</span> Tambah Siswa
          </button>
        </div>

        {/* Input Pencarian */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
            <IconSearch width={15} height={15} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau nomor"
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              fontSize: '13px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
            }}
          />
        </div>

        {/* Filter Bar: Kelas & Status Dropdowns */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={filterKelasId}
            onChange={(e) => setFilterKelasId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              fontSize: '12px',
              color: 'var(--text)',
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
              flex: 1,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              fontSize: '12px',
              color: 'var(--text)',
            }}
          >
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="lulus">Lulus</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>

        {/* Filter Pills: Semua kelas, 7, 8, 9, Aktif */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', flexShrink: 0 }}>
          {[
            { id: 'semua', label: 'Semua kelas' },
            { id: '7', label: '7' },
            { id: '8', label: '8' },
            { id: '9', label: '9' },
            { id: 'aktif', label: 'Aktif' },
          ].map((pill) => {
            const isActive = selectedTingkat === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedTingkat(pill.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  backgroundColor: isActive ? 'var(--accent)' : 'var(--bg)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease',
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Tabel daftar siswa */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '2px',
          }}
        >
          <table className="tabel">
            <tbody>
              {filteredSiswa.map((s) => {
                const isSelected = detailSiswa?.id === s.id;
                return (
                  <tr
                    key={s.id}
                    role="row"
                    onClick={() => {
                      void handleOpenDetail(s);
                      // Tata letak satu kolom: buku besar ada di bawah daftar, jadi bawa pengguna ke sana
                      if (window.matchMedia('(max-width: 1219px)').matches) {
                        requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
                      }
                    }}
                    className={isSelected ? 'baris-dipilih' : undefined}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <StudentAvatar name={s.nama} size={34} fontSize={12} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.nama}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
                              {s.nomor} {s.kelas_nama ? `· ${s.kelas_nama}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }} className="tabular-nums">
                            {formatRupiah(s.saldo ?? 0)}
                          </div>
                          {s.kelas_nama && (
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                              {s.kelas_nama}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredSiswa.length === 0 && (
                <tr>
                  <td style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                    {loading ? 'Memuat data siswa...' : 'Belum ada siswa yang cocok.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================== */}
      {/* PANEL KANAN: BUKU BESAR SISWA TERPILIH                   */}
      {/* ======================================================== */}
      <section ref={detailRef} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {detailSiswa ? (
          <>
            {/* Kartu siswa terpilih */}
            <div
              style={{
                background: 'linear-gradient(135deg, var(--hero-from) 0%, var(--hero-to) 100%)',
                borderRadius: 'var(--radius-xl)',
                padding: '24px 28px',
                color: 'var(--on-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <StudentAvatar name={detailSiswa.nama} size={54} fontSize={18} border="2px solid rgba(255, 255, 255, 0.3)" />
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', margin: 0 }}>
                    {detailSiswa.nama}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    {detailSiswa.kelas_nama && (
                      <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                        Kelas {detailSiswa.kelas_nama}
                      </span>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                      {detailSiswa.nomor} · {detailSiswa.status === 'aktif' ? 'Aktif' : detailSiswa.status}
                    </span>
                    <button
                      onClick={() => {
                        setSiswaToEdit(detailSiswa);
                        setIsFormOpen(true);
                      }}
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(255, 255, 255, 0.22)',
                        color: 'var(--on-color)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      Ubah
                    </button>
                    <button
                      onClick={() => handleDelete(detailSiswa)}
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(239, 68, 68, 0.35)',
                        color: 'var(--on-color)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', opacity: 0.85 }}>
                  SALDO
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginTop: '2px' }} className="tabular-nums">
                  {formatRupiah(detailSiswa.saldo ?? 0)}
                </div>
              </div>
            </div>

            {/* Card Buku Besar */}
            <div
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--card-shadow)',
                overflow: 'hidden',
              }}
            >
              {/* Header Buku Besar & Aksi Cetak / PDF */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    Buku besar
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', margin: 0 }}>
                    Transaksi tidak dapat diubah. Koreksi dibuat sebagai transaksi pembalik.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleCetakBukuBesar(detailSiswa)}
                    disabled={cetakLoading}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text)',
                    }}
                  >
                    <IconPrint width={14} height={14} />
                    <span>Cetak</span>
                  </button>

                  <button
                    onClick={() => handleCetakBukuBesar(detailSiswa)}
                    disabled={cetakLoading}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text)',
                    }}
                  >
                    <IconPdf width={14} height={14} />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              {/* Tabel Buku Besar */}
              <table className="tabel">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '22px' }}>Tanggal</th>
                    <th>No. Bukti</th>
                    <th>Jenis</th>
                    <th className="angka">Nominal</th>
                    <th className="angka">Saldo</th>
                    <th className="tengah">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRiwayat ? (
                    <tr>
                      <td colSpan={6} className="kosong">
                        Memuat riwayat transaksi...
                      </td>
                    </tr>
                  ) : riwayatList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="kosong">
                        Belum ada transaksi pada buku besar siswa ini.
                      </td>
                    </tr>
                  ) : (
                    riwayatList.map((t) => {
                      const isSetor = t.jenis === 'setoran' || (t.jenis === 'pembalik' && t.nilai > 0);
                      const isTarik = t.jenis === 'penarikan' || (t.jenis === 'pembalik' && t.nilai < 0);
                      return (
                        <tr key={t.id}>
                          <td style={{ paddingLeft: '22px', whiteSpace: 'nowrap' }}>
                            {formatTanggalIndonesia(t.tanggal, { day: 'numeric', month: 'short' })}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)' }}>
                            {t.nomor_bukti}
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: isSetor ? 'var(--ok-bg)' : isTarik ? 'var(--danger-bg)' : 'var(--bg)',
                                color: isSetor ? 'var(--ok-text)' : isTarik ? 'var(--danger-text)' : 'var(--muted)',
                              }}
                            >
                              {t.jenis === 'setoran' ? 'Setoran' : t.jenis === 'penarikan' ? 'Penarikan' : 'Koreksi'}
                            </span>
                          </td>
                          <td
                            className="angka"
                            style={{
                              fontWeight: 700,
                              color: isSetor ? 'var(--ok)' : isTarik ? 'var(--danger)' : 'var(--text)',
                            }}
                          >
                            {isSetor ? `+ ${formatRupiah(Math.abs(t.nilai))}` : `− ${formatRupiah(Math.abs(t.nilai))}`}
                          </td>
                          <td className="angka" style={{ fontWeight: 700 }}>
                            {formatRupiah(t.saldo_setelah)}
                          </td>
                          <td className="tengah">
                            {t.jenis !== 'pembalik' ? (
                              <button
                                onClick={() => setKoreksiTarget(t)}
                                title="Koreksi transaksi (buat transaksi pembalik)"
                                style={{
                                  padding: '5px 8px',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  color: 'var(--muted)',
                                }}
                              >
                                <IconUndo width={13} height={13} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              color: 'var(--muted)',
            }}
          >
            Pilih siswa di sebelah kiri untuk melihat buku besar
          </div>
        )}
      </section>

      {/* Modal Form Tambah/Ubah Siswa */}
      {isFormOpen && (
        <SiswaFormModal
          isOpen={isFormOpen}
          siswaToEdit={siswaToEdit}
          kelasList={kelasList}
          onClose={() => setIsFormOpen(false)}
          onSaved={() => {
            setIsFormOpen(false);
            fetchSiswa();
          }}
        />
      )}

      {/* Modal Koreksi Transaksi */}
      {koreksiTarget && (
        <KoreksiModal
          isOpen={Boolean(koreksiTarget)}
          transaksi={koreksiTarget}
          onClose={() => setKoreksiTarget(null)}
          onSuccess={() => {
            setKoreksiTarget(null);
            fetchSiswa();
            if (detailSiswa) handleOpenDetail(detailSiswa);
          }}
        />
      )}

      {/* Modal Pratinjau Cetak / PDF */}
      {pratinjauData && (
        <PratinjauCetakModal
          terbuka={Boolean(pratinjauData)}
          html={pratinjauData.html}
          judul={pratinjauData.judul}
          onTutup={() => setPratinjauData(null)}
          onSimpanPdf={pratinjauData.onSimpanPdf}
        />
      )}
    </div>
  );
}
