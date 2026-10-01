import type { CSSProperties } from 'react';

// Gaya bersama layar-layar baru; hanya memakai token warna (DESIGN §2)
export const tombol: CSSProperties = {
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 500,
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  cursor: 'pointer',
  color: 'var(--text)',
};
export const tombolUtama: CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 600,
  backgroundColor: 'var(--accent)',
  color: 'var(--accent-text)',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
};
export const kolom: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  color: 'var(--text)',
};
export const labelStyle: CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' };
export const kartu: CSSProperties = {
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  overflow: 'hidden',
};
export const kartuKepala: CSSProperties = {
  padding: '12px 18px',
  backgroundColor: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
};
export const sel: CSSProperties = { padding: '10px 16px' };
