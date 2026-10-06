import { useState, useMemo } from 'react';
import type { HasilPratinjauImpor, OpsiImpor, PemetaanKolom } from '../../shared/types.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import { tombol, tombolUtama, kolom as gayaKolom, labelStyle, kartu, kartuKepala } from '../styles/ui.js';

const FIELD: Array<{ kunci: keyof PemetaanKolom; label: string; wajib?: boolean; bantuan: string }> = [
  { kunci: 'nama', label: 'Nama siswa', wajib: true, bantuan: 'Wajib' },
  { kunci: 'nis', label: 'NIS', bantuan: 'Opsional; dipakai agar siswa tidak digandakan' },
  { kunci: 'kelas', label: 'Kelas', bantuan: 'Opsional; kelas yang belum ada dibuat otomatis' },
  { kunci: 'alamat', label: 'Alamat', bantuan: 'Opsional' },
  { kunci: 'saldo', label: 'Saldo', bantuan: 'Opsional; dicatat sebagai saldo awal' },
];
const BATAS_TAMPIL = 300;

function Langkah({ nomor, judul, aktif, selesai }: { nomor: number; judul: string; aktif: boolean; selesai: boolean }) {
  return (
    <li
      aria-current={aktif ? 'step' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: aktif ? 700 : 500,
        color: aktif ? 'var(--accent)' : selesai ? 'var(--ok)' : 'var(--muted)',
      }}
    >
      <span
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          border: '1px solid currentColor',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
        }}
      >
        {selesai ? '✓' : nomor}
      </span>
      {judul}
    </li>
  );
}

