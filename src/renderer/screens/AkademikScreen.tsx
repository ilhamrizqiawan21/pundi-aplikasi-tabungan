import { useState, useEffect, useCallback, type FormEvent } from 'react';
import type { TahunAjaran, Kelas } from '../../shared/types.js';
import { Modal } from '../components/Modal.js';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Select,
} from '../components/ui/index.js';
import { formatTanggalIndonesia, hariIniLokal } from '../../shared/tanggal.js';
import './AkademikScreen.css';

interface AkademikScreenProps {
  /** Dipanggil setelah data berubah agar bilah atas ikut diperbarui. */
  onChanged: () => void;
}

/** Saran tahun ajaran berikutnya (Juli sampai Juni), melanjutkan tahun terakhir bila ada. */
function sarankanTahun(daftar: TahunAjaran[]): { nama: string; mulai: string; selesai: string } {
  let tahun: number;
  if (daftar.length > 0) {
    tahun = Math.max(...daftar.map((t) => Number(t.mulai.slice(0, 4)))) + 1;
  } else {
    const today = hariIniLokal();
    const bln = Number(today.slice(5, 7));
    const thn = Number(today.slice(0, 4));
    tahun = bln >= 7 ? thn : thn - 1;
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
    <div className="akd-halaman">
      <p className="akd-intro">
        Hanya satu tahun ajaran yang aktif. Siswa dan transaksi baru dicatat pada tahun ajaran aktif. Mengganti tahun
        ajaran tidak mengubah data tahun-tahun sebelumnya.
      </p>

      {pesan && (
        <div role="status" className={pesan.jenis === 'ok' ? 'akd-pesan' : 'akd-pesan akd-pesan-err'}>
          {pesan.teks}
        </div>
      )}

      {/* Tahun Ajaran */}
      <Card aria-labelledby="judul-tahun">
        <CardHeader>
          <CardTitle id="judul-tahun">
            Tahun Ajaran
          </CardTitle>
          <Button variant="primary" size="sm" onClick={() => setFormTahun({ edit: null })}>
            + Tambah Tahun Ajaran
          </Button>
        </CardHeader>
        {tahunList.length === 0 ? (
          <div className="akd-kosong">
            Belum ada tahun ajaran. Buat tahun ajaran pertama untuk mulai mengelompokkan siswa ke dalam kelas.
          </div>
        ) : (
          <div className="ui-table-container akd-tabel">
            <table className="tabel tabel-kartu">
              <thead>
                <tr>
                  <th>Tahun Ajaran</th>
                  <th>Periode</th>
                  <th>Status</th>
                  <th className="angka">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tahunList.map((t) => (
                  <tr
                    key={t.id}
                    className={t.id === terpilihId ? 'baris-dipilih' : undefined}
                  >
                    <td data-label="Tahun Ajaran" className="akd-tebal">
                      <button
                        type="button"
                        onClick={() => setTerpilihId(t.id)}
                        aria-pressed={t.id === terpilihId}
                        className="akd-pilih-tahun"
                      >
                        {t.nama}
                      </button>
                    </td>
                    <td data-label="Periode" className="akd-muted">
                      {formatTanggalIndonesia(t.mulai)} – {formatTanggalIndonesia(t.selesai)}
                    </td>
                    <td data-label="Status">
                      {t.aktif === 1 ? (
                        <Badge variant="ok">Aktif</Badge>
                      ) : (
                        <span className="akd-tak-aktif">Tidak aktif</span>
                      )}
                    </td>
                    <td data-label="Aksi" className="angka">
                      <span className="akd-aksi akd-aksi-lipat">
                        {t.aktif !== 1 && (
                          <Button variant="secondary" size="sm" onClick={() => setAktivasi(t)}>
                            Jadikan Aktif
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setFormTahun({ edit: t })}>
                          Ubah
                        </Button>
                        {t.aktif !== 1 && (
                          <Button variant="danger" size="sm" onClick={() => hapusTahun(t)}>
                            Hapus
                          </Button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Kelas */}
      {terpilih && (
        <Card aria-labelledby="judul-kelas">
          <CardHeader>
            <CardTitle id="judul-kelas">
              Kelas Tahun Ajaran {terpilih.nama}
            </CardTitle>
            <span className="akd-header-aksi">
              {tahunList.length > 1 && (
                <Button variant="secondary" size="sm" onClick={() => setSalinOpen(true)}>
                  Salin Kelas dari Tahun Lain
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => setFormKelas({ edit: null })}>
                + Tambah Kelas
              </Button>
            </span>
          </CardHeader>
          <div className="ui-table-container akd-tabel">
            <table className="tabel tabel-kartu">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Tingkat</th>
                  <th>Urutan</th>
                  <th className="angka">Jumlah Siswa</th>
                  <th className="angka">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {kelasList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="kosong">
                      Belum ada kelas pada tahun ajaran ini. Tambah kelas, atau salin dari tahun ajaran lain.
                    </td>
                  </tr>
                ) : (
                  kelasList.map((k) => (
                    <tr key={k.id}>
                      <td data-label="Kelas" className="akd-tebal">{k.nama}</td>
                      <td data-label="Tingkat">{k.tingkat}</td>
                      <td data-label="Urutan">{k.urutan}</td>
                      <td data-label="Jumlah Siswa" className="angka">
                        {k.jumlah_siswa ?? 0}
                      </td>
                      <td data-label="Aksi" className="angka">
                        <span className="akd-aksi">
                          <Button variant="secondary" size="sm" onClick={() => setFormKelas({ edit: k })} aria-label={`Ubah kelas ${k.nama}`}>
                            Ubah
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => hapusKelas(k)}
                            aria-label={`Hapus kelas ${k.nama}`}
                          >
                            Hapus
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
        <div className="akd-modal-isi">
          <p>
            Tahun ajaran <strong>{aktivasi?.nama}</strong> akan menjadi tahun ajaran aktif.
          </p>
          <p className="akd-muted">
            Data tahun ajaran sebelumnya tidak berubah. Siswa belum memiliki kelas pada tahun ajaran ini sampai
            dipindahkan, misalnya lewat menu Kenaikan Kelas atau dengan mengubah data siswa.
          </p>
          <div className="akd-tombolan">
            <Button type="button" variant="secondary" size="md" autoFocus onClick={() => setAktivasi(null)}>
              Batal
            </Button>
            <Button type="button" variant="primary" size="md" onClick={jadikanAktif}>
              Jadikan Aktif
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Galat({ teks }: { teks: string | null }) {
  if (!teks) return null;
  return (
    <div role="alert" className="akd-galat">
      {teks}
    </div>
  );
}

function Tombolan({ onClose, simpan, sibuk }: { onClose: () => void; simpan: string; sibuk: boolean }) {
  return (
    <div className="akd-tombolan">
      <Button type="button" variant="secondary" size="md" onClick={onClose}>
        Batal
      </Button>
      <Button type="submit" variant="primary" size="md" disabled={sibuk}>
        {sibuk ? 'Menyimpan...' : simpan}
      </Button>
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
      <form onSubmit={kirim} className="akd-form">
        <Galat teks={galat} />
        <div>
          <label htmlFor="ta-nama" className="akd-label">
            Nama Tahun Ajaran
          </label>
          <Input
            id="ta-nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            required
            autoFocus
            placeholder="Contoh: 2026/2027"
          />
        </div>
        <div className="akd-grid-dua">
          <div>
            <label htmlFor="ta-mulai" className="akd-label">
              Mulai
            </label>
            <Input
              id="ta-mulai"
              type="date"
              value={mulai}
              onChange={(e) => setMulai(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="ta-selesai" className="akd-label">
              Selesai
            </label>
            <Input
              id="ta-selesai"
              type="date"
              value={selesai}
              onChange={(e) => setSelesai(e.target.value)}
              required
            />
          </div>
        </div>
        <label htmlFor="ta-aktif" className="akd-centang">
          <input id="ta-aktif" type="checkbox" checked={aktif} disabled={sedangAktif || pertama} onChange={(e) => setAktif(e.target.checked)} />
          Jadikan tahun ajaran aktif
        </label>
        {sedangAktif && (
          <p className="akd-catatan">
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
      <form onSubmit={kirim} className="akd-form">
        <Galat teks={galat} />
        <div>
          <label htmlFor="kelas-nama" className="akd-label">
            Nama Kelas
          </label>
          <Input
            id="kelas-nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            required
            autoFocus
            placeholder="Contoh: 7A"
          />
        </div>
        <div className="akd-grid-dua">
          <div>
            <label htmlFor="kelas-tingkat" className="akd-label">
              Tingkat
            </label>
            <Input
              id="kelas-tingkat"
              type="number"
              min={1}
              max={20}
              value={tingkat}
              onChange={(e) => setTingkat(e.target.value)}
              required
              placeholder="Contoh: 7"
            />
          </div>
          <div>
            <label htmlFor="kelas-urutan" className="akd-label">
              Urutan Tampil
            </label>
            <Input
              id="kelas-urutan"
              type="number"
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
            />
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
      <form onSubmit={kirim} className="akd-form">
        <Galat teks={galat} />
        <div>
          <label htmlFor="salin-dari" className="akd-label">
            Salin daftar kelas dari
          </label>
          <Select
            id="salin-dari"
            value={dariId}
            onChange={(e) => setDariId(e.target.value)}
            autoFocus
          >
            {sumber.map((t) => (
              <option key={t.id} value={t.id}>{t.nama}</option>
            ))}
          </Select>
        </div>
        <p className="akd-catatan">
          Hanya daftar kelas yang disalin, tanpa siswa. Kelas yang namanya sudah ada dilewati.
        </p>
        <Tombolan onClose={onClose} simpan="Salin Kelas" sibuk={sibuk} />
      </form>
    </Modal>
  );
}
