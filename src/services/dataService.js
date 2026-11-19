import { envConfig } from '../utils/envConfig';
import { demoDataLayer } from './demoDataLayer';
import { supabaseDataLayer } from './supabaseDataLayer';
import { firebaseDataLayer } from './firebaseDataLayer';
import { sanitizePayloadStrings, sanitizeText, validateImageFile } from '../utils/validation';
import { offlineEmergencyCache } from '../utils/offlineEmergencyCache';
import { offlineIncidentQueue } from '../utils/offlineIncidentQueue';

const CHAT_STORAGE_PREFIX = 'floodconnect_chat_history_';

function isNetworkFailureError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    code.includes('unavailable') ||
    code.includes('network-request-failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('timeout')
  );
}

async function withOfflineCache(bucketKey, fetcher, fallbackValue = []) {
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (isOffline) {
    const cached = await offlineEmergencyCache.readBucket(bucketKey, null);
    if (cached !== null) {
      return cached;
    }
    try {
      const localResult = await fetcher();
      offlineEmergencyCache.saveBucket(bucketKey, localResult).catch(() => {});
      return localResult;
    } catch {
      return fallbackValue;
    }
  }

  try {
    const fresh = await fetcher();
    offlineEmergencyCache.saveBucket(bucketKey, fresh).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await offlineEmergencyCache.readBucket(bucketKey, null);
    if (cached !== null) {
      return cached;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return fallbackValue;
    }
    throw err;
  }
}

function getFallbackLayer() {
  return envConfig.isDemoMode ? demoDataLayer : supabaseDataLayer;
}

/**
 * Dynamic FloodConnect Data Access Layer.
 * - Whenever a user signs in with Firebase Google Sign-In, ALL persistence,
 *   queries, real-time notifications, and chat history run live on Cloud Firestore.
 * - Otherwise transparently uses Supabase (if configured) or Demo Mode for
 *   local role testing without losing any existing functionality.
 */
function getActiveLayer() {
  if (firebaseDataLayer.isFirebaseAuthenticated()) {
    return firebaseDataLayer;
  }
  return getFallbackLayer();
}

