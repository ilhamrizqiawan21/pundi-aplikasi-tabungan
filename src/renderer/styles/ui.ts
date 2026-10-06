import type { CSSProperties } from 'react';

// Gaya bersama komponen; memakai token warna dan mockup (DESIGN §2 & Mockup Pundi.pdf)
// Gaya inline menimpa transisi global tombol, jadi efek tekan (transform) ikut ditulis di sini
const TRANSISI_TOMBOL = 'transform var(--dur-cepat) var(--ease), background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease';

export const tombol: CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 500,
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  color: 'var(--text)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: TRANSISI_TOMBOL,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
};

export const tombolUtama: CSSProperties = {
  padding: '8px 18px',
  fontSize: '13px',
  fontWeight: 600,
  backgroundColor: 'var(--accent)',
  color: 'var(--accent-text)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: TRANSISI_TOMBOL,
  boxShadow: '0 1px 2px color-mix(in srgb, var(--accent) 30%, transparent)',
};

export const kolom: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '13px',
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
  borderRadius: 'var(--radius-lg)',
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
  fontSize: '12px',
  fontWeight: 600,
};
