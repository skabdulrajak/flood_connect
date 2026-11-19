import { registerSW } from 'virtual:pwa-register';

let updateServiceWorkerFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function initFloodConnectServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    updateServiceWorkerFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent('fc-sw-need-refresh'));
      },
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent('fc-sw-offline-ready'));
      },
      onRegisteredSW(_swUrl, registration) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetch('/api/emergency-snapshot', { cache: 'no-store' }).catch(() => {});
        }
        if (registration) {
          // Periodically check for updated Workbox service worker precache bundles
          window.setInterval(() => {
            if (navigator.onLine) {
              registration.update().catch(() => {});
            }
          }, 60 * 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.warn('FloodConnect service worker registration skipped:', error);
      },
    });
  } catch (err) {
    console.warn('FloodConnect service worker unavailable in this context:', err);
  }
}

export async function applyPendingServiceWorkerUpdate() {
  if (updateServiceWorkerFn) {
    await updateServiceWorkerFn(true);
  } else {
    window.location.reload();
  }
}
