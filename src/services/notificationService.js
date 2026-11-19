import i18n from '../i18n';

/**
 * FloodConnect Notification & Push Delivery Service (FCM-Ready Stub)
 * ------------------------------------------------------------------
 * STATUS: NOT CONNECTED (Firebase Cloud Messaging / Web Push is NOT active).
 *
 * In-app notifications currently run over:
 * - Supabase Realtime (`public.notifications` postgres_changes) in Live mode
 * - Local browser event channel in Demo Mode (`VITE_DEMO_MODE=true`)
 */

export const FCM_CONFIG = Object.freeze({
  provider: 'Firebase Cloud Messaging (FCM)',
  connected: false,
  statusLabel: 'Not Connected',
  vapidKeyPresent: Boolean(import.meta.env.VITE_FCM_VAPID_KEY),
  pushRelayEndpoint: import.meta.env.VITE_PUSH_RELAY_URL || null,
});

export const NOTIFICATION_CATEGORIES = Object.freeze({
  incident_update: {
    label: 'Incident Report',
    i18nKey: 'notifications.categories.report_submitted',
    toneClass: 'bg-teal-50 text-[#0A625C] border-[#13A89E]/40',
  },
  emergency_update: {
    label: 'Emergency Rescue',
    i18nKey: 'notifications.categories.rescue_progress',
    toneClass: 'bg-[#FEF5EC] text-[#9A4D09] border-[#F28C28]/45',
  },
  assignment: {
    label: 'Dispatch Assignment',
    i18nKey: 'notifications.categories.request_assigned',
    toneClass: 'bg-slate-100 text-[#0B2545] border-[#0B2545]/25',
  },
  alert: {
    label: 'Official Alert',
    i18nKey: 'notifications.categories.alert_published',
    toneClass: 'bg-red-50 text-red-800 border-red-600/35',
  },
  approval: {
    label: 'Account / Role',
    i18nKey: 'notifications.categories.task_assigned',
    toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
  },
  info: {
    label: 'System Notice',
    i18nKey: 'notifications.categories.system',
    toneClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
});

export function getNotificationCategoryMeta(type) {
  const entry = NOTIFICATION_CATEGORIES[type] || NOTIFICATION_CATEGORIES.info;
  return {
    ...entry,
    label: i18n.t(entry.i18nKey, { defaultValue: entry.label }),
  };
}

export function getNotificationCategories() {
  return Object.entries(NOTIFICATION_CATEGORIES).map(([key, entry]) => ({
    key,
    label: i18n.t(entry.i18nKey, { defaultValue: entry.label }),
    toneClass: entry.toneClass,
  }));
}

export function getPushNotificationStatus() {
  const browserSupported = typeof window !== 'undefined' && 'Notification' in window;
  const permission = browserSupported ? window.Notification.permission : 'unsupported';

  return {
    connected: false,
    provider: FCM_CONFIG.provider,
    statusLabel: i18n.t('notifications.pushStubTitle'),
    browserSupported,
    browserPermission: permission,
    missingVariable: FCM_CONFIG.vapidKeyPresent ? null : 'VITE_FCM_VAPID_KEY',
    message: i18n.t('notifications.pushStubNotConnected'),
  };
}

export async function requestPushPermission() {
  return {
    ok: false,
    connected: false,
    status: 'not_connected',
    message: i18n.t('notifications.pushStubNotConnected'),
  };
}

export async function registerFcmDeviceToken(_userId) {
  return {
    registered: false,
    connected: false,
    token: null,
    reason: i18n.t('notifications.pushStubNotConnected'),
  };
}

export async function unregisterFcmDeviceToken(_userId) {
  return {
    unregistered: true,
    connected: false,
    reason: i18n.t('notifications.pushStubNotConnected'),
  };
}

export async function sendPushNotificationStub(_payload) {
  return {
    delivered: false,
    connected: false,
    reason: i18n.t('notifications.pushStubNotConnected'),
  };
}
