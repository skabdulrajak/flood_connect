/**
 * FloodConnect Offline Emergency Data Cache
 * Stores non-PII emergency datasets (shelters, active alerts, map incidents,
 * official hydro/weather updates, public summary) and user-scoped reads in
 * both Cache Storage API (alongside Workbox precaches) and localStorage so
 * citizens and responders can access essential emergency reference data even
 * when completely offline.
 */

const CACHE_NAME = 'floodconnect-emergency-data-v1';
const LS_KEY = 'floodconnect_offline_emergency_v1';
const CACHE_EVENT = 'fc-offline-cache-updated';

const EMERGENCY_HELPLINES = Object.freeze([
  { number: '112', labelKey: 'pwa.helplineEmergency', fallback: 'National Emergency' },
  { number: '108', labelKey: 'pwa.helplineAmbulance', fallback: 'Ambulance' },
  { number: '101', labelKey: 'pwa.helplineFire', fallback: 'Fire & Rescue' },
  { number: '1077', labelKey: 'pwa.helplineControlRoom', fallback: 'District Emergency Control Room' },
]);

function readMirror() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { buckets: {}, lastSyncedAt: null };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? { buckets: parsed.buckets || {}, lastSyncedAt: parsed.lastSyncedAt || null }
      : { buckets: {}, lastSyncedAt: null };
  } catch {
    return { buckets: {}, lastSyncedAt: null };
  }
}

function writeMirror(state) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

async function putInCacheStorage(bucketKey, payload) {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    const reqUrl = `${window.location.origin}/__offline_cache__/${encodeURIComponent(bucketKey)}.json`;
    const response = new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'X-FloodConnect-Cached-At': payload.updatedAt,
      },
    });
    await cache.put(reqUrl, response);
  } catch {
    // Cache Storage unavailable (e.g., private browsing restriction)
  }
}

async function readFromCacheStorage(bucketKey) {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    const reqUrl = `${window.location.origin}/__offline_cache__/${encodeURIComponent(bucketKey)}.json`;
    const match = await cache.match(reqUrl);
    if (!match) return null;
    return await match.json();
  } catch {
    return null;
  }
}

export const offlineEmergencyCache = {
  CACHE_NAME,
  CACHE_EVENT,
  EMERGENCY_HELPLINES,

  async saveBucket(bucketKey, data) {
    const updatedAt = new Date().toISOString();
    const entry = { data, updatedAt };

    const mirror = readMirror();
    mirror.buckets[bucketKey] = entry;
    mirror.lastSyncedAt = updatedAt;
    writeMirror(mirror);

    await putInCacheStorage(bucketKey, entry);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CACHE_EVENT, { detail: { bucketKey, updatedAt } }));
    }
    return data;
  },

  async readBucket(bucketKey, fallbackValue = []) {
    const fromCacheApi = await readFromCacheStorage(bucketKey);
    if (fromCacheApi && fromCacheApi.data !== undefined) {
      return fromCacheApi.data;
    }
    const mirror = readMirror();
    if (mirror.buckets[bucketKey] && mirror.buckets[bucketKey].data !== undefined) {
      return mirror.buckets[bucketKey].data;
    }
    return fallbackValue;
  },

  getSnapshotSync() {
    const mirror = readMirror();
    return {
      shelters: Array.isArray(mirror.buckets.shelters?.data) ? mirror.buckets.shelters.data : [],
      activeAlerts: Array.isArray(mirror.buckets.activeAlerts?.data)
        ? mirror.buckets.activeAlerts.data
        : [],
      mapIncidents: Array.isArray(mirror.buckets.mapIncidents?.data)
        ? mirror.buckets.mapIncidents.data
        : [],
      officialInfo: Array.isArray(mirror.buckets.officialInfo?.data)
        ? mirror.buckets.officialInfo.data
        : [],
      lastSyncedAt: mirror.lastSyncedAt || null,
      helplines: EMERGENCY_HELPLINES,
    };
  },

  async clearUserScopedBuckets() {
    const mirror = readMirror();
    const removedKeys = [];
    for (const key of Object.keys(mirror.buckets)) {
      if (key.startsWith('user_')) {
        delete mirror.buckets[key];
        removedKeys.push(key);
      }
    }
    writeMirror(mirror);

    if (typeof window !== 'undefined' && 'caches' in window && removedKeys.length > 0) {
      try {
        const cache = await window.caches.open(CACHE_NAME);
        await Promise.all(
          removedKeys.map((k) =>
            cache.delete(`${window.location.origin}/__offline_cache__/${encodeURIComponent(k)}.json`)
          )
        );
      } catch {
        // ignore
      }
    }
  },
};
