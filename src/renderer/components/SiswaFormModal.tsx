import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from './Modal.js';
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FDEDEC',
              color: 'var(--danger)',
              borderRadius: '6px',
              fontSize: '13px',
              border: '1px solid #FADBD8',
            }}
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
            Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Ahmad Dahlan"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              NIS (Nomor Induk Siswa)
            </label>
            <input
              type="text"
              value={nis}
              onChange={(e) => setNis(e.target.value)}
              placeholder="Contoh: 2026001"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Kelas
            </label>
            <select
              value={kelasId}
              onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            >
              <option value="">-- Tanpa Kelas --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} {k.tahun_ajaran_nama ? `(${k.tahun_ajaran_nama})` : ''}
                </option>
              ))}
            </select>
            {kelasList.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                Belum ada kelas pada tahun ajaran aktif. Buat di menu Tahun Ajaran &amp; Kelas.
              </p>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
            Status Siswa
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusSiswa)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
            }}
          >
            <option value="aktif">Aktif</option>
            <option value="lulus">Lulus</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
            Alamat / Keterangan
          </label>
          <textarea
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            rows={2}
            placeholder="Alamat domisili atau catatan tambahan"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
