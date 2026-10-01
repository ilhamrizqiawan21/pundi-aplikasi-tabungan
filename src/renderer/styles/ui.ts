import type { CSSProperties } from 'react';

// Gaya bersama komponen; memakai token warna dan mockup (DESIGN §2 & Mockup Pundi.pdf)
export const tombol: CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 500,
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  cursor: 'pointer',
  color: 'var(--text)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.15s ease',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
};

export const tombolUtama: CSSProperties = {
  padding: '8px 18px',
  fontSize: '13px',
  fontWeight: 600,
  backgroundColor: 'var(--accent)',
  color: 'var(--accent-text)',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.15s ease',
  boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
};

export const kolom: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: 'var(--muted)',
  marginBottom: '6px',
};

export const kartu: CSSProperties = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '16px',
  boxShadow: 'var(--card-shadow)',
  overflow: 'hidden',
};

export const kartuKepala: CSSProperties = {
  padding: '16px 20px',
  backgroundColor: 'var(--card-bg)',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
};

export const sel: CSSProperties = {
  padding: '12px 18px',
};

export const badgePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '9999px',
  fontSize: '11px',
  fontWeight: 600,
};
