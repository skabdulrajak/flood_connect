import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'light' | 'dark';
}

export function PWAInstallButton({ variant = 'light' }: PWAInstallButtonProps) {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const buttonClasses =
    variant === 'dark'
      ? 'inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap shrink-0'
      : 'inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#0B2545]/25 bg-[#0B2545] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C] transition-colors whitespace-nowrap shrink-0';

  if (isInstallable) {
    return (
      <button type="button" onClick={install} className={buttonClasses}>
        <Download className="h-3.5 w-3.5 text-[#13A89E]" aria-hidden="true" />
        <span>{t('pwa.installApp', { defaultValue: 'Install App' })}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={buttonClasses}
        >
          <Share className="h-3.5 w-3.5 text-[#13A89E]" aria-hidden="true" />
          <span>{t('pwa.installIOS', { defaultValue: 'Install on iOS' })}</span>
        </button>

        {showIOSGuide ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2545]/60 p-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-[#0B2545] shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <h3 id="ios-install-title" className="font-display text-base font-bold">
                  {t('pwa.iosGuideTitle', { defaultValue: 'Install FloodConnect on iPhone / iPad' })}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={t('common.close', { defaultValue: 'Close' })}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                <li>
                  {t('pwa.iosStep1', {
                    defaultValue: 'Tap the Share button in your Safari toolbar.',
                  })}
                </li>
                <li>
                  {t('pwa.iosStep2', {
                    defaultValue: 'Scroll down and tap "Add to Home Screen".',
                  })}
                </li>
                <li>
                  {t('pwa.iosStep3', {
                    defaultValue: 'Open FloodConnect from your Home Screen for offline emergency access.',
                  })}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#0B2545] py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
              >
                {t('common.close', { defaultValue: 'Close' })}
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return null;
}
