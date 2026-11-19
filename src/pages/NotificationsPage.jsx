import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BellOff,
  CheckCheck,
  Info,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DemoDataBadge } from '../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateFeedback';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useToast } from '../hooks/useToast';
import {
  getNotificationCategories,
  getNotificationCategoryMeta,
  getPushNotificationStatus,
  requestPushPermission,
} from '../services/notificationService';
import { getNavItemsForRole } from '../utils/dashboardNav';
import { formatNumber, formatTimestamp } from '../utils/constants';

export function NotificationsPage() {
  const { t } = useTranslation();
  const { role, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const navItems = getNavItemsForRole(role);

  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    realtimeChannelLabel,
  } = useNotifications({ announceNew: false });

  const [readFilter, setReadFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [pushFeedback, setPushFeedback] = useState('');

  const pushStatus = getPushNotificationStatus();
  const notificationCategories = getNotificationCategories();

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (readFilter === 'unread' && n.is_read) return false;
      if (readFilter === 'read' && !n.is_read) return false;
      if (categoryFilter !== 'all' && n.type !== categoryFilter) return false;
      return true;
    });
  }, [notifications, readFilter, categoryFilter]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    showToast(t('notifications.allMarkedReadToast'), 'info');
  };

  const handleTestFcmStub = async () => {
    const res = await requestPushPermission();
    setPushFeedback(res.message);
    showToast(res.message, 'info');
  };

  return (
    <DashboardLayout navItems={navItems} pageTitle={t('notifications.pageTitle')}>
      <div className="space-y-6">
        {/* Header & Controls */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0E857D]">
                {realtimeChannelLabel}
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
                {t('notifications.pageTitle')} ({t('notifications.unreadCount', { count: formatNumber(unreadCount) })})
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t('notifications.pageSubtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isDemoMode ? <DemoDataBadge compact /> : null}
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t('common.refresh')}</span>
              </button>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C]"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>{t('notifications.markAllRead')}</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-[#F4F6F8] p-1">
              {[
                { id: 'all', label: `${t('notifications.filterAll')} (${formatNumber(notifications.length)})` },
                { id: 'unread', label: `${t('notifications.filterUnread')} (${formatNumber(unreadCount)})` },
                {
                  id: 'read',
                  label: `${t('notifications.filterRead')} (${formatNumber(notifications.length - unreadCount)})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReadFilter(tab.id)}
                  className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                    readFilter === tab.id
                      ? 'bg-[#0B2545] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label={t('notifications.filterByCategory')}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
            >
              <option value="all">{t('notifications.allCategories')}</option>
              {Object.entries(notificationCategories).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* FCM-Ready Push Notification Stub Card */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-slate-100 p-2 text-slate-600">
                <BellOff className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-[#0B2545]">
                    {t('notifications.pushStubTitle')}
                  </h3>
                  <span className="rounded border border-amber-500/40 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                    {t('notifications.notConnectedBadge')}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {pushStatus.message}
                  {pushStatus.missingVariable
                    ? ` ${t('demo.missingEnvPrefix')} ${pushStatus.missingVariable}.`
                    : ''}
                </p>
                {pushFeedback ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#0B2545]">
                    <Info className="h-3.5 w-3.5 shrink-0 text-[#13A89E]" />
                    <span>{pushFeedback}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestFcmStub}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
            >
              <Radio className="h-3.5 w-3.5 text-slate-500" />
              <span>{t('notifications.pushEnableButton')}</span>
            </button>
          </div>
        </section>

        {/* Notifications List */}
        {loading ? (
          <LoadingState message={t('common.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('notifications.emptyTitle')}
            description={t('notifications.emptySubtitle')}
            actionLabel={
              readFilter !== 'all' || categoryFilter !== 'all' ? t('common.clearFilters') : undefined
            }
            onAction={
              readFilter !== 'all' || categoryFilter !== 'all'
                ? () => {
                    setReadFilter('all');
                    setCategoryFilter('all');
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const cat = getNotificationCategoryMeta(notif.type);
              return (
                <article
                  key={notif.id}
                  className={`rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between transition-colors ${
                    notif.is_read
                      ? 'border-slate-200 bg-white'
                      : 'border-[#0B2545]/30 bg-[#F4F6F8]'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${cat.toneClass}`}
                      >
                        {cat.label}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          notif.is_read
                            ? 'border-slate-200 bg-slate-50 text-slate-500'
                            : 'border-[#F28C28]/45 bg-[#FEF5EC] text-[#9A4D09]'
                        }`}
                      >
                        {notif.is_read ? t('notifications.filterRead') : t('notifications.filterUnread')}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {formatTimestamp(notif.created_at)}
                      </span>
                    </div>
                    <h3
                      className={`text-sm ${
                        notif.is_read ? 'font-semibold text-slate-800' : 'font-bold text-[#0B2545]'
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-600">{notif.message}</p>
                  </div>

                  <div className="shrink-0">
                    {!notif.is_read ? (
                      <button
                        type="button"
                        onClick={() => markRead(notif.id)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-slate-50"
                      >
                        {t('notifications.markRead')}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">{t('notifications.acknowledged')}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