export function ImporScreen() {
  const [berkas, setBerkas] = useState<{ token: string; nama_berkas: string } | null>(null);
  const [pemetaan, setPemetaan] = useState<PemetaanKolom | null>(null);
  const [hasil, setHasil] = useState<HasilPratinjauImpor | null>(null);
  const [tanggalSaldo, setTanggalSaldo] = useState(hariIniLokal());
  const [kontrolJumlah, setKontrolJumlah] = useState('');
  const [kontrolSaldo, setKontrolSaldo] = useState('');
  const [hanyaMasalah, setHanyaMasalah] = useState(false);

  const [memuat, setMemuat] = useState(false);
  const [menerapkan, setMenerapkan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState<string | null>(null);

  const muat = async (token: string, pemetaanBaru?: PemetaanKolom) => {
    setMemuat(true);
    setGalat(null);
    try {
      const res = await window.pundi.imporPratinjau(token, pemetaanBaru ? { pemetaan: pemetaanBaru } : undefined);
      if (res.ok) {
        setHasil(res.data);
        setPemetaan(res.data.pemetaan);
      } else {
        setHasil(null);
        setGalat(res.pesan);
      }
    } catch {
      setGalat('Gagal membaca berkas.');
    } finally {
      setMemuat(false);
    }
  };

  const pilihBerkas = async () => {
    setBerhasil(null);
    setGalat(null);
    const res = await window.pundi.dialogPilihFile({ ekstensi: ['xlsx', 'csv'] });
    if (!res.ok) {
      setGalat(res.pesan);
      return;
    }
    if (!res.data) return;
    setBerkas(res.data);
    setHasil(null);
    setKontrolJumlah('');
    setKontrolSaldo('');
    await muat(res.data.token);
  };

  const unduhContoh = async () => {
    setBerhasil(null);
    setGalat(null);
    const res = await window.pundi.imporContoh();
    if (!res.ok) setGalat(res.pesan);
    else if (res.data) setBerhasil(`Format contoh disimpan sebagai ${res.data.nama_berkas}.`);
  };

  const ubahKolom = (kunci: keyof PemetaanKolom, nilai: string) => {
    if (!berkas || !pemetaan) return;
    const baru = { ...pemetaan, [kunci]: Number(nilai) };
    setPemetaan(baru);
    muat(berkas.token, baru);
  };

  // Angka kontrol: kosong = tidak diperiksa; terisi harus cocok dengan isi berkas (CAP-14)
  const kontrol = useMemo(() => {
    const opsi: NonNullable<OpsiImpor['kontrol']> = {};
    let galatKontrol: string | null = null;
    if (kontrolJumlah.trim() !== '') {
      if (/^\d+$/.test(kontrolJumlah.trim())) opsi.jumlah_siswa = Number(kontrolJumlah.trim());
      else galatKontrol = 'Jumlah siswa kontrol harus berupa angka.';
    }
    if (kontrolSaldo.trim() !== '') {
      const p = parseRupiahKetat(kontrolSaldo);
      if (p.ok) opsi.total_saldo = p.nilai;
      else galatKontrol = `Total saldo kontrol: ${p.alasan}`;
    }
    return { opsi, galatKontrol };
  }, [kontrolJumlah, kontrolSaldo]);

  const cocokJumlah = kontrol.opsi.jumlah_siswa === undefined ? null : kontrol.opsi.jumlah_siswa === hasil?.valid_count;
  const cocokSaldo = kontrol.opsi.total_saldo === undefined ? null : kontrol.opsi.total_saldo === hasil?.total_saldo;

  const bisaTerapkan =
    !!hasil &&
    hasil.pemetaan.nama !== -1 &&
    hasil.valid_count > 0 &&
    hasil.invalid_count === 0 &&
    !kontrol.galatKontrol &&
    cocokJumlah !== false &&
    cocokSaldo !== false &&
    !memuat &&
    !menerapkan;

  const terapkan = async () => {
    if (!berkas || !hasil || !pemetaan) return;
    setMenerapkan(true);
    setGalat(null);
    try {
      const res = await window.pundi.imporTerapkan(berkas.token, {
        pemetaan,
        tanggal_saldo_awal: hasil.total_saldo > 0 ? tanggalSaldo : undefined,
        kontrol: Object.keys(kontrol.opsi).length > 0 ? kontrol.opsi : undefined,
      });
      if (res.ok) {
        const d = res.data;
        setBerhasil(
          `${d.jumlah_diimpor} siswa berhasil diimpor` +
            (d.jumlah_saldo_awal > 0
              ? `, ${d.jumlah_saldo_awal} di antaranya dengan saldo awal (total ${formatRupiah(d.total_saldo)}).`
              : '.')
        );
        setBerkas(null);
        setHasil(null);
        setPemetaan(null);
      } else {
        setGalat(`Belum tersimpan, tidak ada data yang berubah. ${res.pesan}`);
      }
    } catch {
      setGalat('Terjadi kesalahan saat menerapkan impor. Tidak ada data yang berubah.');
    } finally {
      setMenerapkan(false);
    }
  };

  const adaPemetaan = !!hasil && hasil.pemetaan.nama !== -1;
  const barisTampil = useMemo(() => {
    if (!hasil) return [];
    const urut = [...hasil.baris].sort((a, b) => Number(a.valid) - Number(b.valid) || a.nomor_baris - b.nomor_baris);
    return (hanyaMasalah ? urut.filter((b) => !b.valid) : urut).slice(0, BATAS_TAMPIL);
  }, [hasil, hanyaMasalah]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      <ol aria-label="Langkah impor" style={{ display: 'flex', gap: '24px', listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
        <Langkah nomor={1} judul="Pilih berkas" aktif={!berkas} selesai={!!berkas} />
        <Langkah nomor={2} judul="Petakan kolom" aktif={!!berkas && !adaPemetaan} selesai={adaPemetaan} />
        <Langkah nomor={3} judul="Pratinjau" aktif={adaPemetaan && !!hasil && hasil.invalid_count > 0} selesai={adaPemetaan && !!hasil && hasil.invalid_count === 0} />
        <Langkah nomor={4} judul="Cocokkan dan terapkan" aktif={!!hasil && bisaTerapkan} selesai={false} />
      </ol>

      {berhasil && (
        <div role="status" style={{ padding: '12px 16px', border: '1px solid var(--ok)', color: 'var(--ok)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600 }}>
          {berhasil}
        </div>
      )}
      {galat && (
        <div role="alert" style={{ padding: '12px 16px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
          {galat}
        </div>
      )}

      {/* 1. Pilih berkas */}
      <section style={{ ...kartu, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }} aria-label="Pilih berkas">
        <div style={{ fontSize: '13px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Impor siswa dan saldo dari Excel atau CSV</h3>
          <p style={{ color: 'var(--muted)' }}>
            Cocok untuk daftar siswa baru maupun pindahan dari aplikasi lama: ekspor datanya ke Excel/CSV, lalu pilih berkasnya di sini. Kolom
            dicocokkan otomatis dan dapat Anda ubah.
            {berkas && (
              <>
                {' '}
                Berkas terpilih: <strong>{berkas.nama_berkas}</strong>
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button type="button" style={{ ...tombol, padding: '10px 16px', fontSize: '13px' }} onClick={unduhContoh}>
            Unduh Format Contoh
          </button>
          <button type="button" style={{ ...tombolUtama, padding: '10px 18px' }} onClick={pilihBerkas}>
            {berkas ? 'Ganti Berkas' : 'Pilih Berkas Excel / CSV'}
          </button>
        </div>
      </section>

      {memuat && <div style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>Membaca berkas dan memeriksa baris...</div>}

      {hasil && pemetaan && (
        <>
          {/* 2. Petakan kolom */}
          <section style={kartu} aria-labelledby="im-judul-peta">
            <div style={kartuKepala}>
              <h3 id="im-judul-peta" style={{ fontSize: '14px', fontWeight: 600 }}>
                Petakan kolom <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(judul ada di baris {hasil.baris_header} berkas)</span>
              </h3>
            </div>
            <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              {FIELD.map((f) => (
                <div key={f.kunci}>
                  <label htmlFor={`im-kolom-${f.kunci}`} style={labelStyle}>
                    {f.label}
                    {f.wajib && <span style={{ color: 'var(--danger)' }}> *</span>}
                  </label>
                  <select id={`im-kolom-${f.kunci}`} style={gayaKolom} value={pemetaan[f.kunci]} onChange={(e) => ubahKolom(f.kunci, e.target.value)}>
                    <option value={-1}>{f.wajib ? '-- Pilih kolom --' : '(tidak dipakai)'}</option>
                    {hasil.kolom.map((judul, i) => (
                      <option key={i} value={i}>
                        {judul}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{f.bantuan}</div>
                </div>
              ))}
            </div>
            {hasil.contoh.length > 0 && (
              <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
                <table className="tabel" aria-label="Contoh isi berkas">
                  <thead>
                    <tr>
                      {hasil.kolom.map((judul, i) => (
                        <th key={i} style={{ padding: '6px 12px', fontWeight: 600 }}>{judul}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.contoh.map((baris, r) => (
                      <tr key={r}>
                        {baris.map((v, c) => (
                          <td key={c} style={{ padding: '6px 12px', color: 'var(--muted)' }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {!adaPemetaan ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Pilih kolom yang berisi nama siswa untuk melanjutkan.</p>
          ) : (
            <>
              {/* 3. Pratinjau */}
              <section style={kartu} aria-labelledby="im-judul-pratinjau">
                <div style={kartuKepala}>
                  <h3 id="im-judul-pratinjau" style={{ fontSize: '14px', fontWeight: 600 }}>
                    Pratinjau:{' '}
                    <span style={{ color: 'var(--ok)' }}>{hasil.valid_count} baris baik</span>
                    {hasil.invalid_count > 0 && (
                      <>
                        {', '}
                        <span style={{ color: 'var(--danger)' }}>{hasil.invalid_count} bermasalah</span>
                      </>
                    )}
                  </h3>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" checked={hanyaMasalah} onChange={(e) => setHanyaMasalah(e.target.checked)} />
                    Hanya yang bermasalah
                  </label>
                </div>

                {hasil.invalid_count > 0 && (
                  <div role="alert" style={{ padding: '10px 18px', fontSize: '13px', color: 'var(--danger)', borderBottom: '1px solid var(--border)' }}>
                    {hasil.invalid_count} baris belum bisa diimpor. Perbaiki di Excel lalu pilih berkas lagi; impor hanya berjalan bila semua baris baik.
                  </div>
                )}
                {hasil.peringatan.length > 0 && (
                  <ul style={{ padding: '10px 18px 10px 34px', fontSize: '13px', color: 'var(--warn-text)', borderBottom: '1px solid var(--border)' }}>
                    {hasil.peringatan.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table className="tabel">
                    <thead>
                      <tr>
                        <th>Baris</th>
                        <th>Nama</th>
                        <th>NIS</th>
                        <th>Kelas</th>
                        <th className="angka">Saldo</th>
                        <th>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barisTampil.map((b) => (
                        <tr key={b.nomor_baris}>
                          <td>{b.nomor_baris}</td>
                          <td style={{ fontWeight: 600 }}>{b.nama || '—'}</td>
                          <td>{b.nis ?? '—'}</td>
                          <td>{b.kelas ?? '—'}</td>
                          <td className="angka">{b.saldo ? formatRupiah(b.saldo) : '—'}</td>
                          <td style={{ color: b.valid ? 'var(--muted)' : 'var(--danger)' }}>
                            {b.valid ? (b.catatan ?? 'Baik') : b.alasan_galat}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasil.baris.length > barisTampil.length && !hanyaMasalah && (
                  <div style={{ padding: '10px 18px', fontSize: '12px', color: 'var(--muted)' }}>
                    Menampilkan {barisTampil.length} dari {hasil.baris.length} baris (yang bermasalah di urutan teratas).
                  </div>
                )}
              </section>

              {/* 4. Cocokkan dan terapkan */}
              <section style={{ ...kartu, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }} aria-labelledby="im-judul-cocok">
                <h3 id="im-judul-cocok" style={{ fontSize: '14px', fontWeight: 600 }}>
                  Cocokkan dengan aplikasi lama
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Isi angka dari aplikasi lama (opsional, tetapi dianjurkan untuk migrasi). Bila terisi dan tidak sama dengan isi berkas, impor tidak
                  dijalankan.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div>
                    <div style={labelStyle}>Jumlah siswa di berkas</div>
                    <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700 }}>{hasil.valid_count}</div>
                    <label htmlFor="im-kontrol-jumlah" style={{ ...labelStyle, marginTop: '10px' }}>Jumlah siswa di aplikasi lama</label>
                    <input id="im-kontrol-jumlah" inputMode="numeric" style={gayaKolom} value={kontrolJumlah} onChange={(e) => setKontrolJumlah(e.target.value)} placeholder="Contoh: 250" />
                    {cocokJumlah !== null && (
                      <div role="status" style={{ marginTop: '6px', fontSize: '13px', fontWeight: 600, color: cocokJumlah ? 'var(--ok)' : 'var(--danger)' }}>
                        {cocokJumlah ? 'Jumlah siswa cocok' : `Berbeda ${Math.abs((kontrol.opsi.jumlah_siswa ?? 0) - hasil.valid_count)} siswa`}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={labelStyle}>Total saldo di berkas</div>
                    <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700 }}>{formatRupiah(hasil.total_saldo)}</div>
                    <label htmlFor="im-kontrol-saldo" style={{ ...labelStyle, marginTop: '10px' }}>Total saldo di aplikasi lama</label>
                    <input id="im-kontrol-saldo" inputMode="numeric" style={gayaKolom} value={kontrolSaldo} onChange={(e) => setKontrolSaldo(e.target.value)} placeholder="Contoh: Rp 12.500.000" />
                    {cocokSaldo !== null && (
                      <div role="status" style={{ marginTop: '6px', fontSize: '13px', fontWeight: 600, color: cocokSaldo ? 'var(--ok)' : 'var(--danger)' }}>
                        {cocokSaldo ? 'Total saldo cocok' : `Berbeda ${formatRupiah(Math.abs((kontrol.opsi.total_saldo ?? 0) - hasil.total_saldo))}`}
                      </div>
                    )}
                  </div>

                  {hasil.total_saldo > 0 && (
                    <div>
                      <label htmlFor="im-tanggal-saldo" style={labelStyle}>Tanggal saldo awal</label>
                      <input id="im-tanggal-saldo" type="date" style={gayaKolom} value={tanggalSaldo} onChange={(e) => setTanggalSaldo(e.target.value)} />
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                        Saldo dicatat sebagai transaksi “Saldo awal” pada tanggal ini.
                      </div>
                    </div>
                  )}
                </div>

                {kontrol.galatKontrol && (
                  <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)' }}>{kontrol.galatKontrol}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    style={{ ...tombol, padding: '10px 16px', fontSize: '13px' }}
                    onClick={() => {
                      setBerkas(null);
                      setHasil(null);
                      setPemetaan(null);
                    }}
                  >
                    Batal
                  </button>
                  <button type="button" style={{ ...tombolUtama, padding: '10px 20px', opacity: bisaTerapkan ? 1 : 0.5 }} disabled={!bisaTerapkan} onClick={terapkan}>
                    {menerapkan ? 'Menyimpan...' : `Terapkan Impor (${hasil.valid_count} siswa)`}
                  </button>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
