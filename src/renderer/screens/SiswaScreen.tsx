import { useState, useEffect, useCallback, useRef } from 'react';
import type { Siswa, Kelas, StatusSiswa, Transaksi } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { formatTanggalIndonesia } from '../../shared/tanggal.js';
import { SiswaFormModal } from '../components/SiswaFormModal.js';
import { KoreksiModal } from '../components/KoreksiModal.js';
import { PratinjauCetakModal } from '../components/PratinjauCetakModal.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
  Skeleton,
  EmptyState,
  useToast,
} from '../components/ui/index.js';
import {
  StudentAvatar,
  IconSearch,
  IconPrint,
  IconPdf,
  IconUndo,
} from '../components/Icons.js';
import './SiswaScreen.css';

export function SiswaScreen() {
  const { showToast } = useToast();
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

  // Filter Tanggal Buku Besar Siswa (CAP-10)
  const [filterDari, setFilterDari] = useState('');
  const [filterSampai, setFilterSampai] = useState('');

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
        dari: filterDari || undefined,
        sampai: filterSampai || undefined,
      });
      if (res.ok) {
        setPratinjauData({
          html: res.data.html,
          judul: `Buku Besar - ${siswa.nama}`,
          onSimpanPdf: async () => {
            await window.pundi.cetakLaporanPdf({
              jenis: 'bukuBesar',
              siswaId: siswa.id,
              dari: filterDari || undefined,
              sampai: filterSampai || undefined,
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

  const muatRiwayat = useCallback(async (siswaId: number, dari?: string, sampai?: string) => {
    setLoadingRiwayat(true);
    try {
      const res = await window.pundi.transaksiRiwayat({
        siswa_id: siswaId,
        limit: 100,
        dari_tanggal: dari || undefined,
        sampai_tanggal: sampai || undefined,
      });
      if (res.ok) {
        setRiwayatList(res.data);
      }
    } finally {
      setLoadingRiwayat(false);
    }
  }, []);

  const handleOpenDetail = useCallback(async (siswa: Siswa) => {
    setDetailSiswa(siswa);
    await muatRiwayat(siswa.id, filterDari, filterSampai);
  }, [muatRiwayat, filterDari, filterSampai]);

  // Muat ulang transaksi buku besar bila filter rentang tanggal disesuaikan
  useEffect(() => {
    if (detailSiswa) {
      void muatRiwayat(detailSiswa.id, filterDari, filterSampai);
    }
  }, [detailSiswa, filterDari, filterSampai, muatRiwayat]);

  // Perbarui saldo detail terpilih setelah daftar siswa dimuat ulang.
  useEffect(() => {
    if (detailSiswa) {
      const updated = siswaList.find((s) => s.id === detailSiswa.id);
      if (updated && updated.saldo !== detailSiswa.saldo) {
        setDetailSiswa(updated);
      }
    }
  }, [siswaList, detailSiswa]);

  const handleDelete = async (siswa: Siswa) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa "${siswa.nama}" (${siswa.nomor})?`)) {
      const res = await window.pundi.siswaHapus(siswa.id);
      if (res.ok) {
        showToast(`Data siswa "${siswa.nama}" berhasil dihapus.`, 'ok');
        fetchSiswa();
        if (detailSiswa?.id === siswa.id) {
          setDetailSiswa(null);
        }
      } else {
        showToast(`Gagal menghapus siswa: ${res.pesan}`, 'danger');
      }
    }
  };

  const tingkatTersedia = [...new Set(kelasList.map((kelas) => kelas.tingkat))].sort((a, b) => a - b);

  // Tingkat mengikuti kelas pada tahun ajaran aktif, bukan daftar tingkat tetap.
  const filteredSiswa = siswaList.filter((s) => {
    if (selectedTingkat === 'semua') return true;
    if (selectedTingkat === 'aktif') return s.status === 'aktif';
    const tingkatDipilih = Number(selectedTingkat);
    const kelasSiswa = kelasList.find((kelas) => kelas.id === s.kelas_id);
    return kelasSiswa?.tingkat === tingkatDipilih;
  });

  return (
    <div className="grid-siswa">
      {/* ======================================================== */}
      {/* PANEL KIRI: DAFTAR SISWA                                 */}
      {/* ======================================================== */}
      <section className="ui-card siswa-daftar">
        {/* Header Daftar Siswa & Tombol Tambah */}
        <div className="siswa-daftar-header">
          <div className="siswa-judul-wrap">
            <h3 className="siswa-judul">
              Daftar siswa
            </h3>
            <Badge variant="neutral">
              {filteredSiswa.length} siswa
            </Badge>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSiswaToEdit(null);
              setIsFormOpen(true);
            }}
          >
            <span>+</span> Tambah Siswa
          </Button>
        </div>

        {/* Input Pencarian */}
        <div className="siswa-cari-wrapper">
          <div className="siswa-cari-icon">
            <IconSearch width={15} height={15} />
          </div>
          <input
            type="text"
            className="siswa-cari-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau nomor"
          />
        </div>

        {/* Filter Bar: Kelas & Status Dropdowns */}
        <div className="siswa-filter-bar">
          <select
            value={filterKelasId}
            onChange={(e) => setFilterKelasId(e.target.value === '' ? '' : Number(e.target.value))}
            className="siswa-filter-select"
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
            className="siswa-filter-select"
          >
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="lulus">Lulus</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>

        {/* Filter cepat mengikuti tingkat yang tersedia pada tahun ajaran aktif */}
        <div className="siswa-pills-bar">
          {[
            { id: 'semua', label: 'Semua kelas' },
            ...tingkatTersedia.map((tingkat) => ({ id: String(tingkat), label: `Tingkat ${tingkat}` })),
            { id: 'aktif', label: 'Aktif' },
          ].map((pill) => {
            const isActive = selectedTingkat === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedTingkat(pill.id)}
                className={`siswa-pill-btn ${isActive ? 'active' : ''}`}
                aria-pressed={isActive}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Tabel daftar siswa */}
        <div className="siswa-table-wrapper">
          <table className="tabel">
            <tbody>
              {loading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td className="siswa-sel">
                        <div className="siswa-baris">
                          <div className="siswa-baris-kiri">
                            <Skeleton width={34} height={34} variant="circular" />
                            <div className="siswa-kolom-kecil">
                              <Skeleton width="120px" height="14px" />
                              <Skeleton width="80px" height="12px" />
                            </div>
                          </div>
                          <Skeleton width="70px" height="16px" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : filteredSiswa.length === 0 ? (
                <tr>
                  <td className="siswa-kosong-sel">
                    <EmptyState
                      title="Belum ada siswa yang cocok."
                      description="Coba gunakan kata kunci pencarian lain atau ubah filter kelas."
                    />
                  </td>
                </tr>
              ) : (
                filteredSiswa.map((s) => {
                  const isSelected = detailSiswa?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      role="row"
                      onClick={() => {
                        void handleOpenDetail(s);
                        // Tata letak satu kolom: buku besar ada di bawah daftar, jadi bawa pengguna ke sana
                        if (window.matchMedia('(max-width: 1279px)').matches) {
                          requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
                        }
                      }}
                      className={isSelected ? 'siswa-baris-klik baris-dipilih' : 'siswa-baris-klik'}
                    >
                      <td className="siswa-sel">
                        <div className="siswa-baris">
                          <div className="siswa-baris-kiri siswa-baris-kiri-lebar">
                            <StudentAvatar name={s.nama} size={34} fontSize={12} />
                            <div className="siswa-min0">
                              <div className="siswa-nama">
                                {s.nama}
                              </div>
                              <div className="siswa-nomor">
                                {s.nomor} {s.kelas_nama ? `· ${s.kelas_nama}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="siswa-saldo-kolom">
                            <div className="siswa-saldo tabular-nums">
                              {formatRupiah(s.saldo ?? 0)}
                            </div>
                            {s.kelas_nama && (
                              <span className="siswa-kelas-kecil">
                                {s.kelas_nama}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================== */}
      {/* PANEL KANAN: BUKU BESAR SISWA TERPILIH                   */}
      {/* ======================================================== */}
      <section ref={detailRef} className="siswa-detail-panel">
        {detailSiswa ? (
          <>
            {/* Kartu siswa terpilih */}
            <div className="siswa-hero">
              <div className="siswa-hero-kiri">
                <StudentAvatar name={detailSiswa.nama} size={54} fontSize={18} border="2px solid color-mix(in srgb, var(--on-color) 30%, transparent)" />
                <div>
                  <h2 className="siswa-hero-nama">
                    {detailSiswa.nama}
                  </h2>
                  <div className="siswa-hero-actions">
                    {detailSiswa.kelas_nama && (
                      <Badge variant="neutral" className="siswa-hero-badge">
                        Kelas {detailSiswa.kelas_nama}
                      </Badge>
                    )}
                    <Badge variant="neutral" className="siswa-hero-badge">
                      {detailSiswa.nomor} · {detailSiswa.status === 'aktif' ? 'Aktif' : detailSiswa.status}
                    </Badge>
                    <button
                      onClick={() => {
                        setSiswaToEdit(detailSiswa);
                        setIsFormOpen(true);
                      }}
                      className="siswa-hero-btn"
                    >
                      Ubah
                    </button>
                    <button
                      onClick={() => handleDelete(detailSiswa)}
                      className="siswa-hero-btn danger"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>

              <div className="siswa-hero-saldo">
                <div className="siswa-hero-saldo-label">
                  SALDO
                </div>
                <div className="siswa-hero-saldo-nilai tabular-nums">
                  {formatRupiah(detailSiswa.saldo ?? 0)}
                </div>
              </div>
            </div>

            {/* Card Buku Besar */}
            <Card>
              {/* Header Buku Besar & Aksi Cetak / PDF */}
              <CardHeader>
                <div>
                  <CardTitle>Buku besar</CardTitle>
                  <CardDescription>
                    Transaksi tidak dapat diubah. Koreksi dibuat sebagai transaksi pembalik.
                  </CardDescription>
                </div>

                <div className="siswa-aksi-cetak">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCetakBukuBesar(detailSiswa)}
                    disabled={cetakLoading}
                  >
                    <IconPrint width={14} height={14} />
                    <span>Cetak</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCetakBukuBesar(detailSiswa)}
                    disabled={cetakLoading}
                  >
                    <IconPdf width={14} height={14} />
                    <span>PDF</span>
                  </Button>
                </div>
              </CardHeader>

              {/* Filter Rentang Tanggal Buku Besar (CAP-10) */}
              <div className="siswa-filter-tgl">
                <div className="siswa-tgl-grup">
                  <label htmlFor="buku-dari" className="siswa-tgl-label">
                    Dari:
                  </label>
                  <Input
                    id="buku-dari"
                    type="date"
                    value={filterDari}
                    onChange={(e) => setFilterDari(e.target.value)}
                    className="siswa-tgl-input"
                  />
                </div>

                <div className="siswa-tgl-grup">
                  <label htmlFor="buku-sampai" className="siswa-tgl-label">
                    Sampai:
                  </label>
                  <Input
                    id="buku-sampai"
                    type="date"
                    value={filterSampai}
                    onChange={(e) => setFilterSampai(e.target.value)}
                    className="siswa-tgl-input"
                  />
                </div>

                {(filterDari || filterSampai) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterDari('');
                      setFilterSampai('');
                    }}
                    className="siswa-reset-filter"
                  >
                    Reset Filter
                  </Button>
                )}
              </div>

              {/* Tabel Buku Besar */}
              <div className="ui-table-container siswa-buku-tabel">
                <table className="tabel tabel-kartu">
                  <thead>
                    <tr>
                      <th className="siswa-kol-tgl">Tanggal</th>
                      <th>No. Bukti</th>
                      <th>Jenis</th>
                      <th className="angka">Nominal</th>
                      <th className="angka">Saldo</th>
                      <th className="tengah">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingRiwayat ? (
                      <>
                        {[1, 2, 3].map((idx) => (
                          <tr key={idx}>
                            <td data-label="Tanggal" className="siswa-kol-tgl"><Skeleton width="90px" height="16px" /></td>
                            <td data-label="No. Bukti"><Skeleton width="110px" height="16px" /></td>
                            <td data-label="Jenis"><Skeleton width="60px" height="18px" /></td>
                            <td data-label="Nominal" className="angka"><Skeleton width="80px" height="16px" /></td>
                            <td data-label="Saldo" className="angka"><Skeleton width="80px" height="16px" /></td>
                            <td data-label="Aksi" className="tengah"><Skeleton width="30px" height="24px" variant="rectangular" /></td>
                          </tr>
                        ))}
                      </>
                    ) : riwayatList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="kosong siswa-buku-kosong">
                          <EmptyState
                            title="Belum ada transaksi pada buku besar siswa ini."
                            description="Transaksi setoran atau penarikan yang dicatat akan muncul di sini."
                          />
                        </td>
                      </tr>
                    ) : (
                      riwayatList.map((t) => {
                        const isSetor = t.jenis === 'setoran' || (t.jenis === 'pembalik' && t.nilai > 0);
                        const isTarik = t.jenis === 'penarikan' || (t.jenis === 'pembalik' && t.nilai < 0);
                        return (
                          <tr key={t.id}>
                            <td data-label="Tanggal" className="siswa-kol-tgl siswa-nowrap">
                              {formatTanggalIndonesia(t.tanggal, { day: 'numeric', month: 'short' })}
                            </td>
                            <td data-label="No. Bukti" className="siswa-no-bukti">
                              {t.nomor_bukti}
                            </td>
                            <td data-label="Jenis">
                              <Badge variant={isSetor ? 'ok' : isTarik ? 'danger' : 'neutral'}>
                                {t.jenis === 'setoran' ? 'Setoran' : t.jenis === 'penarikan' ? 'Penarikan' : 'Koreksi'}
                              </Badge>
                            </td>
                            <td
                              data-label="Nominal"
                              className={`angka siswa-nominal ${isSetor ? 'siswa-nominal-setor' : isTarik ? 'siswa-nominal-tarik' : ''}`}
                            >
                              {isSetor ? `+ ${formatRupiah(Math.abs(t.nilai))}` : `− ${formatRupiah(Math.abs(t.nilai))}`}
                            </td>
                            <td data-label="Saldo" className="angka siswa-tebal">
                              {formatRupiah(t.saldo_setelah)}
                            </td>
                            <td data-label="Aksi" className="tengah">
                              {t.jenis !== 'pembalik' ? (
                                <button
                                  onClick={() => setKoreksiTarget(t)}
                                  title="Koreksi transaksi (buat transaksi pembalik)"
                                  className="siswa-btn-koreksi"
                                >
                                  <IconUndo width={13} height={13} />
                                </button>
                              ) : (
                                <span className="siswa-strip">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          <div className="siswa-pilih-hint">
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
