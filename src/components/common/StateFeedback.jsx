import { useTranslation } from 'react-i18next';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';

export function LoadingState({ message }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-[#13A89E]" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-slate-700">{message || t('common.loading')}</p>
    </div>
  );
}

export function EmptyState({ title, description, actionLabel, onAction, icon: CustomIcon }) {
  const IconComp = CustomIcon || Inbox;
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
      <div className="rounded-lg bg-[#F4F6F8] p-3 text-[#0B2545]">
        <IconComp className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#0B2545]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors shrink-0"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/60 px-6 py-10 text-center"
    >
      <AlertCircle className="h-7 w-7 text-red-700" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold text-red-900">
        {title || t('errors.genericTitle')}
      </h3>
      <p className="mt-1 max-w-md text-sm text-red-800">{message || t('errors.loadFailed')}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t('common.retry')}</span>
        </button>
      ) : null}
    </div>
  );
}
