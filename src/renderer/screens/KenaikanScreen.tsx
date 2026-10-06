import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { TahunAjaran, Kelas, ItemKenaikan, PerubahanKenaikan } from '../../shared/types.js';
import { formatRupiah } from '../../shared/rupiah.js';
import { Modal } from '../components/Modal.js';
import { IconKenaikan, IconSiswa, IconCheck, IconAkademik } from '../components/Icons.js';
import { tombol, tombolUtama, kolom, labelStyle, kartu, kartuKepala } from '../styles/ui.js';

type Tindakan = 'pindah' | 'lulus' | 'keluar';

interface KenaikanScreenProps {
  /** Dipanggil setelah perubahan diterapkan (mis. agar daftar lain dimuat ulang). */
  onApplied?: () => void;
}

const LANGKAH = [
  { judul: 'Pilih asal dan tujuan', ket: 'Tahun ajaran dan kelas' },
  { judul: 'Atur tiap siswa', ket: 'Naik kelas, lulus, atau keluar' },
  { judul: 'Tinjau dan terapkan', ket: 'Periksa ringkasan sebelum disimpan' },
];

function Langkah({ aktif }: { aktif: number }) {
  return (
    <ol
      aria-label="Tahapan kenaikan kelas"
      style={{ ...kartu, listStyle: 'none', margin: 0, padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}
    >
      {LANGKAH.map((l, i) => {
        const selesai = i < aktif;
        const sekarang = i === aktif;
        return (
          <li key={l.judul} aria-current={sekarang ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: selesai || sekarang ? 1 : 0.55 }}>
            <span
              aria-hidden="true"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: selesai || sekarang ? 'var(--accent)' : 'transparent',
                color: selesai || sekarang ? 'var(--accent-text)' : 'var(--muted)',
                border: selesai || sekarang ? 'none' : '1.5px solid var(--border)',
              }}
            >
              {selesai ? <IconCheck width={15} height={15} /> : i + 1}
            </span>
            <span>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{l.judul}</span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>{l.ket}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function KeadaanKosong({ ikon, judul, children }: { ikon: ReactNode; judul: string; children?: ReactNode }) {
  return (
    <div style={{ padding: '44px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
      <div
        aria-hidden="true"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        }}
      >
        {ikon}
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{judul}</h3>
      <div style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '460px', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export function KenaikanScreen({ onApplied }: KenaikanScreenProps) {
  const [tahunList, setTahunList] = useState<TahunAjaran[]>([]);
  const [tahunAsalId, setTahunAsalId] = useState<number | ''>('');
  const [tahunTujuanId, setTahunTujuanId] = useState<number | ''>('');
  const [kelasAsalList, setKelasAsalList] = useState<Kelas[]>([]);
  const [kelasTujuanList, setKelasTujuanList] = useState<Kelas[]>([]);
  const [kelasAsalId, setKelasAsalId] = useState<number | ''>('');
  const [kelasDefaultId, setKelasDefaultId] = useState<number | ''>('');

  const [items, setItems] = useState<ItemKenaikan[]>([]);
  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  const [tindakan, setTindakan] = useState<Record<number, Tindakan>>({});
  const [kelasPerSiswa, setKelasPerSiswa] = useState<Record<number, number>>({});

  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [tinjau, setTinjau] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    window.pundi.tahunAjaranDaftar().then((res) => {
      if (!res.ok) return;
      setTahunList(res.data);
      const aktif = res.data.find((t) => t.aktif === 1);
      // Biasanya: tahun lama sebagai asal, tahun aktif (baru) sebagai tujuan
      const lebihLama = res.data
        .filter((t) => aktif && t.mulai < aktif.mulai)
        .sort((a, b) => b.mulai.localeCompare(a.mulai))[0];
      if (aktif && lebihLama) {
        setTahunAsalId(lebihLama.id);
        setTahunTujuanId(aktif.id);
      } else if (res.data.length >= 2) {
        const urut = [...res.data].sort((a, b) => a.mulai.localeCompare(b.mulai));
        setTahunAsalId(urut[0].id);
        setTahunTujuanId(urut[urut.length - 1].id);
      }
    });
  }, []);

  const asal = tahunList.find((t) => t.id === tahunAsalId);
  const tujuanTersedia = useMemo(
    () => (asal ? tahunList.filter((t) => t.mulai > asal.mulai) : []),
    [tahunList, asal]
  );

  // Tujuan harus tetap sah bila tahun asal diganti
  useEffect(() => {
    if (tahunTujuanId !== '' && !tujuanTersedia.some((t) => t.id === tahunTujuanId)) {
      setTahunTujuanId(tujuanTersedia[0]?.id ?? '');
    }
  }, [tujuanTersedia, tahunTujuanId]);

  useEffect(() => {
    setKelasAsalId('');
    if (tahunAsalId === '') {
      setKelasAsalList([]);
      return;
    }
    window.pundi.kelasDaftar(tahunAsalId).then((res) => res.ok && setKelasAsalList(res.data));
  }, [tahunAsalId]);

  useEffect(() => {
    setKelasDefaultId('');
    if (tahunTujuanId === '') {
      setKelasTujuanList([]);
      return;
    }
    window.pundi.kelasDaftar(tahunTujuanId).then((res) => res.ok && setKelasTujuanList(res.data));
  }, [tahunTujuanId]);

  const muatSiswa = useCallback(async () => {
    setItems([]);
    setDipilih(new Set());
    setTindakan({});
    setKelasPerSiswa({});
    if (kelasAsalId === '' || tahunTujuanId === '') return;
    const res = await window.pundi.kenaikanDaftar(kelasAsalId, tahunTujuanId);
    if (res.ok) {
      setItems(res.data);
      // Yang sudah dipindahkan atau sudah lulus/keluar tidak dipilih lagi
      setDipilih(new Set(res.data.filter((s) => s.status === 'aktif' && !s.kelas_tujuan_nama).map((s) => s.siswa_id)));
    } else {
      setGalat(res.pesan);
    }
  }, [kelasAsalId, tahunTujuanId]);

  useEffect(() => {
    muatSiswa();
  }, [muatSiswa]);

  // Saran kelas tujuan: tingkat berikutnya dari kelas asal
  useEffect(() => {
    const k = kelasAsalList.find((x) => x.id === kelasAsalId);
    if (!k) return;
    const saran = kelasTujuanList.find((x) => x.tingkat === k.tingkat + 1);
    setKelasDefaultId(saran?.id ?? '');
  }, [kelasAsalId, kelasAsalList, kelasTujuanList]);

  const tindakanDari = (id: number): Tindakan => tindakan[id] ?? 'pindah';
  const kelasDari = (id: number): number | '' => kelasPerSiswa[id] ?? kelasDefaultId;

  const perubahan = useMemo((): PerubahanKenaikan[] | string => {
    const hasil: PerubahanKenaikan[] = [];
    for (const s of items) {
      if (!dipilih.has(s.siswa_id)) continue;
      const t = tindakanDari(s.siswa_id);
      if (t === 'pindah') {
        const k = kelasDari(s.siswa_id);
        if (k === '') return `Pilih kelas tujuan untuk ${s.nama}.`;
        hasil.push({ siswa_id: s.siswa_id, tindakan: 'pindah', kelas_tujuan_id: k });
      } else {
        hasil.push({ siswa_id: s.siswa_id, tindakan: t });
      }
    }
    if (hasil.length === 0) return 'Pilih minimal satu siswa.';
    return hasil;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, dipilih, tindakan, kelasPerSiswa, kelasDefaultId]);

  const bukaTinjau = () => {
    setPesan(null);
    if (typeof perubahan === 'string') {
      setGalat(perubahan);
      return;
    }
    setGalat(null);
    setTinjau(true);
  };

  const terapkan = async () => {
    if (typeof perubahan === 'string' || kelasAsalId === '' || tahunTujuanId === '') return;
    setSibuk(true);
    const res = await window.pundi.kenaikanTerapkan({
      kelas_asal_id: kelasAsalId,
      tahun_ajaran_tujuan_id: tahunTujuanId,
      perubahan,
    });
    setSibuk(false);
    setTinjau(false);
    if (res.ok) {
      const { dipindah, lulus, keluar } = res.data;
      setPesan(`Tersimpan: ${dipindah} siswa naik kelas, ${lulus} lulus, ${keluar} keluar. Saldo seluruh siswa tidak berubah.`);
      setGalat(null);
      await muatSiswa();
      onApplied?.();
    } else {
      setGalat(`Belum tersimpan, tidak ada data yang berubah. ${res.pesan}`);
    }
  };

  const semuaDipilih = items.length > 0 && items.every((s) => dipilih.has(s.siswa_id));
  const ringkasan = useMemo(() => {
    if (typeof perubahan === 'string') return null;
    const perKelas = new Map<string, number>();
    let lulus = 0;
    let keluar = 0;
    let diganti = 0;
    let saldo = 0;
    for (const p of perubahan) {
      const s = items.find((x) => x.siswa_id === p.siswa_id);
      saldo += s?.saldo ?? 0;
      if (s?.kelas_tujuan_nama && p.tindakan === 'pindah') diganti++;
      if (p.tindakan === 'lulus') lulus++;
      else if (p.tindakan === 'keluar') keluar++;
      else {
        const nama = kelasTujuanList.find((k) => k.id === p.kelas_tujuan_id)?.nama ?? '?';
        perKelas.set(nama, (perKelas.get(nama) ?? 0) + 1);
      }
    }
    return { perKelas: [...perKelas.entries()], lulus, keluar, diganti, saldo };
  }, [perubahan, items, kelasTujuanList]);

  if (tahunList.length < 2) {
    return (
      <section style={kartu} aria-label="Belum bisa naik kelas">
        <KeadaanKosong ikon={<IconKenaikan width={30} height={30} />} judul="Belum ada tahun ajaran baru">
          <p>
            Kenaikan kelas memindahkan siswa dari tahun ajaran lama ke tahun ajaran baru. Siapkan dulu tahun ajaran
            tujuannya.
          </p>
          <ol style={{ margin: '14px auto 0', padding: 0, listStyle: 'none', textAlign: 'left', display: 'inline-flex', flexDirection: 'column', gap: '8px' }}>
            {[
              <>Buka menu <strong>Tahun Ajaran &amp; Kelas</strong>.</>,
              <>Buat tahun ajaran baru beserta kelasnya (kelas dapat disalin dari tahun sebelumnya).</>,
              <>Kembali ke sini untuk memindahkan siswa.</>,
            ].map((t, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                <strong style={{ color: 'var(--accent)' }}>{i + 1}.</strong>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </KeadaanKosong>
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
        Pindahkan siswa ke kelas pada tahun ajaran yang lebih baru, atau tandai lulus/keluar. Saldo dan riwayat
        transaksi ikut tanpa berubah, dan kelas tahun lama tetap tersimpan sebagai riwayat.
      </p>

      {pesan && (
        <div role="status" style={{ padding: '10px 14px', border: '1px solid var(--ok)', color: 'var(--ok)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 500 }}>
          {pesan}
        </div>
      )}
      {galat && (
        <div role="alert" style={{ padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
          {galat}
        </div>
      )}

      <Langkah aktif={kelasAsalId === '' || tahunTujuanId === '' ? 0 : items.length === 0 ? 1 : dipilih.size === 0 ? 1 : 2} />

      <section style={{ ...kartu, padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }} aria-label="Pilih asal dan tujuan">
        <div>
          <label htmlFor="kn-ta-asal" style={labelStyle}>Tahun ajaran asal</label>
          <select id="kn-ta-asal" style={kolom} value={tahunAsalId} onChange={(e) => setTahunAsalId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">-- Pilih --</option>
            {tahunList.map((t) => (
              <option key={t.id} value={t.id}>{t.nama}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kn-kelas-asal" style={labelStyle}>Kelas asal</label>
          <select id="kn-kelas-asal" style={kolom} value={kelasAsalId} onChange={(e) => setKelasAsalId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">-- Pilih --</option>
            {kelasAsalList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama} ({k.jumlah_siswa ?? 0} siswa)</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kn-ta-tujuan" style={labelStyle}>Tahun ajaran tujuan</label>
          <select id="kn-ta-tujuan" style={kolom} value={tahunTujuanId} onChange={(e) => setTahunTujuanId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">-- Pilih --</option>
            {tujuanTersedia.map((t) => (
              <option key={t.id} value={t.id}>{t.nama}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kn-kelas-tujuan" style={labelStyle}>Kelas tujuan</label>
          <select id="kn-kelas-tujuan" style={kolom} value={kelasDefaultId} onChange={(e) => setKelasDefaultId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">-- Pilih --</option>
            {kelasTujuanList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
        </div>
      </section>

      {kelasAsalId === '' && (
        <section style={kartu} aria-label="Daftar siswa">
          <KeadaanKosong ikon={<IconSiswa width={30} height={30} />} judul="Pilih kelas asal">
            Pilih tahun ajaran dan kelas asal di atas. Daftar siswa kelas itu akan muncul di sini, lengkap dengan
            saldonya.
          </KeadaanKosong>
        </section>
      )}

      {kelasAsalId !== '' && (
        <section style={kartu} aria-labelledby="kn-judul-daftar">
          <div style={kartuKepala}>
            <h3 id="kn-judul-daftar" style={{ fontSize: '14px', fontWeight: 600 }}>
              Siswa pada kelas asal ({items.length})
            </h3>
            <button type="button" style={tombolUtama} onClick={bukaTinjau} disabled={items.length === 0}>
              Tinjau Perubahan
            </button>
          </div>
          <table className="tabel">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Pilih semua siswa"
                    checked={semuaDipilih}
                    onChange={(e) => setDipilih(e.target.checked ? new Set(items.map((s) => s.siswa_id)) : new Set())}
                  />
                </th>
                <th>Siswa</th>
                <th className="angka">Saldo</th>
                <th>Tindakan</th>
                <th>Kelas tujuan</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <KeadaanKosong ikon={<IconAkademik width={30} height={30} />} judul="Tidak ada siswa pada kelas ini">
                      Pilih kelas lain, atau tambahkan siswa lewat menu <strong>Siswa</strong> atau <strong>Impor</strong>.
                    </KeadaanKosong>
                  </td>
                </tr>
              ) : (
                items.map((s) => {
                  const t = tindakanDari(s.siswa_id);
                  return (
                    <tr key={s.siswa_id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${s.nama}`}
                          checked={dipilih.has(s.siswa_id)}
                          onChange={(e) => {
                            const baru = new Set(dipilih);
                            if (e.target.checked) baru.add(s.siswa_id);
                            else baru.delete(s.siswa_id);
                            setDipilih(baru);
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.nama}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {s.nomor}
                          {s.status !== 'aktif' && ` • ${s.status === 'lulus' ? 'Sudah lulus' : 'Sudah keluar'}`}
                          {s.kelas_tujuan_nama && ` • Sudah di kelas ${s.kelas_tujuan_nama}`}
                        </div>
                      </td>
                      <td className="angka">{formatRupiah(s.saldo)}</td>
                      <td>
                        <select
                          aria-label={`Tindakan untuk ${s.nama}`}
                          style={{ ...kolom, padding: '6px 8px' }}
                          value={t}
                          onChange={(e) => setTindakan({ ...tindakan, [s.siswa_id]: e.target.value as Tindakan })}
                        >
                          <option value="pindah">Naik kelas</option>
                          <option value="lulus">Lulus</option>
                          <option value="keluar">Keluar</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Kelas tujuan untuk ${s.nama}`}
                          style={{ ...kolom, padding: '6px 8px' }}
                          disabled={t !== 'pindah'}
                          value={t === 'pindah' ? kelasDari(s.siswa_id) : ''}
                          onChange={(e) => setKelasPerSiswa({ ...kelasPerSiswa, [s.siswa_id]: Number(e.target.value) })}
                        >
                          <option value="">-- Pilih --</option>
                          {kelasTujuanList.map((k) => (
                            <option key={k.id} value={k.id}>{k.nama}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      <Modal isOpen={tinjau} onClose={() => (sibuk ? undefined : setTinjau(false))} title="Tinjau Kenaikan Kelas" width="520px">
        {ringkasan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ringkasan.perKelas.map(([nama, n]) => (
                <li key={nama}>
                  <strong>{n}</strong> siswa naik ke kelas <strong>{nama}</strong>
                </li>
              ))}
              {ringkasan.lulus > 0 && (
                <li>
                  <strong>{ringkasan.lulus}</strong> siswa lulus
                </li>
              )}
              {ringkasan.keluar > 0 && (
                <li>
                  <strong>{ringkasan.keluar}</strong> siswa keluar
                </li>
              )}
            </ul>
            {ringkasan.diganti > 0 && (
              <p style={{ color: 'var(--warn-text)' }}>
                {ringkasan.diganti} siswa sudah punya kelas di tahun ajaran tujuan; kelas itu akan diganti.
              </p>
            )}
            <p style={{ color: 'var(--muted)' }}>
              Saldo seluruh siswa ini ({formatRupiah(ringkasan.saldo)}) tidak berubah. Perubahan tersimpan sekaligus: bila
              ada yang gagal, tidak ada yang berubah.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" autoFocus disabled={sibuk} style={{ ...tombol, padding: '8px 16px', fontSize: '13px' }} onClick={() => setTinjau(false)}>
                Kembali
              </button>
              <button type="button" disabled={sibuk} style={tombolUtama} onClick={terapkan}>
                {sibuk ? 'Menyimpan...' : 'Terapkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
