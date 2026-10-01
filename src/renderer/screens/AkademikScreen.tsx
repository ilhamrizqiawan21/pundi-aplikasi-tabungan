import { useState, useEffect, useCallback, type CSSProperties, type FormEvent } from 'react';
import type { TahunAjaran, Kelas } from '../../shared/types.js';
import { Modal } from '../components/Modal.js';

interface AkademikScreenProps {
  /** Dipanggil setelah data berubah agar bilah atas ikut diperbarui. */
  onChanged: () => void;
}

const tombol: CSSProperties = {
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 500,
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  cursor: 'pointer',
  color: 'var(--text)',
};
const tombolUtama: CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 600,
  backgroundColor: 'var(--accent)',
  color: 'var(--accent-text)',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
};
const kolom: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  color: 'var(--text)',
};
const labelStyle: CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' };
const kartu: CSSProperties = {
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  overflow: 'hidden',
};
const kartuKepala: CSSProperties = {
  padding: '12px 18px',
  backgroundColor: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
};
const sel: CSSProperties = { padding: '10px 16px' };

function tanggalIndonesia(s: string): string {
  return new Date(`${s}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Saran tahun ajaran berikutnya (Juli sampai Juni), melanjutkan tahun terakhir bila ada. */
function sarankanTahun(daftar: TahunAjaran[]): { nama: string; mulai: string; selesai: string } {
  let tahun: number;
  if (daftar.length > 0) {
    tahun = Math.max(...daftar.map((t) => Number(t.mulai.slice(0, 4)))) + 1;
  } else {
    const now = new Date();
    tahun = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  }
  return { nama: `${tahun}/${tahun + 1}`, mulai: `${tahun}-07-01`, selesai: `${tahun + 1}-06-30` };
}

export function AkademikScreen({ onChanged }: AkademikScreenProps) {
  const [tahunList, setTahunList] = useState<TahunAjaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [terpilihId, setTerpilihId] = useState<number | null>(null);
  const [pesan, setPesan] = useState<{ teks: string; jenis: 'ok' | 'err' } | null>(null);

  const [formTahun, setFormTahun] = useState<{ edit: TahunAjaran | null } | null>(null);
  const [formKelas, setFormKelas] = useState<{ edit: Kelas | null } | null>(null);
  const [aktivasi, setAktivasi] = useState<TahunAjaran | null>(null);
  const [salinOpen, setSalinOpen] = useState(false);

  const muatTahun = useCallback(async () => {
    const res = await window.pundi.tahunAjaranDaftar();
    if (res.ok) {
      setTahunList(res.data);
      setTerpilihId((prev) => {
        if (prev !== null && res.data.some((t) => t.id === prev)) return prev;
        return res.data.find((t) => t.aktif === 1)?.id ?? res.data[0]?.id ?? null;
      });
    }
  }, []);

  const muatKelas = useCallback(async (tahunId: number | null) => {
    if (tahunId === null) {
      setKelasList([]);
      return;
    }
    const res = await window.pundi.kelasDaftar(tahunId);
    if (res.ok) setKelasList(res.data);
  }, []);

  useEffect(() => {
    muatTahun();
  }, [muatTahun]);

  useEffect(() => {
    muatKelas(terpilihId);
  }, [terpilihId, muatKelas]);

  const terpilih = tahunList.find((t) => t.id === terpilihId) ?? null;

  const selesai = async (teks: string) => {
    setPesan({ teks, jenis: 'ok' });
    await muatTahun();
    await muatKelas(terpilihId);
    onChanged();
  };

  const hapusTahun = async (t: TahunAjaran) => {
    if (!confirm(`Hapus tahun ajaran ${t.nama}?`)) return;
    const res = await window.pundi.tahunAjaranHapus(t.id);
    if (res.ok) await selesai(`Tahun ajaran ${t.nama} dihapus.`);
    else setPesan({ teks: res.pesan, jenis: 'err' });
  };

  const hapusKelas = async (k: Kelas) => {
    if (!confirm(`Hapus kelas ${k.nama}?`)) return;
    const res = await window.pundi.kelasHapus(k.id);
    if (res.ok) await selesai(`Kelas ${k.nama} dihapus.`);
    else setPesan({ teks: res.pesan, jenis: 'err' });
  };

  const jadikanAktif = async () => {
    if (!aktivasi) return;
    const res = await window.pundi.tahunAjaranSimpan({
      id: aktivasi.id,
      nama: aktivasi.nama,
      mulai: aktivasi.mulai,
      selesai: aktivasi.selesai,
      aktif: true,
    });
    setAktivasi(null);
    if (res.ok) await selesai(`Tahun ajaran ${aktivasi.nama} sekarang aktif.`);
    else setPesan({ teks: res.pesan, jenis: 'err' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
        Hanya satu tahun ajaran yang aktif. Siswa dan transaksi baru dicatat pada tahun ajaran aktif. Mengganti tahun
        ajaran tidak mengubah data tahun-tahun sebelumnya.
      </p>

      {pesan && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            border: `1px solid ${pesan.jenis === 'ok' ? 'var(--ok)' : 'var(--danger)'}`,
            color: pesan.jenis === 'ok' ? 'var(--ok)' : 'var(--danger)',
          }}
        >
          {pesan.teks}
        </div>
      )}

      {/* Tahun Ajaran */}
      <section style={kartu} aria-labelledby="judul-tahun">
        <div style={kartuKepala}>
          <h3 id="judul-tahun" style={{ fontSize: '14px', fontWeight: 600 }}>
            Tahun Ajaran
          </h3>
          <button type="button" style={tombolUtama} onClick={() => setFormTahun({ edit: null })}>
            + Tambah Tahun Ajaran
          </button>
        </div>
        {tahunList.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
            Belum ada tahun ajaran. Buat tahun ajaran pertama untuk mulai mengelompokkan siswa ke dalam kelas.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <th style={sel}>Tahun Ajaran</th>
                <th style={sel}>Periode</th>
                <th style={sel}>Status</th>
                <th style={{ ...sel, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tahunList.map((t) => (
                <tr
                  key={t.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: t.id === terpilihId ? 'var(--surface)' : 'transparent',
                  }}
                >
                  <td style={{ ...sel, fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={() => setTerpilihId(t.id)}
                      aria-pressed={t.id === terpilihId}
                      style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', fontSize: '13px' }}
                    >
                      {t.nama}
                    </button>
                  </td>
                  <td style={{ ...sel, color: 'var(--muted)' }}>
                    {tanggalIndonesia(t.mulai)} – {tanggalIndonesia(t.selesai)}
                  </td>
                  <td style={sel}>
                    {t.aktif === 1 ? (
                      <span style={{ color: 'var(--ok)', fontWeight: 600, border: '1px solid var(--ok)', borderRadius: '4px', padding: '2px 8px', fontSize: '12px' }}>
                        Aktif
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>Tidak aktif</span>
                    )}
                  </td>
                  <td style={{ ...sel, textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', gap: '6px' }}>
                      {t.aktif !== 1 && (
                        <button type="button" style={tombol} onClick={() => setAktivasi(t)}>
                          Jadikan Aktif
                        </button>
                      )}
                      <button type="button" style={tombol} onClick={() => setFormTahun({ edit: t })}>
                        Ubah
                      </button>
                      {t.aktif !== 1 && (
                        <button type="button" style={{ ...tombol, color: 'var(--danger)' }} onClick={() => hapusTahun(t)}>
                          Hapus
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Kelas */}
      {terpilih && (
        <section style={kartu} aria-labelledby="judul-kelas">
          <div style={kartuKepala}>
            <h3 id="judul-kelas" style={{ fontSize: '14px', fontWeight: 600 }}>
              Kelas Tahun Ajaran {terpilih.nama}
            </h3>
            <span style={{ display: 'flex', gap: '8px' }}>
              {tahunList.length > 1 && (
                <button type="button" style={{ ...tombol, padding: '8px 14px', fontSize: '13px' }} onClick={() => setSalinOpen(true)}>
                  Salin Kelas dari Tahun Lain
                </button>
              )}
              <button type="button" style={tombolUtama} onClick={() => setFormKelas({ edit: null })}>
                + Tambah Kelas
              </button>
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <th style={sel}>Kelas</th>
                <th style={sel}>Tingkat</th>
                <th style={sel}>Urutan</th>
                <th style={{ ...sel, textAlign: 'right' }}>Jumlah Siswa</th>
                <th style={{ ...sel, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kelasList.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...sel, padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                    Belum ada kelas pada tahun ajaran ini. Tambah kelas, atau salin dari tahun ajaran lain.
                  </td>
                </tr>
              ) : (
                kelasList.map((k) => (
                  <tr key={k.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...sel, fontWeight: 600 }}>{k.nama}</td>
                    <td style={sel}>{k.tingkat}</td>
                    <td style={sel}>{k.urutan}</td>
                    <td className="tabular-nums" style={{ ...sel, textAlign: 'right' }}>
                      {k.jumlah_siswa ?? 0}
                    </td>
                    <td style={{ ...sel, textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', gap: '6px' }}>
                        <button type="button" style={tombol} onClick={() => setFormKelas({ edit: k })} aria-label={`Ubah kelas ${k.nama}`}>
                          Ubah
                        </button>
                        <button
                          type="button"
                          style={{ ...tombol, color: 'var(--danger)' }}
                          onClick={() => hapusKelas(k)}
                          aria-label={`Hapus kelas ${k.nama}`}
                        >
                          Hapus
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {formTahun && (
        <FormTahun
          edit={formTahun.edit}
          saran={sarankanTahun(tahunList)}
          pertama={tahunList.length === 0}
          onClose={() => setFormTahun(null)}
          onSaved={async (nama) => {
            setFormTahun(null);
            await selesai(`Tahun ajaran ${nama} tersimpan.`);
          }}
        />
      )}

      {formKelas && terpilih && (
        <FormKelas
          edit={formKelas.edit}
          tahun={terpilih}
          onClose={() => setFormKelas(null)}
          onSaved={async (nama) => {
            setFormKelas(null);
            await selesai(`Kelas ${nama} tersimpan.`);
          }}
        />
      )}

      {salinOpen && terpilih && (
        <FormSalin
          tujuan={terpilih}
          sumber={tahunList.filter((t) => t.id !== terpilih.id)}
          onClose={() => setSalinOpen(false)}
          onDone={async (teks) => {
            setSalinOpen(false);
            await selesai(teks);
          }}
        />
      )}

      <Modal isOpen={aktivasi !== null} onClose={() => setAktivasi(null)} title="Jadikan Tahun Ajaran Aktif">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          <p>
            Tahun ajaran <strong>{aktivasi?.nama}</strong> akan menjadi tahun ajaran aktif.
          </p>
          <p style={{ color: 'var(--muted)' }}>
            Data tahun ajaran sebelumnya tidak berubah. Siswa belum memiliki kelas pada tahun ajaran ini sampai
            dipindahkan, misalnya lewat menu Kenaikan Kelas atau dengan mengubah data siswa.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" autoFocus style={{ ...tombol, padding: '8px 16px', fontSize: '13px' }} onClick={() => setAktivasi(null)}>
              Batal
            </button>
            <button type="button" style={tombolUtama} onClick={jadikanAktif}>
              Jadikan Aktif
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Galat({ teks }: { teks: string | null }) {
  if (!teks) return null;
  return (
    <div role="alert" style={{ padding: '10px 14px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', fontSize: '13px' }}>
      {teks}
    </div>
  );
}

function Tombolan({ onClose, simpan, sibuk }: { onClose: () => void; simpan: string; sibuk: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
      <button type="button" style={{ ...tombol, padding: '8px 16px', fontSize: '13px' }} onClick={onClose}>
        Batal
      </button>
      <button type="submit" disabled={sibuk} style={tombolUtama}>
        {sibuk ? 'Menyimpan...' : simpan}
      </button>
    </div>
  );
}

function FormTahun({
  edit,
  saran,
  pertama,
  onClose,
  onSaved,
}: {
  edit: TahunAjaran | null;
  saran: { nama: string; mulai: string; selesai: string };
  pertama: boolean;
  onClose: () => void;
  onSaved: (nama: string) => void;
}) {
  const [nama, setNama] = useState(edit?.nama ?? saran.nama);
  const [mulai, setMulai] = useState(edit?.mulai ?? saran.mulai);
  const [selesai, setSelesai] = useState(edit?.selesai ?? saran.selesai);
  const sedangAktif = edit?.aktif === 1;
  const [aktif, setAktif] = useState(sedangAktif || pertama);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.tahunAjaranSimpan({ id: edit?.id, nama: nama.trim(), mulai, selesai, aktif });
    setSibuk(false);
    if (res.ok) onSaved(res.data.nama);
    else setGalat(res.pesan);
  };

  return (
    <Modal isOpen onClose={onClose} title={edit ? 'Ubah Tahun Ajaran' : 'Tambah Tahun Ajaran'}>
      <form onSubmit={kirim} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Galat teks={galat} />
        <div>
          <label htmlFor="ta-nama" style={labelStyle}>Nama Tahun Ajaran</label>
          <input id="ta-nama" style={kolom} value={nama} onChange={(e) => setNama(e.target.value)} required autoFocus placeholder="Contoh: 2026/2027" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="ta-mulai" style={labelStyle}>Mulai</label>
            <input id="ta-mulai" type="date" style={kolom} value={mulai} onChange={(e) => setMulai(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="ta-selesai" style={labelStyle}>Selesai</label>
            <input id="ta-selesai" type="date" style={kolom} value={selesai} onChange={(e) => setSelesai(e.target.value)} required />
          </div>
        </div>
        <label htmlFor="ta-aktif" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <input id="ta-aktif" type="checkbox" checked={aktif} disabled={sedangAktif || pertama} onChange={(e) => setAktif(e.target.checked)} />
          Jadikan tahun ajaran aktif
        </label>
        {sedangAktif && (
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Tahun ajaran ini sedang aktif. Untuk menggantinya, jadikan tahun ajaran lain sebagai aktif.
          </p>
        )}
        <Tombolan onClose={onClose} simpan="Simpan" sibuk={sibuk} />
      </form>
    </Modal>
  );
}

function FormKelas({
  edit,
  tahun,
  onClose,
  onSaved,
}: {
  edit: Kelas | null;
  tahun: TahunAjaran;
  onClose: () => void;
  onSaved: (nama: string) => void;
}) {
  const [nama, setNama] = useState(edit?.nama ?? '');
  const [tingkat, setTingkat] = useState(String(edit?.tingkat ?? ''));
  const [urutan, setUrutan] = useState(String(edit?.urutan ?? 1));
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.kelasSimpan({
      id: edit?.id,
      tahun_ajaran_id: tahun.id,
      nama: nama.trim(),
      tingkat: Number(tingkat),
      urutan: Number(urutan) || 1,
    });
    setSibuk(false);
    if (res.ok) onSaved(res.data.nama);
    else setGalat(res.pesan);
  };

  return (
    <Modal isOpen onClose={onClose} title={edit ? `Ubah Kelas ${edit.nama}` : `Tambah Kelas — ${tahun.nama}`}>
      <form onSubmit={kirim} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Galat teks={galat} />
        <div>
          <label htmlFor="kelas-nama" style={labelStyle}>Nama Kelas</label>
          <input id="kelas-nama" style={kolom} value={nama} onChange={(e) => setNama(e.target.value)} required autoFocus placeholder="Contoh: 7A" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="kelas-tingkat" style={labelStyle}>Tingkat</label>
            <input id="kelas-tingkat" type="number" min={1} max={20} style={kolom} value={tingkat} onChange={(e) => setTingkat(e.target.value)} required placeholder="Contoh: 7" />
          </div>
          <div>
            <label htmlFor="kelas-urutan" style={labelStyle}>Urutan Tampil</label>
            <input id="kelas-urutan" type="number" style={kolom} value={urutan} onChange={(e) => setUrutan(e.target.value)} />
          </div>
        </div>
        <Tombolan onClose={onClose} simpan="Simpan" sibuk={sibuk} />
      </form>
    </Modal>
  );
}

function FormSalin({
  tujuan,
  sumber,
  onClose,
  onDone,
}: {
  tujuan: TahunAjaran;
  sumber: TahunAjaran[];
  onClose: () => void;
  onDone: (teks: string) => void;
}) {
  const [dariId, setDariId] = useState(String(sumber[0]?.id ?? ''));
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setSibuk(true);
    setGalat(null);
    const res = await window.pundi.kelasSalin(Number(dariId), tujuan.id);
    setSibuk(false);
    if (res.ok) {
      const { disalin, dilewati } = res.data;
      onDone(
        `${disalin} kelas disalin ke ${tujuan.nama}` + (dilewati > 0 ? `, ${dilewati} dilewati karena sudah ada.` : '.')
      );
    } else {
      setGalat(res.pesan);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Salin Kelas ke ${tujuan.nama}`}>
      <form onSubmit={kirim} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Galat teks={galat} />
        <div>
          <label htmlFor="salin-dari" style={labelStyle}>Salin daftar kelas dari</label>
          <select id="salin-dari" style={kolom} value={dariId} onChange={(e) => setDariId(e.target.value)} autoFocus>
            {sumber.map((t) => (
              <option key={t.id} value={t.id}>{t.nama}</option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Hanya daftar kelas yang disalin, tanpa siswa. Kelas yang namanya sudah ada dilewati.
        </p>
        <Tombolan onClose={onClose} simpan="Salin Kelas" sibuk={sibuk} />
      </form>
    </Modal>
  );
}
