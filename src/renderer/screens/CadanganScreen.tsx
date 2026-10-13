import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/Modal.js';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Skeleton,
  EmptyState,
} from '../components/ui/index.js';
import { formatWaktuWib } from '../../shared/tanggal.js';
import './CadanganScreen.css';

interface ItemBackup {
  nama: string;
  token: string;
  jenis: 'manual' | 'otomatis' | 'pre-restore';
  ukuran: number;
  tanggal: string;
}

const LABEL_JENIS: Record<ItemBackup['jenis'], string> = {
  manual: 'Manual',
  otomatis: 'Otomatis',
  'pre-restore': 'Pengaman sebelum pemulihan',
};

export function CadanganScreen() {
  const [backups, setBackups] = useState<ItemBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [target, setTarget] = useState<{ token: string; nama: string } | null>(null);
  const [restoring, setRestoring] = useState(false);

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

  const handleSalinKeLuar = async () => {
    setMsg(null);
    const res = await window.pundi.backupSalinKeLuar();
    if (!res.ok) {
      setMsg({ text: `Gagal menyalin cadangan: ${res.pesan}`, type: 'err' });
    } else if (res.data) {
      setMsg({ text: `Salinan cadangan tersimpan di folder pilihan Anda (${res.data.nama_berkas}).`, type: 'ok' });
    }
  };

  const handlePilihBerkas = async () => {
    setMsg(null);
    const res = await window.pundi.dialogPilihFile({ ekstensi: ['sqlite'] });
    if (res.ok && res.data) {
      setTarget({ token: res.data.token, nama: res.data.nama_berkas });
    } else if (!res.ok) {
      setMsg({ text: res.pesan, type: 'err' });
    }
  };

  const handlePulihkan = async () => {
    if (!target) return;
    setRestoring(true);
    setMsg(null);
    try {
      const res = await window.pundi.backupRestore(target.token);
      if (res.ok) {
        // Muat ulang agar seluruh layar membaca data hasil pemulihan
        alert('Data berhasil dipulihkan. Pundi akan memuat ulang.');
        window.location.reload();
        return;
      }
      setMsg({ text: `Pemulihan dibatalkan: ${res.pesan}`, type: 'err' });
      setTarget(null);
    } catch {
      setMsg({ text: 'Terjadi kesalahan saat memulihkan data. Data Anda tidak diubah.', type: 'err' });
      setTarget(null);
    } finally {
      setRestoring(false);
    }
  };

  const formatUkuran = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="cd-halaman">
      {/* Header & Aksi Cadangkan */}
      <Card className="cd-kepala">
        <div className="cd-kepala-teks">
          <h3 className="cd-kepala-judul">
            Cadangan dan pemulihan data
          </h3>
          <p className="cd-kepala-ket">
            Pundi menyimpan cadangan otomatis secara berkala. Sangat disarankan untuk menyalin berkas cadangan ke flashdisk atau media penyimpanan eksternal.
          </p>
        </div>

        <div className="cd-aksi-atas">
          <Button
            variant="secondary"
            size="md"
            onClick={handleSalinKeLuar}
          >
            Salin ke flashdisk…
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handlePilihBerkas}
          >
            Pulihkan dari berkas…
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleBuatCadangan}
            disabled={creating}
          >
            {creating ? 'Membuat...' : 'Cadangkan Sekarang'}
          </Button>
        </div>
      </Card>

      {msg && (
        <div
          role={msg.type === 'err' ? 'alert' : 'status'}
          className={`cd-pesan ${msg.type === 'ok' ? 'cd-pesan-ok' : 'cd-pesan-err'}`}
        >
          {msg.text}
        </div>
      )}

      {/* Daftar Berkas Cadangan */}
      <Card className="cd-daftar">
        <CardHeader>
          <CardTitle>Daftar Berkas Cadangan Tersimpan</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchBackups}
          >
            Segarkan
          </Button>
        </CardHeader>

        <div className="ui-table-container cd-tabel">
          <table className="tabel tabel-kartu">
            <thead>
              <tr>
                <th>Nama Berkas Cadangan</th>
                <th>Jenis</th>
                <th>Waktu Dibuat</th>
                <th className="angka">Ukuran</th>
                <th className="angka">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[1, 2, 3].map((idx) => (
                    <tr key={idx}>
                      <td data-label="Nama Berkas"><Skeleton width="180px" height="18px" /></td>
                      <td data-label="Jenis"><Skeleton width="80px" height="18px" /></td>
                      <td data-label="Waktu Dibuat"><Skeleton width="130px" height="18px" /></td>
                      <td data-label="Ukuran" className="angka"><Skeleton width="60px" height="18px" /></td>
                      <td data-label="Aksi" className="angka"><Skeleton width="70px" height="28px" variant="rectangular" /></td>
                    </tr>
                  ))}
                </>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="kosong cd-kosong">
                    <EmptyState
                      title="Belum ada berkas cadangan"
                      description="Klik tombol 'Cadangkan Sekarang' untuk membuat cadangan baru."
                    />
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.nama}>
                    <td data-label="Nama Berkas" className="cd-nama">{b.nama}</td>
                    <td data-label="Jenis">{LABEL_JENIS[b.jenis]}</td>
                    <td data-label="Waktu Dibuat" className="cd-waktu">
                      {formatWaktuWib(b.tanggal)}
                    </td>
                    <td data-label="Ukuran" className="angka">
                      {formatUkuran(b.ukuran)}
                    </td>
                    <td data-label="Aksi" className="angka">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setTarget({ token: b.token, nama: b.nama })}
                        aria-label={`Pulihkan dari ${b.nama}`}
                      >
                        Pulihkan
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={target !== null}
        onClose={() => (restoring ? undefined : setTarget(null))}
        title="Pulihkan Data dari Cadangan"
      >
        <div className="cd-modal">
          <div role="alert" className="cd-peringatan">
            Data yang ada sekarang akan diganti dengan isi berkas ini. Transaksi yang dicatat setelah cadangan itu dibuat tidak akan ada lagi.
          </div>
          <p>
            Berkas: <strong>{target?.nama}</strong>
          </p>
          <p className="cd-redup">
            Pundi membuat cadangan pengaman dari data saat ini terlebih dahulu, sehingga pemulihan masih bisa dibatalkan.
          </p>
          <div className="cd-modal-aksi">
            <Button
              type="button"
              variant="secondary"
              size="md"
              autoFocus
              disabled={restoring}
              onClick={() => setTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              disabled={restoring}
              onClick={handlePulihkan}
            >
              {restoring ? 'Memulihkan...' : 'Pulihkan Sekarang'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
