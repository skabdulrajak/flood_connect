import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { dataService } from '../services/dataService';

/**
 * Live in-app notifications hook backed by Supabase Realtime (or Demo Realtime channel).
 * Automatically syncs unread counts and shows a subtle toast when a new notification arrives.
 */
export function useNotifications({ announceNew = false } = {}) {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seenIdsRef = useRef(new Set());

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setError('');
    try {
      const list = await dataService.getNotifications(user.id);
      list.forEach((n) => seenIdsRef.current.add(n.id));
      setNotifications(list);
    } catch (err) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    seenIdsRef.current = new Set();
    setLoading(true);
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const unsubscribe = dataService.subscribeToNotifications(user.id, (evt) => {
      if (
        announceNew &&
        evt?.eventType === 'INSERT' &&
        evt?.new?.id &&
        !seenIdsRef.current.has(evt.new.id)
      ) {
        seenIdsRef.current.add(evt.new.id);
        showToast({
          title: evt.new.title || t('notifications.defaultTitle'),
          message: evt.new.message || '',
          type: evt.new.type === 'alert' ? 'error' : 'info',
        });
      }
      loadNotifications();
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.id, announceNew, loadNotifications, showToast, t]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const markRead = useCallback(
    async (notificationId) => {
      if (!user?.id) return;
      await dataService.markNotificationRead(user.id, notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    },
    [user?.id]
  );

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    await dataService.markAllNotificationsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: loadNotifications,
    markRead,
    markAllRead,
    realtimeChannelLabel: isDemoMode
      ? t('notifications.realtimeDemo')
      : t('notifications.realtimeActive'),
  };
}
