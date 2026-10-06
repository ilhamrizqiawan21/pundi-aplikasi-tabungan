import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconTutup } from './Icons.js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

const FOKUSABEL = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, width = '480px' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Elemen yang fokus sebelum jendela dibuka. Dibaca saat render pertama (sebelum anak sempat autoFocus) untuk
  // jendela yang dipasang saat dibuka; focusin menjaga nilainya untuk jendela yang selalu terpasang.
  const [fokusAwal] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const pemicuRef = useRef<HTMLElement | null>(fokusAwal);

  useEffect(() => {
    function catatFokus(e: FocusEvent) {
      if (e.target instanceof HTMLElement && !panelRef.current?.contains(e.target)) pemicuRef.current = e.target;
    }
    window.addEventListener('focusin', catatFokus);
    return () => window.removeEventListener('focusin', catatFokus);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Fokus keyboard berputar di dalam jendela
      if (e.key === 'Tab' && panelRef.current) {
        const daftar = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOKUSABEL));
        if (daftar.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const awal = daftar[0];
        const akhir = daftar[daftar.length - 1];
        const aktif = document.activeElement;
        if (e.shiftKey && (aktif === awal || !panelRef.current.contains(aktif))) {
          e.preventDefault();
          akhir.focus();
        } else if (!e.shiftKey && (aktif === akhir || !panelRef.current.contains(aktif))) {
          e.preventDefault();
          awal.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Saat dibuka: bila belum ada fokus di dalam (autoFocus anak), fokus ke jendela; saat ditutup atau dilepas: kembalikan ke pemicu
  useEffect(() => {
    if (!isOpen) return;
    if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
      panelRef.current.focus();
    }
    return () => {
      const pemicu = pemicuRef.current;
      if (pemicu && pemicu.isConnected) pemicu.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-latar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          backgroundColor: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          width: '90%',
          maxWidth: width,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Tutup jendela" className="tombol-ikon">
            <IconTutup />
          </button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
