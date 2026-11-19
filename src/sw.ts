import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

interface PrecacheEntryLike {
  url: string;
  revision?: string | null;
}

interface SWClientLike {
  postMessage(message: unknown): void;
}

interface SWExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface SWSyncEventLike extends SWExtendableEventLike {
  tag: string;
}

interface SWMessageEventLike extends Event {
  data?: {
    type?: string;
    tag?: string;
  };
}

interface SWGlobalScopeLike {
  __WB_MANIFEST: Array<PrecacheEntryLike | string>;
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    matchAll(options?: { type?: string; includeUncontrolled?: boolean }): Promise<SWClientLike[]>;
  };
  addEventListener(type: 'activate', listener: (event: SWExtendableEventLike) => void): void;
  addEventListener(type: 'sync', listener: (event: SWSyncEventLike) => void): void;
  addEventListener(type: 'message', listener: (event: SWMessageEventLike) => void): void;
  indexedDB: IDBFactory;
}

const sw = self as unknown as SWGlobalScopeLike;

const OFFLINE_INCIDENT_DB_NAME = 'floodconnect-offline-db';
const OFFLINE_INCIDENT_DB_VERSION = 1;
const OFFLINE_INCIDENT_STORE = 'pending_flood_reports';
const FLOOD_REPORT_SYNC_TAG = 'floodconnect-flood-reports-sync';

// 1. Precache all Vite-built static assets injected by vite-plugin-pwa
cleanupOutdatedCaches();
precacheAndRoute((self as unknown as SWGlobalScopeLike).__WB_MANIFEST);

// Activate immediately and take control of open tabs
sw.skipWaiting();
sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

// 2. SPA Navigation Fallback (excluding /api/* backend routes)
const navHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    denylist: [/^\/api\//],
  })
);

// 3. Runtime Caching: Google Fonts (English, Hindi Devanagari, Telugu)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 15,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

// 4. Runtime Caching: Emergency Snapshot & Health API (NetworkFirst)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/emergency-snapshot') || url.pathname === '/api/health',
  new NetworkFirst({
    cacheName: 'floodconnect-emergency-api-cache',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);

// 5. Runtime Caching: Cloud Firestore GET Reads (NetworkFirst)
registerRoute(
  ({ url }) => url.origin === 'https://firestore.googleapis.com',
  new NetworkFirst({
    cacheName: 'floodconnect-firestore-read-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
  'GET'
);

// 6. Runtime Caching: Static Images & Icons (StaleWhileRevalidate)
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' || /\.(?:png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'floodconnect-static-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  })
);

// 7. Workbox Background Sync Plugin for Offline Report Relay Endpoint
const reportsBackgroundSyncPlugin = new BackgroundSyncPlugin('floodconnect-reports-api-queue', {
  maxRetentionTime: 24 * 60, // Retry failed requests for up to 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
      } catch (err) {
        await queue.unshiftRequest(entry);
        throw err;
      }
    }
    // Also prompt any open FloodConnect client windows to drain their IndexedDB outbox
    await notifyClientsToFlushOutbox();
  },
});

registerRoute(
  ({ url }) => url.pathname === '/api/offline-reports/relay',
  new NetworkOnly({
    plugins: [reportsBackgroundSyncPlugin],
  }),
  'POST'
);

// Helper: Count pending flood reports directly in IndexedDB from inside the Service Worker
async function countPendingIndexedDBReports(): Promise<number> {
  if (!sw.indexedDB) return 0;
  return new Promise((resolve) => {
    try {
      const req = sw.indexedDB.open(OFFLINE_INCIDENT_DB_NAME, OFFLINE_INCIDENT_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_INCIDENT_STORE)) {
          db.createObjectStore(OFFLINE_INCIDENT_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(OFFLINE_INCIDENT_STORE, 'readonly');
          const countReq = tx.objectStore(OFFLINE_INCIDENT_STORE).count();
          countReq.onsuccess = () => {
            db.close();
            resolve(Number(countReq.result) || 0);
          };
          countReq.onerror = () => {
            db.close();
            resolve(0);
          };
        } catch {
          db.close();
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

async function notifyClientsToFlushOutbox(): Promise<void> {
  const pendingCount = await countPendingIndexedDBReports();
  if (pendingCount === 0) return;

  const clientList = await sw.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of clientList) {
    client.postMessage({
      type: 'FC_TRIGGER_BACKGROUND_SYNC',
      tag: FLOOD_REPORT_SYNC_TAG,
      pendingCount,
    });
  }
}

// 8. Native Service Worker Background Sync Event Listener
sw.addEventListener('sync', (event) => {
  if (event.tag === FLOOD_REPORT_SYNC_TAG) {
    event.waitUntil(notifyClientsToFlushOutbox());
  }
});

// 9. Client Message Handling (Skip Waiting & Manual Sync Relay)
sw.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  } else if (data.type === 'FC_REQUEST_BG_SYNC') {
    notifyClientsToFlushOutbox().catch(() => {});
  }
});
