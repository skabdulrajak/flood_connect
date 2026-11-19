import { createContext, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export const ToastContext = createContext(null);

const TONE_STYLES = {
  success: {
    container: 'bg-white border-emerald-600/30 text-[#0B2545]',
    iconWrap: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  error: {
    container: 'bg-white border-red-600/30 text-[#0B2545]',
    iconWrap: 'text-red-700',
    Icon: XCircle,
  },
  warning: {
    container: 'bg-white border-[#F28C28]/40 text-[#0B2545]',
    iconWrap: 'text-[#C06310]',
    Icon: AlertTriangle,
  },
  info: {
    container: 'bg-white border-[#13A89E]/40 text-[#0B2545]',
    iconWrap: 'text-[#0E857D]',
    Icon: Info,
  },
};

export function ToastProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((arg, fallbackType = 'info') => {
    const normalized =
      typeof arg === 'string'
        ? { title: arg, message: '', type: fallbackType, duration: 4500 }
        : {
            title: arg?.title || '',
            message: arg?.message || '',
            type: arg?.type || 'info',
            duration: arg?.duration ?? 4500,
          };

    const { title, message, type, duration } = normalized;
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, duration);
    }
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0 pointer-events-none"
      >
        {toasts.map((toast) => {
          const style = TONE_STYLES[toast.type] || TONE_STYLES.info;
          const IconComponent = style.Icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3.5 shadow-md transition-opacity duration-150 ${style.container}`}
            >
              <IconComponent className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconWrap}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-[#0B2545]">{toast.title}</p>
                {toast.message ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.message}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label={t('common.dismissNotification')}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#0B2545] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
