import {
  DEMO_ALERTS,
  DEMO_EMERGENCY_REQUESTS,
  DEMO_INCIDENT_HISTORY,
  DEMO_INCIDENTS,
  DEMO_NOTIFICATIONS,
  DEMO_RESCUE_HISTORY,
  DEMO_RESCUE_TEAMS,
  DEMO_SHELTERS,
  DEMO_USERS,
  DEMO_VOLUNTEER_TASKS,
  DEMO_VOLUNTEERS,
} from './demoSeedData';
import { DEFAULT_DISTRICT, ROLES } from '../utils/constants';
import { computeAdminAnalytics } from '../utils/analyticsCalculator';

const NOTIF_EVENT = 'floodconnect:notifications-updated';

const STORAGE_KEYS = {
  USERS: 'floodconnect_demo_users_v3',
  SESSION: 'floodconnect_demo_session_v1',
  RESET_TOKENS: 'floodconnect_demo_reset_tokens_v1',
  CONTACT_LOGS: 'floodconnect_demo_contact_logs_v1',
  INCIDENTS: 'floodconnect_demo_incidents_v3',
  EMERGENCIES: 'floodconnect_demo_emergencies_v3',
  NOTIFICATIONS: 'floodconnect_demo_notifications_v3',
  ALERTS: 'floodconnect_demo_alerts_v3',
  SHELTERS: 'floodconnect_demo_shelters_v3',
  TEAMS: 'floodconnect_demo_teams_v3',
  VOLUNTEERS: 'floodconnect_demo_volunteers_v3',
  VOLUNTEER_TASKS: 'floodconnect_demo_vtasks_v3',
  INCIDENT_HISTORY: 'floodconnect_demo_inc_hist_v3',
  RESCUE_HISTORY: 'floodconnect_demo_res_hist_v3',
  OFFICIAL_INFO: 'floodconnect_demo_official_info_v1',
};

function readStore(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Graceful fallback if storage quota or privacy mode blocks localStorage
  }
}

function getDemoCollection(key, seed) {
  const existing = readStore(key, null);
  if (Array.isArray(existing)) return existing;
  writeStore(key, seed);
  return [...seed];
}

function getDemoUsers() {
  const existing = readStore(STORAGE_KEYS.USERS, null);
  if (Array.isArray(existing) && existing.length > 0) return existing;
  writeStore(STORAGE_KEYS.USERS, DEMO_USERS);
  return [...DEMO_USERS];
}

function saveDemoUsers(users) {
  writeStore(STORAGE_KEYS.USERS, users);
}

function getUserDisplayName(userId) {
  const users = getDemoUsers();
  return users.find((u) => u.id === userId)?.full_name || 'Authorized Operator';
}

function toSafeProfile(user) {
  if (!user) return null;
  const { password: _removed, ...profile } = user;
  return profile;
}

function stripPublicIncidentPII(incident) {
  const { contact_phone: _phone, ...safe } = incident;
  return safe;
}

function generateReadableCode(prefix, existingCodes = []) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;
  const set = new Set(existingCodes);
  let seq = existingCodes.length + 1;
  let candidate = `${prefix}-${datePart}-${String(seq).padStart(4, '0')}`;
  while (set.has(candidate)) {
    seq += 1;
    candidate = `${prefix}-${datePart}-${String(seq).padStart(4, '0')}`;
  }
  return candidate;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

function emitNotificationChange(userId = null, entry = null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(NOTIF_EVENT, {
        detail: { userId, notification: entry },
      })
    );
  }
}

function pushDemoNotification(
  userId,
  { title, message, type = 'info', related_entity_type = null, related_entity_id = null }
) {
  if (!userId) return null;
  const current = getDemoCollection(STORAGE_KEYS.NOTIFICATIONS, DEMO_NOTIFICATIONS);
  const entry = {
    id: `notif-demo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    user_id: userId,
    title,
    message,
    type,
    related_entity_type,
    related_entity_id,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  writeStore(STORAGE_KEYS.NOTIFICATIONS, [entry, ...current]);
  emitNotificationChange(userId, entry);
  return entry;
}

function appendIncidentHistory({
  incident_id,
  incident_code,
  changed_by,
  previous_status,
  new_status,
  previous_priority,
  new_priority,
  notes,
}) {
  const history = getDemoCollection(STORAGE_KEYS.INCIDENT_HISTORY, DEMO_INCIDENT_HISTORY);
  const entry = {
    id: `ih-demo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    incident_id,
    incident_code,
    changed_by,
    changed_by_name: getUserDisplayName(changed_by),
    previous_status,
    new_status,
    previous_priority: previous_priority || null,
    new_priority: new_priority || null,
    notes: notes || '',
    created_at: new Date().toISOString(),
  };
  writeStore(STORAGE_KEYS.INCIDENT_HISTORY, [entry, ...history]);
  return entry;
}