export const dataService = {
  getMode: () => getActiveLayer().mode,
  isDemoMode: () => !firebaseDataLayer.isFirebaseAuthenticated() && envConfig.isDemoMode,
  isFirebaseMode: () => firebaseDataLayer.isFirebaseAuthenticated(),

  // Auth & Profile
  signInWithGoogle: async () => {
    // Clear any lingering demo session so Firebase session takes full priority
    try {
      await demoDataLayer.signOut();
    } catch {
      // ignore
    }
    return firebaseDataLayer.signInWithGoogle();
  },

  getSession: async () => {
    if (firebaseDataLayer.isFirebaseAuthenticated()) {
      return firebaseDataLayer.getSession();
    }
    return getFallbackLayer().getSession();
  },

  onAuthStateChange: (cb) => {
    const unsubFirebase = firebaseDataLayer.onAuthStateChange((fbState) => {
      if (fbState.session && fbState.user) {
        cb(fbState);
      } else {
        // Fall back to demo/supabase session if user signed out of Firebase or isn't using Firebase
        getFallbackLayer()
          .getSession()
          .then((fallbackSession) => {
            cb(fallbackSession);
          })
          .catch(() => {
            cb({ session: null, user: null, profile: null });
          });
      }
    });
    const unsubFallback = getFallbackLayer().onAuthStateChange((state) => {
      if (!firebaseDataLayer.isFirebaseAuthenticated()) {
        cb(state);
      }
    });
    return () => {
      if (typeof unsubFirebase === 'function') unsubFirebase();
      if (typeof unsubFallback === 'function') unsubFallback();
    };
  },

  signIn: (credentials) => getFallbackLayer().signIn(credentials),
  signUp: (registrationData) => getFallbackLayer().signUp(sanitizePayloadStrings(registrationData)),
  resendConfirmationEmail: (email) => getFallbackLayer().resendConfirmationEmail(email),
  signOut: async () => {
    await Promise.allSettled([
      firebaseDataLayer.signOut(),
      getFallbackLayer().signOut(),
      offlineEmergencyCache.clearUserScopedBuckets(),
    ]);
  },
  requestPasswordReset: (email) => getFallbackLayer().requestPasswordReset(email),
  resetPassword: (payload) => getFallbackLayer().resetPassword(payload),
  updateProfile: (userId, updates) =>
    getActiveLayer().updateProfile(userId, sanitizePayloadStrings(updates)),

  // Stage 2: Citizen, Map, Emergency Requests, Shelters, Alerts, Notifications
  uploadIncidentPhoto: async (userId, file) => {
    const check = validateImageFile(file);
    if (!check.valid) {
      throw new Error(check.error);
    }
    return getActiveLayer().uploadIncidentPhoto(userId, file);
  },
  createIncidentDirect: (userId, payload) =>
    getActiveLayer().createIncident(userId, sanitizePayloadStrings(payload)),
  createIncident: async (userId, payload, options = {}) => {
    const cleanPayload = sanitizePayloadStrings(payload);
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

    if (isOffline) {
      const queued = await offlineIncidentQueue.enqueueFloodReport({
        userId,
        dataMode: getActiveLayer().mode,
        payload: cleanPayload,
        photoFile: options?.photoFile || null,
      });
      return offlineIncidentQueue.toDisplayIncident(queued);
    }

    try {
      return await getActiveLayer().createIncident(userId, cleanPayload);
    } catch (err) {
      if (isNetworkFailureError(err)) {
        const queued = await offlineIncidentQueue.enqueueFloodReport({
          userId,
          dataMode: getActiveLayer().mode,
          payload: cleanPayload,
          photoFile: options?.photoFile || null,
        });
        return offlineIncidentQueue.toDisplayIncident(queued);
      }
      throw err;
    }
  },
  getMyIncidents: async (userId) => {
    const [persisted, queued] = await Promise.all([
      withOfflineCache(
        `user_myIncidents_${userId || 'anon'}`,
        () => getActiveLayer().getMyIncidents(userId),
        []
      ),
      offlineIncidentQueue.getPendingFloodReports(userId),
    ]);
    const queuedDisplay = queued.map((item) => offlineIncidentQueue.toDisplayIncident(item));
    return [...queuedDisplay, ...(Array.isArray(persisted) ? persisted : [])];
  },
  getMapIncidents: (params) =>
    withOfflineCache('mapIncidents', () => getActiveLayer().getMapIncidents(params), []),
  createEmergencyRequest: (userId, payload) =>
    getActiveLayer().createEmergencyRequest(userId, sanitizePayloadStrings(payload)),
  getMyEmergencyRequests: (userId) =>
    withOfflineCache(
      `user_myRequests_${userId || 'anon'}`,
      () => getActiveLayer().getMyEmergencyRequests(userId),
      []
    ),
  cancelEmergencyRequest: (userId, requestId) =>
    getActiveLayer().cancelEmergencyRequest(userId, requestId),
  getShelters: () => withOfflineCache('shelters', () => getActiveLayer().getShelters(), []),
  getActiveAlerts: () =>
    withOfflineCache('activeAlerts', () => getActiveLayer().getActiveAlerts(), []),
  getNotifications: (userId) => getActiveLayer().getNotifications(userId),
  markNotificationRead: (userId, notificationId) =>
    getActiveLayer().markNotificationRead(userId, notificationId),
  markAllNotificationsRead: (userId) => getActiveLayer().markAllNotificationsRead(userId),

  // Stage 3: Admin Command Portal
  getAdminDashboardStats: () => getActiveLayer().getAdminDashboardStats(),
  getAllIncidents: () => getActiveLayer().getAllIncidents(),
  updateIncidentAdmin: (adminUserId, incidentId, updates, reasonNote) =>
    getActiveLayer().updateIncidentAdmin(
      adminUserId,
      incidentId,
      sanitizePayloadStrings(updates),
      sanitizeText(reasonNote, { maxLength: 600 })
    ),
  getIncidentVerificationHistory: () => getActiveLayer().getIncidentVerificationHistory(),
  getAllEmergencyRequests: () => getActiveLayer().getAllEmergencyRequests(),
  updateEmergencyRequestAdmin: (adminUserId, requestId, updates, note) =>
    getActiveLayer().updateEmergencyRequestAdmin(
      adminUserId,
      requestId,
      sanitizePayloadStrings(updates),
      sanitizeText(note, { maxLength: 600 })
    ),
  getRescueStatusHistory: (requestId) => getActiveLayer().getRescueStatusHistory(requestId),
  getRescueTeams: () => getActiveLayer().getRescueTeams(),
  createRescueTeam: (payload) => getActiveLayer().createRescueTeam(sanitizePayloadStrings(payload)),
  updateRescueTeam: (teamId, updates) =>
    getActiveLayer().updateRescueTeam(teamId, sanitizePayloadStrings(updates)),
  getVolunteers: () => getActiveLayer().getVolunteers(),
  reviewVolunteerApplication: (adminUserId, volunteerId, decision) =>
    getActiveLayer().reviewVolunteerApplication(adminUserId, volunteerId, decision),
  getVolunteerTasks: () => getActiveLayer().getVolunteerTasks(),
  createVolunteerTask: (adminUserId, payload) =>
    getActiveLayer().createVolunteerTask(adminUserId, sanitizePayloadStrings(payload)),
  getAllAlerts: () => getActiveLayer().getAllAlerts(),
  createAlert: (adminUserId, payload) =>
    getActiveLayer().createAlert(adminUserId, sanitizePayloadStrings(payload)),
  updateAlert: (alertId, updates) =>
    getActiveLayer().updateAlert(alertId, sanitizePayloadStrings(updates)),
  createShelter: (adminUserId, payload) =>
    getActiveLayer().createShelter(adminUserId, sanitizePayloadStrings(payload)),
  updateShelter: (adminUserId, shelterId, updates) =>
    getActiveLayer().updateShelter(adminUserId, shelterId, sanitizePayloadStrings(updates)),
  deleteShelter: (shelterId) => getActiveLayer().deleteShelter(shelterId),
  getAllUsers: () => getActiveLayer().getAllUsers(),
  updateUserRole: (adminUserId, targetUserId, nextRole) =>
    getActiveLayer().updateUserRole(adminUserId, targetUserId, nextRole),

  // Stage 3: Rescue Team Portal
  getMyRescueTeams: (rescueUserId) => getActiveLayer().getMyRescueTeams(rescueUserId),
  getAssignedEmergencyRequests: (rescueUserId) =>
    getActiveLayer().getAssignedEmergencyRequests(rescueUserId),
  updateRescueProgress: (rescueUserId, requestId, payload) =>
    getActiveLayer().updateRescueProgress(rescueUserId, requestId, sanitizePayloadStrings(payload)),
  getMyRescueHistory: (rescueUserId) => getActiveLayer().getMyRescueHistory(rescueUserId),

  // Stage 3: Volunteer Portal
  getMyVolunteerRecord: (userId) => getActiveLayer().getMyVolunteerRecord(userId),
  updateVolunteerAvailability: (userId, availabilityStatus) =>
    getActiveLayer().updateVolunteerAvailability(userId, availabilityStatus),
  getVolunteerTasksForUser: (userId) => getActiveLayer().getVolunteerTasksForUser(userId),
  respondToVolunteerTask: (userId, taskId, action, progressNote) =>
    getActiveLayer().respondToVolunteerTask(
      userId,
      taskId,
      action,
      sanitizeText(progressNote, { maxLength: 600 })
    ),

  // Stage 4: Realtime Notifications, Admin Analytics & Official Information
  subscribeToNotifications: (userId, callback) =>
    getActiveLayer().subscribeToNotifications(userId, callback),
  getAdminAnalytics: () => getActiveLayer().getAdminAnalytics(),
  getOfficialInformation: (options) =>
    withOfflineCache(
      'officialInfo',
      () => getActiveLayer().getOfficialInformation(options),
      { entries: [], liveUnavailable: true, fetchedAt: null }
    ),
  createOfficialInfo: (adminUserId, payload) =>
    getActiveLayer().createOfficialInfo(adminUserId, sanitizePayloadStrings(payload)),
  updateOfficialInfo: (entryId, updates) =>
    getActiveLayer().updateOfficialInfo(entryId, sanitizePayloadStrings(updates)),
  deleteOfficialInfo: (entryId) => getActiveLayer().deleteOfficialInfo(entryId),

  // Public Summary & Coordination Inquiry
  getPublicSummary: () =>
    withOfflineCache('publicSummary', () => getActiveLayer().getPublicSummary(), null),
  submitContactInquiry: (payload) =>
    getActiveLayer().submitContactInquiry(sanitizePayloadStrings(payload)),
  getDemoAccountsList: () => demoDataLayer.getDemoAccountsList(),

  // Per-User Multi-Turn Gemini Assistant Chat History
  getChatMessages: async (userId) => {
    if (!userId) return [];
    if (firebaseDataLayer.isFirebaseAuthenticated()) {
      return firebaseDataLayer.getChatMessages(userId);
    }
    try {
      const raw = window.localStorage.getItem(`${CHAT_STORAGE_PREFIX}${userId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveChatMessage: async (userId, message) => {
    if (!userId) return null;
    if (firebaseDataLayer.isFirebaseAuthenticated()) {
      return firebaseDataLayer.saveChatMessage(userId, message);
    }
    const entry = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: message.role === 'model' ? 'model' : 'user',
      text: String(message.text || '').slice(0, 8000),
      model: String(message.model || ''),
      created_at: new Date().toISOString(),
    };
    try {
      const existing = await dataService.getChatMessages(userId);
      const next = [...existing, entry].slice(-80);
      window.localStorage.setItem(`${CHAT_STORAGE_PREFIX}${userId}`, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
    return entry;
  },

  clearChatMessages: async (userId) => {
    if (!userId) return true;
    if (firebaseDataLayer.isFirebaseAuthenticated()) {
      return firebaseDataLayer.clearChatMessages(userId);
    }
    try {
      window.localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${userId}`);
    } catch {
      // ignore
    }
    return true;
  },
};
