import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-700 hover:bg-red-800 text-white'
      : 'bg-[#0B2545] hover:bg-[#13315C] text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2545]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {tone === 'danger' ? (
              <div className="mt-0.5 rounded-md bg-red-50 p-2 text-red-700 shrink-0">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
            ) : null}
            <div>
              <h3 id="confirm-dialog-title" className="text-base font-bold text-[#0B2545]">
                {title}
              </h3>
              <p
                id="confirm-dialog-description"
                className="mt-1.5 text-sm leading-relaxed text-slate-600"
              >
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={t('common.close')}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[40px] rounded-md px-4 py-2 text-sm font-semibold transition-colors shrink-0 disabled:opacity-60 ${confirmClasses}`}
          >
            {busy ? t('common.saving') : confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
