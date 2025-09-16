import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'info';
  duration?: number; // ms
};

type ToastContextType = {
  toast: (t: Omit<Toast, 'id'>) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const entry: Toast = { id, duration: 4000, ...t };
    setToasts(prev => [...prev, entry]);
    if (entry.duration && entry.duration > 0) {
      setTimeout(() => remove(id), entry.duration);
    }
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={
                `min-w-[260px] max-w-[360px] rounded-lg border p-3 shadow-lg backdrop-blur-sm ` +
                (t.variant === 'destructive' ? 'bg-rose-500/15 border-rose-500/30 text-rose-100' :
                 t.variant === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100' :
                 t.variant === 'info' ? 'bg-blue-500/15 border-blue-500/30 text-blue-100' :
                 'bg-slate-800/70 border-slate-600 text-slate-100')
              }
            >
              {t.title && <div className="font-semibold mb-1">{t.title}</div>}
              {t.description && <div className="text-sm opacity-90">{t.description}</div>}
              <button className="mt-2 text-xs underline opacity-80" onClick={() => remove(t.id)}>Close</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
