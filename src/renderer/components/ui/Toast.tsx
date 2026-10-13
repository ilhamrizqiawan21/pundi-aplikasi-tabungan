import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import clsx from 'clsx';
import './ui.css';

export type ToastType = 'ok' | 'warn' | 'danger' | 'info';

export interface ToastItem {
  id: string;
  pesan: string;
  tipe?: ToastType;
}

interface ToastContextValue {
  showToast: (pesan: string, tipe?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((pesan: string, tipe: ToastType = 'ok') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, pesan, tipe }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="ui-toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx('ui-toast', `ui-toast-${t.tipe || 'ok'}`)}
            role={t.tipe === 'danger' ? 'alert' : 'log'}
            onClick={() => dismissToast(t.id)}
          >
            <span>{t.pesan}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast harus digunakan di dalam ToastProvider');
  }
  return context;
}