function appendRescueHistory({
  emergency_request_id,
  request_code,
  changed_by,
  previous_status,
  new_status,
  notes,
}) {
  const history = getDemoCollection(STORAGE_KEYS.RESCUE_HISTORY, DEMO_RESCUE_HISTORY);
  const entry = {
    id: `rh-demo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    emergency_request_id,
    request_code,
    changed_by,
    changed_by_name: getUserDisplayName(changed_by),
    previous_status,
    new_status,
    notes: notes || '',
    created_at: new Date().toISOString(),
  };
  writeStore(STORAGE_KEYS.RESCUE_HISTORY, [entry, ...history]);
  return entry;
}

export const demoDataLayer = {
  mode: 'demo',

  async getSession() {
    const session = readStore(STORAGE_KEYS.SESSION, null);
    if (!session?.userId) return { session: null, user: null, profile: null };
    const users = getDemoUsers();
    const found = users.find((u) => u.id === session.userId);
    if (!found) {
      writeStore(STORAGE_KEYS.SESSION, null);
      return { session: null, user: null, profile: null };
    }
    const profile = toSafeProfile(found);
    return {
      session: { ...session, mode: 'demo' },
      user: { id: profile.id, email: profile.email },
      profile,
    };
  },

  onAuthStateChange(_callback) {
    return () => {};
  },

  async signIn({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = getDemoUsers();
    const matched = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!matched || matched.password !== password) {
      const err = new Error('Invalid login credentials');
      err.code = 'invalid_credentials';
      throw err;
    }

    const sessionRecord = {
      userId: matched.id,
      signedInAt: new Date().toISOString(),
      mode: 'demo',
    };
    writeStore(STORAGE_KEYS.SESSION, sessionRecord);
    const profile = toSafeProfile(matched);
    return {
      session: sessionRecord,
      user: { id: profile.id, email: profile.email },
      profile,
    };
  },

  async signUp({
    email,
    password,
    fullName,
    phone,
    preferredLanguage,
    district,
    locality,
    accountType,
  }) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = getDemoUsers();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      const err = new Error('An account with this email address already exists.');
      err.code = 'user_already_exists';
      throw err;
    }
    if (accountType !== 'citizen' && accountType !== 'volunteer') {
      throw new Error('Self-registration is restricted to Citizen or Volunteer accounts.');
    }

    const wantsVolunteer = accountType === 'volunteer';
    const safeLang = ['en', 'hi', 'te'].includes(preferredLanguage) ? preferredLanguage : 'en';
    const newUser = {
      id: `demo-user-${Date.now()}`,
      email: normalizedEmail,
      password,
      full_name: fullName.trim(),
      phone: (phone || '').trim(),
      preferred_language: safeLang,
      district: (district || DEFAULT_DISTRICT).trim(),
      locality: (locality || '').trim(),
      role: ROLES.CITIZEN,
      volunteer_status: wantsVolunteer ? 'pending' : 'none',
      created_at: new Date().toISOString(),
    };

    saveDemoUsers([...users, newUser]);

    if (wantsVolunteer) {
      const volunteers = getDemoCollection(STORAGE_KEYS.VOLUNTEERS, DEMO_VOLUNTEERS);
      writeStore(STORAGE_KEYS.VOLUNTEERS, [
        {
          id: `vol-demo-${Date.now()}`,
          user_id: newUser.id,
          full_name: newUser.full_name,
          email: newUser.email,
          phone: newUser.phone,
          skills: ['Community Support'],
          locality: newUser.locality,
          availability_status: 'offline',
          approval_status: 'pending',
          approved_by: null,
          approved_at: null,
          created_at: newUser.created_at,
        },
        ...volunteers,
      ]);
    }

    const sessionRecord = {
      userId: newUser.id,
      signedInAt: new Date().toISOString(),
      mode: 'demo',
    };
    writeStore(STORAGE_KEYS.SESSION, sessionRecord);
    const profile = toSafeProfile(newUser);
    return {
      session: sessionRecord,
      user: { id: profile.id, email: profile.email },
      profile,
      needsEmailConfirmation: false,
    };
  },

  async resendConfirmationEmail(_email) {
    return { sent: true };
  },

  async signOut() {
    writeStore(STORAGE_KEYS.SESSION, null);
  },

  async requestPasswordReset(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = getDemoUsers();
    const exists = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    const token = `demo-reset-${Math.random().toString(36).slice(2, 10)}`;

    if (exists) {
      const tokens = readStore(STORAGE_KEYS.RESET_TOKENS, {});
      tokens[token] = {
        userId: exists.id,
        email: exists.email,
        expiresAt: Date.now() + 30 * 60 * 1000,
      };
      writeStore(STORAGE_KEYS.RESET_TOKENS, tokens);
    }

    return {
      sent: true,
      demoResetToken: exists ? token : null,
      message:
        'Demo Mode: Password reset link generated locally (no external email sent). Use the link below to complete reset.',
    };
  },

  async resetPassword({ newPassword, token }) {
    const tokens = readStore(STORAGE_KEYS.RESET_TOKENS, {});
    const record = token ? tokens[token] : null;
    const session = readStore(STORAGE_KEYS.SESSION, null);
    const targetUserId = record?.userId || session?.userId;

    if (!targetUserId) {
      throw new Error('Invalid or expired password reset link. Please request a new reset link.');
    }
    if (record && record.expiresAt < Date.now()) {
      throw new Error('This password reset link has expired. Please request a new one.');
    }

    const users = getDemoUsers();
    const idx = users.findIndex((u) => u.id === targetUserId);
    if (idx === -1) throw new Error('Account not found for password reset.');

    users[idx] = { ...users[idx], password: newPassword };
    saveDemoUsers(users);

    if (token && tokens[token]) {
      delete tokens[token];
      writeStore(STORAGE_KEYS.RESET_TOKENS, tokens);
    }
    return { success: true };
  },

  async updateProfile(userId, updates) {
    const users = getDemoUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Profile record not found.');

    const safeLang = ['en', 'hi', 'te'].includes(updates.preferred_language)
      ? updates.preferred_language
      : users[idx].preferred_language || 'en';
    const updatedUser = {
      ...users[idx],
      full_name: updates.full_name?.trim() ?? users[idx].full_name,
      phone: updates.phone?.trim() ?? users[idx].phone,
      preferred_language: safeLang,
      district: updates.district?.trim() || DEFAULT_DISTRICT,
      locality: updates.locality?.trim() ?? users[idx].locality,
      updated_at: new Date().toISOString(),
    };
    users[idx] = updatedUser;
    saveDemoUsers(users);
    return toSafeProfile(updatedUser);
  },

  // =========================================================================
  // STAGE 2: CITIZEN & PUBLIC DATA
  // =========================================================================

  async uploadIncidentPhoto(_userId, file) {
    if (!file) return null;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, or WebP images are supported.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Photo must be 5 MB or smaller.');
    }
    const dataUrl = await fileToDataUrl(file);
    return { url: dataUrl, storageMode: 'demo_local', fileName: file.name };
  },

  async createIncident(userId, payload) {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    const incident_code = generateReadableCode(
      'INC',
      incidents.map((i) => i.incident_code)
    );
    const nowIso = new Date().toISOString();

    const record = {
      id: `inc-demo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      incident_code,
      user_id: userId,
      title: payload.title.trim(),
      description: payload.description.trim(),
      category: payload.category,
      location_text: payload.location_text.trim(),
      locality: payload.locality.trim(),
      district: (payload.district || DEFAULT_DISTRICT).trim(),
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      severity: payload.severity,
      reviewed_priority: null,
      status: 'pending_verification',
      info_origin: 'citizen_submitted',
      contact_phone: (payload.contact_phone || '').trim(),
      photo_urls: Array.isArray(payload.photo_urls) ? payload.photo_urls : [],
      observed_at: payload.observed_at || nowIso,
      verified_by: null,
      verified_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    writeStore(STORAGE_KEYS.INCIDENTS, [record, ...incidents]);
    pushDemoNotification(userId, {
      title: `Incident ${incident_code} Submitted`,
      message: `Your flood report in ${record.locality} is queued for District Admin verification.`,
      type: 'incident_update',
      related_entity_type: 'incident',
      related_entity_id: record.id,
    });
    // Notify District Admins about new pending submission
    getDemoUsers()
      .filter((u) => u.role === ROLES.ADMIN && u.id !== userId)
      .forEach((admin) => {
        pushDemoNotification(admin.id, {
          title: `New Report ${incident_code} Pending Verification`,
          message: `Citizen-submitted ${record.severity.toUpperCase()} report in ${record.locality}: ${record.title}`,
          type: 'incident_update',
          related_entity_type: 'incident',
          related_entity_id: record.id,
        });
      });
    return record;
  },

  async getMyIncidents(userId) {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    return incidents
      .filter((i) => i.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getMapIncidents({ userId = null, role = null } = {}) {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    let visible = [];
    if (role === ROLES.ADMIN) {
      visible = incidents;
    } else if (userId) {
      visible = incidents.filter((i) => i.status === 'verified' || i.user_id === userId);
    } else {
      visible = incidents.filter((i) => i.status === 'verified');
    }
    return visible
      .map((i) => ({
        ...stripPublicIncidentPII(i),
        isOwnReport: Boolean(userId && i.user_id === userId),
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async createEmergencyRequest(userId, payload) {
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    const request_code = generateReadableCode(
      'ER',
      requests.map((r) => r.request_code)
    );
    const nowIso = new Date().toISOString();
    const childrenCount = Math.max(0, Number(payload.children_count || 0));
    const elderlyCount = Math.max(0, Number(payload.elderly_count || 0));

    const record = {
      id: `er-demo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      request_code,
      user_id: userId,
      requester_name: payload.requester_name.trim(),
      contact_phone: payload.contact_phone.trim(),
      people_count: Math.max(1, Number(payload.people_count || 1)),
      children_count: childrenCount,
      elderly_count: elderlyCount,
      vulnerable_count: childrenCount + elderlyCount,
      medical_needs: (payload.medical_needs || '').trim(),
      accessibility_needs: (payload.accessibility_needs || '').trim(),
      description: payload.description.trim(),
      photo_urls: Array.isArray(payload.photo_urls) ? payload.photo_urls : [],
      location_text: payload.location_text.trim(),
      locality: payload.locality.trim(),
      district: (payload.district || DEFAULT_DISTRICT).trim(),
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      severity: payload.severity || 'high',
      reviewed_priority: null,
      status: 'pending',
      info_origin: 'citizen_submitted',
      assigned_team_id: null,
      assigned_team_name: null,
      assignment_status: null,
      responder_notes: '',
      created_at: nowIso,
      updated_at: nowIso,
    };

    writeStore(STORAGE_KEYS.EMERGENCIES, [record, ...requests]);
    pushDemoNotification(userId, {
      title: `Emergency Request ${request_code} Logged`,
      message: `Your assistance request in ${record.locality} is Pending triage. For immediate danger, call 112 / 108 / 101.`,
      type: 'emergency_update',
      related_entity_type: 'emergency_request',
      related_entity_id: record.id,
    });
    return record;
  },

  async getMyEmergencyRequests(userId) {
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    return requests
      .filter((r) => r.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async cancelEmergencyRequest(userId, requestId) {
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    const idx = requests.findIndex((r) => r.id === requestId && r.user_id === userId);
    if (idx === -1) throw new Error('Emergency request not found.');
    const prevStatus = requests[idx].status;
    if (!['pending', 'verified'].includes(prevStatus)) {
      throw new Error('Only pending or verified requests can be cancelled by the requester.');
    }
    const updated = { ...requests[idx], status: 'cancelled', updated_at: new Date().toISOString() };
    requests[idx] = updated;
    writeStore(STORAGE_KEYS.EMERGENCIES, requests);
    appendRescueHistory({
      emergency_request_id: updated.id,
      request_code: updated.request_code,
      changed_by: userId,
      previous_status: prevStatus,
      new_status: 'cancelled',
      notes: 'Cancelled by citizen requester.',
    });
    return updated;
  },

  async getShelters() {
    return getDemoCollection(STORAGE_KEYS.SHELTERS, DEMO_SHELTERS);
  },

  async getActiveAlerts() {
    const alerts = getDemoCollection(STORAGE_KEYS.ALERTS, DEMO_ALERTS);
    const now = Date.now();
    return alerts
      .filter((a) => {
        if (a.is_active === false) return false;
        if (a.expires_at && new Date(a.expires_at).getTime() < now) return false;
        return true;
      })
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  },

  async getNotifications(userId) {
    const all = getDemoCollection(STORAGE_KEYS.NOTIFICATIONS, DEMO_NOTIFICATIONS);
    return all
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async markNotificationRead(userId, notificationId) {
    const all = getDemoCollection(STORAGE_KEYS.NOTIFICATIONS, DEMO_NOTIFICATIONS);
    const next = all.map((n) =>
      n.id === notificationId && n.user_id === userId ? { ...n, is_read: true } : n
    );
    writeStore(STORAGE_KEYS.NOTIFICATIONS, next);
    emitNotificationChange(userId, null);
    return true;
  },

  async markAllNotificationsRead(userId) {
    const all = getDemoCollection(STORAGE_KEYS.NOTIFICATIONS, DEMO_NOTIFICATIONS);
    const next = all.map((n) => (n.user_id === userId ? { ...n, is_read: true } : n));
    writeStore(STORAGE_KEYS.NOTIFICATIONS, next);
    emitNotificationChange(userId, null);
    return true;
  },

  subscribeToNotifications(userId, callback) {
    if (!userId || typeof window === 'undefined') return () => {};
    const onCustom = (evt) => {
      const detail = evt?.detail || {};
      if (!detail.userId || detail.userId === userId) {
        callback({ eventType: detail.notification ? 'INSERT' : 'UPDATE', new: detail.notification || null });
      }
    };
    const onStorage = (evt) => {
      if (evt.key === STORAGE_KEYS.NOTIFICATIONS) {
        callback({ eventType: 'SYNC', new: null });
      }
    };
    window.addEventListener(NOTIF_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(NOTIF_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  },

  // =========================================================================
  // STAGE 3: ADMIN COMMAND OPERATIONS
  // =========================================================================

  async getAdminDashboardStats() {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    const teams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
    const volunteers = getDemoCollection(STORAGE_KEYS.VOLUNTEERS, DEMO_VOLUNTEERS);
    const alerts = await this.getActiveAlerts();
    const shelters = getDemoCollection(STORAGE_KEYS.SHELTERS, DEMO_SHELTERS);

    return {
      totalIncidents: incidents.length,
      pendingIncidents: incidents.filter((i) => i.status === 'pending_verification').length,
      verifiedIncidents: incidents.filter((i) => i.status === 'verified').length,
      criticalIncidents: incidents.filter(
        (i) => (i.reviewed_priority || i.severity) === 'critical' && i.status !== 'rejected'
      ).length,
      totalRequests: requests.length,
      pendingRequests: requests.filter((r) => r.status === 'pending').length,
      activeOperations: requests.filter((r) =>
        ['assigned', 'rescue_in_progress'].includes(r.status)
      ).length,
      resolvedRequests: requests.filter((r) => ['resolved', 'closed'].includes(r.status)).length,
      availableTeams: teams.filter((t) => t.status === 'available').length,
      totalTeams: teams.length,
      approvedVolunteers: volunteers.filter((v) => v.approval_status === 'approved').length,
      pendingVolunteers: volunteers.filter((v) => v.approval_status === 'pending').length,
      activeAlerts: alerts.length,
      openShelters: shelters.filter((s) => s.status === 'open' || s.status === 'near_capacity')
        .length,
      totalShelters: shelters.length,
    };
  },

  async getAllIncidents() {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    return [...incidents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async updateIncidentAdmin(adminUserId, incidentId, updates, reasonNote = '') {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    const idx = incidents.findIndex((i) => i.id === incidentId);
    if (idx === -1) throw new Error('Incident not found.');

    const current = incidents[idx];
    const nextStatus = updates.status ?? current.status;
    const nextPriority =
      updates.reviewed_priority !== undefined ? updates.reviewed_priority : current.reviewed_priority;
    const nowIso = new Date().toISOString();

    const updated = {
      ...current,
      title: updates.title?.trim() ?? current.title,
      description: updates.description?.trim() ?? current.description,
      category: updates.category ?? current.category,
      locality: updates.locality?.trim() ?? current.locality,
      location_text: updates.location_text?.trim() ?? current.location_text,
      severity: updates.severity ?? current.severity,
      reviewed_priority: nextPriority || null,
      status: nextStatus,
      info_origin: nextStatus === 'verified' ? 'admin_verified' : current.info_origin,
      verified_by: nextStatus === 'verified' ? adminUserId : current.verified_by,
      verified_at: nextStatus === 'verified' ? nowIso : current.verified_at,
      updated_at: nowIso,
    };

    incidents[idx] = updated;
    writeStore(STORAGE_KEYS.INCIDENTS, incidents);

    if (
      nextStatus !== current.status ||
      nextPriority !== current.reviewed_priority ||
      reasonNote.trim()
    ) {
      appendIncidentHistory({
        incident_id: updated.id,
        incident_code: updated.incident_code,
        changed_by: adminUserId,
        previous_status: current.status,
        new_status: updated.status,
        previous_priority: current.reviewed_priority,
        new_priority: updated.reviewed_priority,
        notes: reasonNote.trim() || `Updated by District Admin (${updated.status}).`,
      });
    }

    if (nextStatus !== current.status) {
      pushDemoNotification(updated.user_id, {
        title: `Incident ${updated.incident_code} ${nextStatus.replace('_', ' ')}`,
        message: reasonNote.trim()
          ? `Status updated to ${nextStatus.replace('_', ' ')}: ${reasonNote.trim()}`
          : `District Control updated your incident report status to ${nextStatus.replace('_', ' ')}.`,
        type: 'incident_update',
        related_entity_type: 'incident',
        related_entity_id: updated.id,
      });
    }

    return updated;
  },

  async getIncidentVerificationHistory() {
    const history = getDemoCollection(STORAGE_KEYS.INCIDENT_HISTORY, DEMO_INCIDENT_HISTORY);
    return [...history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getAllEmergencyRequests() {
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    return [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async updateEmergencyRequestAdmin(adminUserId, requestId, updates, note = '') {
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    const teams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error('Emergency request not found.');

    const current = requests[idx];
    const nowIso = new Date().toISOString();

    let nextStatus = updates.status ?? current.status;
    let assignedTeamId =
      updates.assigned_team_id !== undefined ? updates.assigned_team_id : current.assigned_team_id;
    let assignedTeamName = current.assigned_team_name;
    let assignedTeamLeadId = null;

    if (assignedTeamId) {
      const matchedTeam = teams.find((t) => t.id === assignedTeamId);
      if (matchedTeam) {
        assignedTeamName = `${matchedTeam.name} (${matchedTeam.team_code})`;
        assignedTeamLeadId = matchedTeam.lead_user_id;
        // Mark team deployed when newly assigned
        if (assignedTeamId !== current.assigned_team_id && matchedTeam.status === 'available') {
          const updatedTeams = teams.map((t) =>
            t.id === matchedTeam.id ? { ...t, status: 'deployed', updated_at: nowIso } : t
          );
          writeStore(STORAGE_KEYS.TEAMS, updatedTeams);
        }
      }
      if (nextStatus === 'pending' || nextStatus === 'verified') {
        nextStatus = 'assigned';
      }
    } else if (updates.assigned_team_id === null) {
      assignedTeamName = null;
    }

    const updated = {
      ...current,
      status: nextStatus,
      reviewed_priority:
        updates.reviewed_priority !== undefined
          ? updates.reviewed_priority || null
          : current.reviewed_priority,
      assigned_team_id: assignedTeamId || null,
      assigned_team_name: assignedTeamName,
      assignment_status:
        assignedTeamId && !current.assignment_status ? 'assigned' : current.assignment_status,
      verified_by:
        nextStatus === 'verified' || nextStatus === 'assigned'
          ? current.verified_by || adminUserId
          : current.verified_by,
      resolved_at: nextStatus === 'resolved' ? nowIso : current.resolved_at,
      updated_at: nowIso,
    };

    requests[idx] = updated;
    writeStore(STORAGE_KEYS.EMERGENCIES, requests);

    if (nextStatus !== current.status || assignedTeamId !== current.assigned_team_id || note.trim()) {
      appendRescueHistory({
        emergency_request_id: updated.id,
        request_code: updated.request_code,
        changed_by: adminUserId,
        previous_status: current.status,
        new_status: updated.status,
        notes:
          note.trim() ||
          (assignedTeamId !== current.assigned_team_id && assignedTeamName
            ? `Assigned to ${assignedTeamName}`
            : `Admin updated status to ${updated.status}`),
      });
    }

    if (nextStatus !== current.status) {
      pushDemoNotification(updated.user_id, {
        title: `Emergency ${updated.request_code}: ${nextStatus.replaceAll('_', ' ')}`,
        message:
          assignedTeamName && nextStatus === 'assigned'
            ? `${assignedTeamName} has been assigned to your emergency request.`
            : note.trim() || `Your emergency request status is now ${nextStatus.replaceAll('_', ' ')}.`,
        type: 'emergency_update',
        related_entity_type: 'emergency_request',
        related_entity_id: updated.id,
      });
    }

    if (assignedTeamId && assignedTeamId !== current.assigned_team_id && assignedTeamLeadId) {
      pushDemoNotification(assignedTeamLeadId, {
        title: `Dispatch Assigned: ${updated.request_code}`,
        message: `${updated.people_count} residents in ${updated.locality} (${(
          updated.reviewed_priority || updated.severity
        ).toUpperCase()} priority). Open Assigned Rescues for protected contact & coordinates.`,
        type: 'assignment',
        related_entity_type: 'emergency_request',
        related_entity_id: updated.id,
      });
    }

    return updated;
  },

  async getRescueStatusHistory(requestId = null) {
    const history = getDemoCollection(STORAGE_KEYS.RESCUE_HISTORY, DEMO_RESCUE_HISTORY);
    const list = requestId
      ? history.filter((h) => h.emergency_request_id === requestId)
      : history;
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getRescueTeams() {
    const teams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
    const users = getDemoUsers();
    return teams.map((t) => ({
      ...t,
      lead_name: users.find((u) => u.id === t.lead_user_id)?.full_name || 'Unassigned',
    }));
  },

  async createRescueTeam(payload) {
    const teams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
    const nowIso = new Date().toISOString();
    const code =
      payload.team_code?.trim() || `RT-EG-${String(teams.length + 1).padStart(2, '0')}`;
    const record = {
      id: `rt-demo-${Date.now()}`,
      team_code: code,
      name: payload.name.trim(),
      team_type: payload.team_type || 'boat_rescue',
      base_location: payload.base_location.trim(),
      district: (payload.district || DEFAULT_DISTRICT).trim(),
      capacity: Math.max(1, Number(payload.capacity || 6)),
      equipment_summary: (payload.equipment_summary || '').trim(),
      status: payload.status || 'available',
      lead_user_id: payload.lead_user_id || null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    writeStore(STORAGE_KEYS.TEAMS, [record, ...teams]);
    return record;
  },

  async updateRescueTeam(teamId, updates) {
    const teams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
    const idx = teams.findIndex((t) => t.id === teamId);
    if (idx === -1) throw new Error('Rescue team not found.');
    const updated = {
      ...teams[idx],
      name: updates.name?.trim() ?? teams[idx].name,
      team_type: updates.team_type ?? teams[idx].team_type,
      base_location: updates.base_location?.trim() ?? teams[idx].base_location,
      capacity: updates.capacity !== undefined ? Number(updates.capacity) : teams[idx].capacity,
      equipment_summary: updates.equipment_summary?.trim() ?? teams[idx].equipment_summary,
      status: updates.status ?? teams[idx].status,
      lead_user_id:
        updates.lead_user_id !== undefined ? updates.lead_user_id || null : teams[idx].lead_user_id,
      updated_at: new Date().toISOString(),
    };
    teams[idx] = updated;
    writeStore(STORAGE_KEYS.TEAMS, teams);
    return updated;
  },

  async getVolunteers() {
    const volunteers = getDemoCollection(STORAGE_KEYS.VOLUNTEERS, DEMO_VOLUNTEERS);
    const users = getDemoUsers();
    return volunteers.map((v) => {
      const profile = users.find((u) => u.id === v.user_id);
      return {
        ...v,
        full_name: profile?.full_name || v.full_name,
        email: profile?.email || v.email,
        phone: profile?.phone || v.phone,
        locality: profile?.locality || v.locality,
      };
    });
  },

  async reviewVolunteerApplication(adminUserId, volunteerId, decision) {
    const volunteers = getDemoCollection(STORAGE_KEYS.VOLUNTEERS, DEMO_VOLUNTEERS);
    const idx = volunteers.findIndex((v) => v.id === volunteerId);
    if (idx === -1) throw new Error('Volunteer record not found.');

    const nowIso = new Date().toISOString();
    const updatedVol = {
      ...volunteers[idx],
      approval_status: decision,
      availability_status: decision === 'approved' ? 'available' : 'offline',
      approved_by: adminUserId,
      approved_at: decision === 'approved' ? nowIso : null,
      updated_at: nowIso,
    };
    volunteers[idx] = updatedVol;
    writeStore(STORAGE_KEYS.VOLUNTEERS, volunteers);

    // Sync user's role & volunteer_status
    const users = getDemoUsers();
    const uIdx = users.findIndex((u) => u.id === updatedVol.user_id);
    if (uIdx !== -1) {
      users[uIdx] = {
        ...users[uIdx],
        role: decision === 'approved' ? ROLES.VOLUNTEER : ROLES.CITIZEN,
        volunteer_status: decision,
        updated_at: nowIso,
      };
      saveDemoUsers(users);
    }

    pushDemoNotification(updatedVol.user_id, {
      title:
        decision === 'approved'
          ? 'Volunteer Application Approved'
          : 'Volunteer Application Not Approved',
      message:
        decision === 'approved'
          ? 'District Control approved your volunteer account. You can now access the Volunteer coordination dashboard.'
          : 'Your volunteer application was not approved at this time. Your Citizen account remains active.',
      type: 'approval',
      related_entity_type: 'volunteer',
      related_entity_id: updatedVol.id,
    });

    return updatedVol;
  },

  async getVolunteerTasks() {
    const tasks = getDemoCollection(STORAGE_KEYS.VOLUNTEER_TASKS, DEMO_VOLUNTEER_TASKS);
    const volunteers = await this.getVolunteers();
    return tasks
      .map((t) => ({
        ...t,
        assigned_volunteer_name:
          volunteers.find((v) => v.id === t.assigned_volunteer_id)?.full_name ||
          t.assigned_volunteer_name ||
          null,
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async createVolunteerTask(adminUserId, payload) {
    const tasks = getDemoCollection(STORAGE_KEYS.VOLUNTEER_TASKS, DEMO_VOLUNTEER_TASKS);
    const volunteers = await this.getVolunteers();
    const assignedVol = payload.assigned_volunteer_id
      ? volunteers.find((v) => v.id === payload.assigned_volunteer_id)
      : null;
    const nowIso = new Date().toISOString();

    const record = {
      id: `vtask-demo-${Date.now()}`,
      title: payload.title.trim(),
      description: payload.description.trim(),
      task_type: payload.task_type || 'field_support',
      locality: payload.locality.trim(),
      shelter_id: payload.shelter_id || null,
      assigned_volunteer_id: assignedVol ? assignedVol.id : null,
      assigned_volunteer_name: assignedVol ? assignedVol.full_name : null,
      created_by: adminUserId,
      priority: payload.priority || 'medium',
      status: assignedVol ? 'assigned' : 'open',
      progress_note: '',
      due_at: payload.due_at || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    writeStore(STORAGE_KEYS.VOLUNTEER_TASKS, [record, ...tasks]);

    if (assignedVol?.user_id) {
      pushDemoNotification(assignedVol.user_id, {
        title: `New Volunteer Task: ${record.title}`,
        message: `Assigned in ${record.locality} (${record.priority} priority).`,
        type: 'assignment',
        related_entity_type: 'volunteer_task',
        related_entity_id: record.id,
      });
    }
    return record;
  },

  async getAllAlerts() {
    const alerts = getDemoCollection(STORAGE_KEYS.ALERTS, DEMO_ALERTS);
    return [...alerts].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  },

  async createAlert(adminUserId, payload) {
    const alerts = getDemoCollection(STORAGE_KEYS.ALERTS, DEMO_ALERTS);
    const nowIso = new Date().toISOString();
    const record = {
      id: `alert-demo-${Date.now()}`,
      title: payload.title.trim(),
      message: payload.message.trim(),
      severity: payload.severity || 'medium',
      info_origin:
        payload.info_origin === 'official_government' ? 'official_government' : 'admin_verified',
      source_agency: payload.source_agency.trim(),
      published_at: payload.published_at || nowIso,
      expires_at: payload.expires_at || null,
      affected_localities: Array.isArray(payload.affected_localities)
        ? payload.affected_localities
        : [],
      is_active: true,
      created_by: adminUserId,
      created_at: nowIso,
      updated_at: nowIso,
    };
    writeStore(STORAGE_KEYS.ALERTS, [record, ...alerts]);
    // Broadcast in-app notification to all registered users when an alert is published
    const originText =
      record.info_origin === 'official_government' ? 'Official Alert' : 'Admin-issued Alert';
    getDemoUsers().forEach((u) => {
      pushDemoNotification(u.id, {
        title: `${originText}: ${record.title}`,
        message: `${record.source_agency} (${record.severity.toUpperCase()}): ${record.message}`,
        type: 'alert',
        related_entity_type: 'alert',
        related_entity_id: record.id,
      });
    });
    return record;
  },

  async updateAlert(alertId, updates) {
    const alerts = getDemoCollection(STORAGE_KEYS.ALERTS, DEMO_ALERTS);
    const idx = alerts.findIndex((a) => a.id === alertId);
    if (idx === -1) throw new Error('Alert not found.');
    const updated = {
      ...alerts[idx],
      title: updates.title?.trim() ?? alerts[idx].title,
      message: updates.message?.trim() ?? alerts[idx].message,
      severity: updates.severity ?? alerts[idx].severity,
      info_origin: updates.info_origin ?? alerts[idx].info_origin,
      source_agency: updates.source_agency?.trim() ?? alerts[idx].source_agency,
      affected_localities: updates.affected_localities ?? alerts[idx].affected_localities,
      expires_at: updates.expires_at !== undefined ? updates.expires_at : alerts[idx].expires_at,
      is_active: updates.is_active !== undefined ? updates.is_active : alerts[idx].is_active,
      updated_at: new Date().toISOString(),
    };
    alerts[idx] = updated;
    writeStore(STORAGE_KEYS.ALERTS, alerts);
    return updated;
  },

  async createShelter(adminUserId, payload) {
    const shelters = getDemoCollection(STORAGE_KEYS.SHELTERS, DEMO_SHELTERS);
    const nowIso = new Date().toISOString();
    const record = {
      id: `sh-demo-${Date.now()}`,
      name: payload.name.trim(),
      address: payload.address.trim(),
      locality: payload.locality.trim(),
      district: (payload.district || DEFAULT_DISTRICT).trim(),
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      capacity: Math.max(0, Number(payload.capacity || 0)),
      current_occupancy: Math.max(0, Number(payload.current_occupancy || 0)),
      status: payload.status || 'open',
      amenities: Array.isArray(payload.amenities) ? payload.amenities : [],
      contact_officer_name: (payload.contact_officer_name || '').trim(),
      info_origin:
        payload.info_origin === 'official_government' ? 'official_government' : 'admin_verified',
      updated_by: adminUserId,
      created_at: nowIso,
      updated_at: nowIso,
    };
    writeStore(STORAGE_KEYS.SHELTERS, [record, ...shelters]);
    return record;
  },

  async updateShelter(adminUserId, shelterId, updates) {
    const shelters = getDemoCollection(STORAGE_KEYS.SHELTERS, DEMO_SHELTERS);
    const idx = shelters.findIndex((s) => s.id === shelterId);
    if (idx === -1) throw new Error('Shelter not found.');
    const updated = {
      ...shelters[idx],
      name: updates.name?.trim() ?? shelters[idx].name,
      address: updates.address?.trim() ?? shelters[idx].address,
      locality: updates.locality?.trim() ?? shelters[idx].locality,
      latitude: updates.latitude !== undefined ? Number(updates.latitude) : shelters[idx].latitude,
      longitude:
        updates.longitude !== undefined ? Number(updates.longitude) : shelters[idx].longitude,
      capacity: updates.capacity !== undefined ? Number(updates.capacity) : shelters[idx].capacity,
      current_occupancy:
        updates.current_occupancy !== undefined
          ? Number(updates.current_occupancy)
          : shelters[idx].current_occupancy,
      status: updates.status ?? shelters[idx].status,
      amenities: updates.amenities ?? shelters[idx].amenities,
      contact_officer_name:
        updates.contact_officer_name?.trim() ?? shelters[idx].contact_officer_name,
      info_origin: updates.info_origin ?? shelters[idx].info_origin,
      updated_by: adminUserId,
      updated_at: new Date().toISOString(),
    };
    shelters[idx] = updated;
    writeStore(STORAGE_KEYS.SHELTERS, shelters);
    return updated;
  },

  async deleteShelter(shelterId) {
    const shelters = getDemoCollection(STORAGE_KEYS.SHELTERS, DEMO_SHELTERS);
    writeStore(
      STORAGE_KEYS.SHELTERS,
      shelters.filter((s) => s.id !== shelterId)
    );
    return true;
  },

  async getAllUsers() {
    return getDemoUsers()
      .map(toSafeProfile)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async updateUserRole(adminUserId, targetUserId, nextRole) {
    if (!Object.values(ROLES).includes(nextRole)) {
      throw new Error('Invalid target role.');
    }
    if (adminUserId === targetUserId && nextRole !== ROLES.ADMIN) {
      throw new Error('You cannot remove your own Administrator role while signed in.');
    }
    const users = getDemoUsers();
    const idx = users.findIndex((u) => u.id === targetUserId);
    if (idx === -1) throw new Error('User profile not found.');

    const updated = {
      ...users[idx],
      role: nextRole,
      volunteer_status:
        nextRole === ROLES.VOLUNTEER ? 'approved' : users[idx].volunteer_status,
      updated_at: new Date().toISOString(),
    };
    users[idx] = updated;
    saveDemoUsers(users);

    pushDemoNotification(targetUserId, {
      title: `Account Role Updated to ${nextRole.replace('_', ' ')}`,
      message: `An administrator updated your FloodConnect access role to ${nextRole.replace('_', ' ')}.`,
      type: 'approval',
    });

    return toSafeProfile(updated);
  },

  // =========================================================================
  // STAGE 3: RESCUE TEAM OPERATIONS (STRICTLY ASSIGNED REQUESTS ONLY)
  // =========================================================================

  async getMyRescueTeams(rescueUserId) {
    const teams = await this.getRescueTeams();
    return teams.filter((t) => t.lead_user_id === rescueUserId);
  },

  async getAssignedEmergencyRequests(rescueUserId) {
    const myTeams = await this.getMyRescueTeams(rescueUserId);
    const myTeamIds = new Set(myTeams.map((t) => t.id));
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    return requests
      .filter((r) => r.assigned_team_id && myTeamIds.has(r.assigned_team_id))
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  },

  async updateRescueProgress(rescueUserId, requestId, { nextStatus, assignmentStatus, notes = '' }) {
    const myTeams = await this.getMyRescueTeams(rescueUserId);
    const myTeamIds = new Set(myTeams.map((t) => t.id));
    const requests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error('Assigned emergency request not found.');
    const current = requests[idx];

    if (!current.assigned_team_id || !myTeamIds.has(current.assigned_team_id)) {
      throw new Error('Access denied: This emergency request is not assigned to your rescue team.');
    }

    const nowIso = new Date().toISOString();
    const resolvedStatus = nextStatus || current.status;
    const updated = {
      ...current,
      status: resolvedStatus,
      assignment_status: assignmentStatus || current.assignment_status || 'assigned',
      responder_notes: notes.trim() ? notes.trim() : current.responder_notes,
      resolved_at: resolvedStatus === 'resolved' ? nowIso : current.resolved_at,
      updated_at: nowIso,
    };

    requests[idx] = updated;
    writeStore(STORAGE_KEYS.EMERGENCIES, requests);

    // Every status change or progress note writes to rescue_status_history AND creates a notification
    appendRescueHistory({
      emergency_request_id: updated.id,
      request_code: updated.request_code,
      changed_by: rescueUserId,
      previous_status: current.status,
      new_status: updated.status,
      notes:
        notes.trim() ||
        `Rescue unit updated progress (${assignmentStatus || updated.status.replaceAll('_', ' ')}).`,
    });

    pushDemoNotification(updated.user_id, {
      title: `Rescue Update for ${updated.request_code}`,
      message:
        resolvedStatus === 'resolved'
          ? `Your rescue unit marked ${updated.request_code} as Resolved.${notes.trim() ? ` Note: ${notes.trim()}` : ''}`
          : `Status: ${resolvedStatus.replaceAll('_', ' ')}.${notes.trim() ? ` Responder note: ${notes.trim()}` : ''}`,
      type: 'emergency_update',
      related_entity_type: 'emergency_request',
      related_entity_id: updated.id,
    });

    // If marked resolved, make team available again if no other active rescues remain
    if (resolvedStatus === 'resolved') {
      const stillActive = requests.some(
        (r) =>
          r.id !== updated.id &&
          r.assigned_team_id === updated.assigned_team_id &&
          ['assigned', 'rescue_in_progress'].includes(r.status)
      );
      if (!stillActive) {
        const teams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
        writeStore(
          STORAGE_KEYS.TEAMS,
          teams.map((t) =>
            t.id === updated.assigned_team_id ? { ...t, status: 'available', updated_at: nowIso } : t
          )
        );
      }
    }

    return updated;
  },

  async getMyRescueHistory(rescueUserId) {
    const assigned = await this.getAssignedEmergencyRequests(rescueUserId);
    const reqIds = new Set(assigned.map((r) => r.id));
    const history = getDemoCollection(STORAGE_KEYS.RESCUE_HISTORY, DEMO_RESCUE_HISTORY);
    return history
      .filter((h) => reqIds.has(h.emergency_request_id) || h.changed_by === rescueUserId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // =========================================================================
  // STAGE 3: VOLUNTEER OPERATIONS
  // =========================================================================

  async getMyVolunteerRecord(userId) {
    const volunteers = await this.getVolunteers();
    return volunteers.find((v) => v.user_id === userId) || null;
  },

  async updateVolunteerAvailability(userId, availabilityStatus) {
    const volunteers = getDemoCollection(STORAGE_KEYS.VOLUNTEERS, DEMO_VOLUNTEERS);
    const idx = volunteers.findIndex((v) => v.user_id === userId);
    if (idx === -1) throw new Error('Volunteer record not found.');
    volunteers[idx] = {
      ...volunteers[idx],
      availability_status: availabilityStatus,
      updated_at: new Date().toISOString(),
    };
    writeStore(STORAGE_KEYS.VOLUNTEERS, volunteers);
    return volunteers[idx];
  },

  async getVolunteerTasksForUser(userId) {
    const myVol = await this.getMyVolunteerRecord(userId);
    const tasks = await this.getVolunteerTasks();
    return tasks.filter(
      (t) => t.status === 'open' || (myVol && t.assigned_volunteer_id === myVol.id)
    );
  },

  async respondToVolunteerTask(userId, taskId, action, progressNote = '') {
    const myVol = await this.getMyVolunteerRecord(userId);
    if (!myVol || myVol.approval_status !== 'approved') {
      throw new Error('Only approved volunteers can update tasks.');
    }

    const tasks = getDemoCollection(STORAGE_KEYS.VOLUNTEER_TASKS, DEMO_VOLUNTEER_TASKS);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error('Volunteer task not found.');

    const current = tasks[idx];
    const nowIso = new Date().toISOString();
    let updated = { ...current, updated_at: nowIso };

    if (action === 'accept') {
      updated = {
        ...updated,
        assigned_volunteer_id: myVol.id,
        assigned_volunteer_name: myVol.full_name,
        status: 'assigned',
        progress_note: progressNote.trim() || 'Accepted by volunteer.',
      };
    } else if (action === 'decline') {
      updated = {
        ...updated,
        assigned_volunteer_id: null,
        assigned_volunteer_name: null,
        status: 'open',
        progress_note: progressNote.trim() || 'Declined and returned to open queue.',
      };
    } else if (action === 'start') {
      updated = {
        ...updated,
        status: 'in_progress',
        progress_note: progressNote.trim() || current.progress_note || 'Task in progress.',
      };
    } else if (action === 'complete') {
      updated = {
        ...updated,
        status: 'completed',
        progress_note: progressNote.trim() || current.progress_note || 'Completed.',
      };
    }

    tasks[idx] = updated;
    writeStore(STORAGE_KEYS.VOLUNTEER_TASKS, tasks);
    return updated;
  },

  // =========================================================================
  // STAGE 4: ANALYTICS & OFFICIAL INFORMATION (NO FABRICATED TELEMETRY)
  // =========================================================================

  async getAdminAnalytics() {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    const emergencyRequests = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    const rescueTeams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
    return computeAdminAnalytics({ incidents, emergencyRequests, rescueTeams });
  },

  async getOfficialInformation({ includeInactive = false } = {}) {
    // Strictly defaults to [] — never fabricates rainfall, forecasts, or river levels.
    const entries = getDemoCollection(STORAGE_KEYS.OFFICIAL_INFO, []);
    const now = Date.now();
    const list = includeInactive
      ? entries
      : entries.filter((e) => {
          if (e.is_active === false) return false;
          if (e.expires_at && new Date(e.expires_at).getTime() < now) return false;
          return true;
        });
    return [...list].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  },

  async createOfficialInfo(adminUserId, payload) {
    const entries = getDemoCollection(STORAGE_KEYS.OFFICIAL_INFO, []);
    const nowIso = new Date().toISOString();
    const record = {
      id: `off-demo-${Date.now()}`,
      category: payload.category || 'rainfall',
      title: payload.title.trim(),
      metric_value: (payload.metric_value || '').trim(),
      station_or_area: (payload.station_or_area || DEFAULT_DISTRICT).trim(),
      summary: payload.summary.trim(),
      source_agency: payload.source_agency.trim(),
      published_at: payload.published_at || nowIso,
      expires_at: payload.expires_at || null,
      is_active: true,
      info_origin: 'official_government',
      created_by: adminUserId,
      created_at: nowIso,
      updated_at: nowIso,
    };
    writeStore(STORAGE_KEYS.OFFICIAL_INFO, [record, ...entries]);
    return record;
  },

  async updateOfficialInfo(entryId, updates) {
    const entries = getDemoCollection(STORAGE_KEYS.OFFICIAL_INFO, []);
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1) throw new Error('Official information entry not found.');
    const updated = {
      ...entries[idx],
      category: updates.category ?? entries[idx].category,
      title: updates.title?.trim() ?? entries[idx].title,
      metric_value: updates.metric_value?.trim() ?? entries[idx].metric_value,
      station_or_area: updates.station_or_area?.trim() ?? entries[idx].station_or_area,
      summary: updates.summary?.trim() ?? entries[idx].summary,
      source_agency: updates.source_agency?.trim() ?? entries[idx].source_agency,
      published_at: updates.published_at ?? entries[idx].published_at,
      expires_at: updates.expires_at !== undefined ? updates.expires_at : entries[idx].expires_at,
      is_active: updates.is_active !== undefined ? updates.is_active : entries[idx].is_active,
      updated_at: new Date().toISOString(),
    };
    entries[idx] = updated;
    writeStore(STORAGE_KEYS.OFFICIAL_INFO, entries);
    return updated;
  },

  async deleteOfficialInfo(entryId) {
    const entries = getDemoCollection(STORAGE_KEYS.OFFICIAL_INFO, []);
    writeStore(
      STORAGE_KEYS.OFFICIAL_INFO,
      entries.filter((e) => e.id !== entryId)
    );
    return true;
  },

  // =========================================================================
  // PUBLIC SUMMARY & CONTACT
  // =========================================================================

  async getPublicSummary() {
    const incidents = getDemoCollection(STORAGE_KEYS.INCIDENTS, DEMO_INCIDENTS);
    const shelters = getDemoCollection(STORAGE_KEYS.SHELTERS, DEMO_SHELTERS);
    const emergencies = getDemoCollection(STORAGE_KEYS.EMERGENCIES, DEMO_EMERGENCY_REQUESTS);
    const teams = getDemoCollection(STORAGE_KEYS.TEAMS, DEMO_RESCUE_TEAMS);
    const alerts = await this.getActiveAlerts();

    const verifiedIncidents = incidents.filter((i) => i.status === 'verified').length;
    const pendingIncidents = incidents.filter((i) => i.status === 'pending_verification').length;
    const openShelters = shelters.filter((s) => s.status === 'open' || s.status === 'near_capacity')
      .length;
    const totalShelterCapacity = shelters.reduce((sum, s) => sum + s.capacity, 0);
    const totalShelterOccupancy = shelters.reduce((sum, s) => sum + s.current_occupancy, 0);
    const activeRescueTeams = teams.filter(
      (t) => t.status === 'available' || t.status === 'deployed'
    ).length;
    const activeEmergenciesCount = emergencies.filter(
      (e) => !['resolved', 'closed', 'cancelled'].includes(e.status)
    ).length;

    return {
      isDemo: true,
      liveOfficialDataAvailable: alerts.length > 0,
      officialDataMessage:
        alerts.length > 0
          ? `${alerts.length} active official or admin-issued alert(s) published.`
          : 'Live official data is currently unavailable.',
      verifiedIncidents,
      pendingIncidents,
      openShelters,
      totalShelterCapacity,
      totalShelterOccupancy,
      activeRescueTeams,
      activeEmergenciesCount,
      activeOfficialAlerts: alerts.length,
      sampleRecordsPreview: {
        verifiedIncidents: incidents
          .filter((i) => i.status === 'verified')
          .slice(0, 5)
          .map((i) => ({
            id: i.id,
            incident_code: i.incident_code,
            title: i.title,
            locality: i.locality,
            severity: i.reviewed_priority || i.severity,
            status: i.status,
            info_origin: i.info_origin,
            created_at: i.created_at,
          })),
        shelters: shelters.slice(0, 5).map((s) => ({
          id: s.id,
          name: s.name,
          locality: s.locality,
          capacity: s.capacity,
          current_occupancy: s.current_occupancy,
          status: s.status,
          info_origin: s.info_origin,
        })),
      },
    };
  },

  async submitContactInquiry(payload) {
    const logs = readStore(STORAGE_KEYS.CONTACT_LOGS, []);
    const entry = {
      id: `contact-${Date.now()}`,
      name: payload.name.trim(),
      email: payload.email.trim(),
      locality: payload.locality.trim(),
      topic: payload.topic,
      message: payload.message.trim(),
      submittedAt: new Date().toISOString(),
    };
    writeStore(STORAGE_KEYS.CONTACT_LOGS, [entry, ...logs]);
    return entry;
  },

  getDemoAccountsList() {
    return DEMO_USERS.filter((u) => u.id !== 'demo-volunteer-pending-002').map((u) => ({
      email: u.email,
      password: u.password,
      role: u.role,
      full_name: u.full_name,
      locality: u.locality,
    }));
  },
};
