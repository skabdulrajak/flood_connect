import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { getNotificationCategoryMeta } from '../../services/notificationService';
import { formatNumber, formatTimestamp } from '../../utils/constants';

export function NotificationBellMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications({
    announceNew: true,
  });

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const previewItems = notifications.slice(0, 6);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${t('notifications.bellAriaLabel')} (${t('notifications.unreadCount', { count: unreadCount })})`}
        aria-expanded={open}
        className="relative inline-flex items-center justify-center rounded-md border border-slate-200 bg-[#F4F6F8] p-2 text-[#0B2545] hover:bg-slate-200/70 transition-colors"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded bg-[#F28C28] px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-[#0B2545] tabular-nums">
            {unreadCount > 99 ? '99+' : formatNumber(unreadCount)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="region"
          aria-label={t('dashboard.recentNotifications')}
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-slate-200 bg-white shadow-xl z-40 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#F4F6F8] px-4 py-3">
            <div>
              <p className="text-xs font-bold text-[#0B2545]">{t('notifications.pageTitle')}</p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {t('notifications.unreadCount', { count: unreadCount })} · {formatNumber(notifications.length)}{' '}
                {t('common.total')}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E857D] hover:underline shrink-0"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>{t('notifications.markAllRead')}</span>
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {previewItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">
                {t('notifications.emptySubtitle')}
              </p>
            ) : (
              previewItems.map((item) => {
                const cat = getNotificationCategoryMeta(item.type);
                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 transition-colors ${
                      item.is_read ? 'bg-white' : 'bg-[#F4F6F8]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cat.toneClass}`}
                      >
                        {cat.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {formatTimestamp(item.created_at)}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-xs ${
                        item.is_read ? 'font-medium text-slate-700' : 'font-bold text-[#0B2545]'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{item.message}</p>
                    {!item.is_read ? (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        className="mt-1.5 text-[11px] font-semibold text-[#0E857D] hover:underline"
                      >
                        {t('notifications.markRead')}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-2.5">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between text-xs font-semibold text-[#0B2545] hover:text-[#13A89E]"
            >
              <span>{t('notifications.openCentre')}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
