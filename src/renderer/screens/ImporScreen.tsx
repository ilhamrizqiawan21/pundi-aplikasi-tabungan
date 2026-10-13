import { useState, useMemo } from 'react';
import type { HasilPratinjauImpor, OpsiImpor, PemetaanKolom } from '../../shared/types.js';
import { formatRupiah, parseRupiahKetat } from '../../shared/rupiah.js';
import { hariIniLokal } from '../../shared/tanggal.js';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
} from '../components/ui/index.js';
import './ImporScreen.css';

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
      className={aktif ? 'imp-langkah imp-langkah-aktif' : selesai ? 'imp-langkah imp-langkah-selesai' : 'imp-langkah'}
    >
      <span className="imp-langkah-nomor">{selesai ? '✓' : nomor}</span>
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
    <div className="imp-halaman">
      <ol aria-label="Langkah impor" className="imp-langkah-daftar">
        <Langkah nomor={1} judul="Pilih berkas" aktif={!berkas} selesai={!!berkas} />
        <Langkah nomor={2} judul="Petakan kolom" aktif={!!berkas && !adaPemetaan} selesai={adaPemetaan} />
        <Langkah nomor={3} judul="Pratinjau" aktif={adaPemetaan && !!hasil && hasil.invalid_count > 0} selesai={adaPemetaan && !!hasil && hasil.invalid_count === 0} />
        <Langkah nomor={4} judul="Cocokkan dan terapkan" aktif={!!hasil && bisaTerapkan} selesai={false} />
      </ol>

      {berhasil && (
        <div role="status" className="imp-berhasil">
          {berhasil}
        </div>
      )}
      {galat && (
        <div role="alert" className="imp-galat">
          {galat}
        </div>
      )}

      {/* 1. Pilih berkas */}
      <Card className="imp-pilih" aria-label="Pilih berkas">
        <div className="imp-pilih-teks">
          <h3 className="imp-pilih-judul">
            Impor siswa dan saldo dari Excel atau CSV
          </h3>
          <p className="imp-muted">
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
        <div className="imp-pilih-aksi">
          <Button variant="secondary" size="md" onClick={unduhContoh}>
            Unduh Format Contoh
          </Button>
          <Button variant="primary" size="md" onClick={pilihBerkas}>
            {berkas ? 'Ganti Berkas' : 'Pilih Berkas Excel / CSV'}
          </Button>
        </div>
      </Card>

      {memuat && <div className="imp-memuat">Membaca berkas dan memeriksa baris...</div>}

      {hasil && pemetaan && (
        <>
          {/* 2. Petakan kolom */}
          <Card aria-labelledby="im-judul-peta">
            <CardHeader>
              <CardTitle id="im-judul-peta">
                Petakan kolom <span className="imp-judul-ket">(judul ada di baris {hasil.baris_header} berkas)</span>
              </CardTitle>
            </CardHeader>
            <div className="imp-peta">
              {FIELD.map((f) => (
                <div key={f.kunci}>
                  <label htmlFor={`im-kolom-${f.kunci}`} className="imp-label">
                    {f.label}
                    {f.wajib && <span className="imp-danger"> *</span>}
                  </label>
                  <Select
                    id={`im-kolom-${f.kunci}`}
                    value={pemetaan[f.kunci]}
                    onChange={(e) => ubahKolom(f.kunci, e.target.value)}
                  >
                    <option value={-1}>{f.wajib ? '-- Pilih kolom --' : '(tidak dipakai)'}</option>
                    {hasil.kolom.map((judul, i) => (
                      <option key={i} value={i}>
                        {judul}
                      </option>
                    ))}
                  </Select>
                  <div className="imp-bantuan">{f.bantuan}</div>
                </div>
              ))}
            </div>
            {hasil.contoh.length > 0 && (
              <div className="imp-contoh">
                <table className="tabel" aria-label="Contoh isi berkas">
                  <thead>
                    <tr>
                      {hasil.kolom.map((judul, i) => (
                        <th key={i}>{judul}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.contoh.map((baris, r) => (
                      <tr key={r}>
                        {baris.map((v, c) => (
                          <td key={c}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {!adaPemetaan ? (
            <p className="imp-petunjuk">Pilih kolom yang berisi nama siswa untuk melanjutkan.</p>
          ) : (
            <>
              {/* 3. Pratinjau */}
              <section className="ui-card" aria-labelledby="im-judul-pratinjau">
                <CardHeader>
                  <CardTitle id="im-judul-pratinjau">
                    Pratinjau:{' '}
                    <span className="imp-ok">{hasil.valid_count} baris baik</span>
                    {hasil.invalid_count > 0 && (
                      <>
                        {', '}
                        <span className="imp-danger">{hasil.invalid_count} bermasalah</span>
                      </>
                    )}
                  </CardTitle>
                  <label className="imp-centang">
                    <input type="checkbox" checked={hanyaMasalah} onChange={(e) => setHanyaMasalah(e.target.checked)} />
                    Hanya yang bermasalah
                  </label>
                </CardHeader>

                {hasil.invalid_count > 0 && (
                  <div role="alert" className="imp-peringatan-galat">
                    {hasil.invalid_count} baris belum bisa diimpor. Perbaiki di Excel lalu pilih berkas lagi; impor hanya berjalan bila semua baris baik.
                  </div>
                )}
                {hasil.peringatan.length > 0 && (
                  <ul className="imp-peringatan">
                    {hasil.peringatan.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}

                <div className="imp-gulir">
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
                          <td className="imp-tebal">{b.nama || '—'}</td>
                          <td>{b.nis ?? '—'}</td>
                          <td>{b.kelas ?? '—'}</td>
                          <td className="angka">{b.saldo ? formatRupiah(b.saldo) : '—'}</td>
                          <td className={b.valid ? 'imp-muted' : 'imp-danger'}>
                            {b.valid ? (b.catatan ?? 'Baik') : b.alasan_galat}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasil.baris.length > barisTampil.length && !hanyaMasalah && (
                  <div className="imp-catatan">
                    Menampilkan {barisTampil.length} dari {hasil.baris.length} baris (yang bermasalah di urutan teratas).
                  </div>
                )}
              </section>

              {/* 4. Cocokkan dan terapkan */}
              <Card className="imp-cocok" aria-labelledby="im-judul-cocok">
                <CardTitle id="im-judul-cocok">
                  Cocokkan dengan aplikasi lama
                </CardTitle>
                <p className="imp-petunjuk">
                  Isi angka dari aplikasi lama (opsional, tetapi dianjurkan untuk migrasi). Bila terisi dan tidak sama dengan isi berkas, impor tidak
                  dijalankan.
                </p>

                <div className="imp-cocok-grid">
                  <div>
                    <div className="imp-kecil-judul">Jumlah siswa di berkas</div>
                    <div className="tabular-nums imp-angka-besar">{hasil.valid_count}</div>
                    <label htmlFor="im-kontrol-jumlah" className="imp-label imp-label-atas">
                      Jumlah siswa di aplikasi lama
                    </label>
                    <Input
                      id="im-kontrol-jumlah"
                      inputMode="numeric"
                      value={kontrolJumlah}
                      onChange={(e) => setKontrolJumlah(e.target.value)}
                      placeholder="Contoh: 250"
                    />
                    {cocokJumlah !== null && (
                      <div role="status" className={cocokJumlah ? 'imp-status imp-ok' : 'imp-status imp-danger'}>
                        {cocokJumlah ? 'Jumlah siswa cocok' : `Berbeda ${Math.abs((kontrol.opsi.jumlah_siswa ?? 0) - hasil.valid_count)} siswa`}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="imp-kecil-judul">Total saldo di berkas</div>
                    <div className="tabular-nums imp-angka-besar">{formatRupiah(hasil.total_saldo)}</div>
                    <label htmlFor="im-kontrol-saldo" className="imp-label imp-label-atas">
                      Total saldo di aplikasi lama
                    </label>
                    <Input
                      id="im-kontrol-saldo"
                      inputMode="numeric"
                      value={kontrolSaldo}
                      onChange={(e) => setKontrolSaldo(e.target.value)}
                      placeholder="Contoh: Rp 12.500.000"
                    />
                    {cocokSaldo !== null && (
                      <div role="status" className={cocokSaldo ? 'imp-status imp-ok' : 'imp-status imp-danger'}>
                        {cocokSaldo ? 'Total saldo cocok' : `Berbeda ${formatRupiah(Math.abs((kontrol.opsi.total_saldo ?? 0) - hasil.total_saldo))}`}
                      </div>
                    )}
                  </div>

                  {hasil.total_saldo > 0 && (
                    <div>
                      <label htmlFor="im-tanggal-saldo" className="imp-label">
                        Tanggal saldo awal
                      </label>
                      <Input
                        id="im-tanggal-saldo"
                        type="date"
                        value={tanggalSaldo}
                        onChange={(e) => setTanggalSaldo(e.target.value)}
                      />
                      <div className="imp-bantuan">
                        Saldo dicatat sebagai transaksi “Saldo awal” pada tanggal ini.
                      </div>
                    </div>
                  )}
                </div>

                {kontrol.galatKontrol && (
                  <div role="alert" className="imp-galat-kontrol">{kontrol.galatKontrol}</div>
                )}

                <div className="imp-tombolan">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setBerkas(null);
                      setHasil(null);
                      setPemetaan(null);
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!bisaTerapkan}
                    onClick={terapkan}
                  >
                    {menerapkan ? 'Menyimpan...' : `Terapkan Impor (${hasil.valid_count} siswa)`}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
