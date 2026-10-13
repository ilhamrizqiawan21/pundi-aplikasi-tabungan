import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from './Modal.js';
import './SiswaFormModal.css';
import type { Siswa, Kelas, StatusSiswa } from '../../shared/types.js';

interface SiswaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (siswa: Siswa) => void;
  siswaToEdit?: Siswa | null;
  kelasList: Kelas[];
}

export function SiswaFormModal({
  isOpen,
  onClose,
  onSaved,
  siswaToEdit,
  kelasList,
}: SiswaFormModalProps) {
  const [nama, setNama] = useState('');
  const [nis, setNis] = useState('');
  const [alamat, setAlamat] = useState('');
  const [status, setStatus] = useState<StatusSiswa>('aktif');
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (siswaToEdit) {
      setNama(siswaToEdit.nama);
      setNis(siswaToEdit.nis || '');
      setAlamat(siswaToEdit.alamat || '');
      setStatus(siswaToEdit.status);
      setKelasId(siswaToEdit.kelas_id || '');
    } else {
      setNama('');
      setNis('');
      setAlamat('');
      setStatus('aktif');
      setKelasId('');
    }
    setErrorMsg(null);
  }, [siswaToEdit, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setErrorMsg('Nama siswa wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await window.pundi.siswaSimpan({
        id: siswaToEdit?.id,
        nama: nama.trim(),
        nis: nis.trim() ? nis.trim() : null,
        alamat: alamat.trim() ? alamat.trim() : null,
        status,
        kelas_id: kelasId === '' ? null : Number(kelasId),
      });

      if (res.ok) {
        onSaved(res.data);
        onClose();
      } else {
        setErrorMsg(res.pesan);
      }
    } catch {
      setErrorMsg('Terjadi kesalahan saat menyimpan data siswa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={siswaToEdit ? 'Ubah Data Siswa' : 'Tambah Siswa Baru'}
    >
      <form onSubmit={handleSubmit} className="sfm-form">
        {errorMsg && (
          <div className="sfm-galat">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="sfm-label">
            Nama Lengkap <span className="sfm-wajib">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Ahmad Dahlan"
            className="sfm-kontrol"
          />
        </div>

        <div className="sfm-grid-dua">
          <div>
            <label className="sfm-label">
              NIS (Nomor Induk Siswa)
            </label>
            <input
              type="text"
              value={nis}
              onChange={(e) => setNis(e.target.value)}
              placeholder="Contoh: 2026001"
              className="sfm-kontrol"
            />
          </div>

          <div>
            <label className="sfm-label">
              Kelas
            </label>
            <select
              value={kelasId}
              onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}
              className="sfm-kontrol"
            >
              <option value="">-- Tanpa Kelas --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} {k.tahun_ajaran_nama ? `(${k.tahun_ajaran_nama})` : ''}
                </option>
              ))}
            </select>
            {kelasList.length === 0 && (
              <p className="sfm-bantuan">
                Belum ada kelas pada tahun ajaran aktif. Buat di menu Tahun Ajaran &amp; Kelas.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="sfm-label">
            Status Siswa
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusSiswa)}
            className="sfm-kontrol"
          >
            <option value="aktif">Aktif</option>
            <option value="lulus">Lulus</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>

        <div>
          <label className="sfm-label">
            Alamat / Keterangan
          </label>
          <textarea
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            rows={2}
            placeholder="Alamat domisili atau catatan tambahan"
            className="sfm-kontrol sfm-textarea"
          />
        </div>

        <div className="sfm-aksi">
          <button
            type="button"
            onClick={onClose}
            className="sfm-btn-batal"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="sfm-btn-simpan"
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
