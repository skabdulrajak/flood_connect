import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { DEFAULT_DISTRICT, EAST_GODAVARI_CENTER, ROLES } from '../utils/constants';

const BOOTSTRAPPED_ADMIN_EMAIL = 'rajaksk319@gmail.com';

function nowIso() {
  return new Date().toISOString();
}

function generateCode(prefix) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${day}-${rand}`;
}

function makeDocId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampString(val, maxLen) {
  if (val == null) return '';
  return String(val).trim().slice(0, maxLen);
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

async function ensureUserProfile(firebaseUser) {
  if (!firebaseUser) return null;
  const userPath = `users/${firebaseUser.uid}`;
  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  const email = clampString(firebaseUser.email || '', 254).toLowerCase();
  const isBootstrappedAdmin =
    email === BOOTSTRAPPED_ADMIN_EMAIL && Boolean(firebaseUser.emailVerified);

  const profileData = {
    id: firebaseUser.uid,
    email: email || `${firebaseUser.uid}@floodconnect.local`,
    full_name: clampString(firebaseUser.displayName || email.split('@')[0] || 'FloodConnect User', 140),
    phone: clampString(firebaseUser.phoneNumber || '', 32),
    role: isBootstrappedAdmin ? ROLES.ADMIN : ROLES.CITIZEN,
    district: DEFAULT_DISTRICT,
    locality: 'Rajahmundry Urban',
    preferred_language: 'en',
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  try {
    await setDoc(userRef, profileData);
    return profileData;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
  }
}

async function pushNotification(userId, { title, message, category = 'system', related_id = '' }) {
  if (!userId) return;
  const id = makeDocId('notif');
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      user_id: userId,
      title: clampString(title, 160),
      message: clampString(message, 800),
      category: clampString(category, 64),
      is_read: false,
      related_id: clampString(related_id, 128),
      created_at: nowIso(),
    });
  } catch (err) {
    console.warn('Notification write skipped:', err);
  }
}

async function writeAuditEntry({
  kind,
  target_id,
  target_code = '',
  from_status = '',
  to_status,
  changed_by,
  changed_by_name = '',
  note = '',
}) {
  const id = makeDocId('audit');
  const path = `audit_history/${id}`;
  try {
    await setDoc(doc(db, 'audit_history', id), {
      kind,
      target_id: clampString(target_id, 128),
      target_code: clampString(target_code, 64),
      from_status: clampString(from_status, 64),
      to_status: clampString(to_status, 64),
      changed_by: clampString(changed_by, 128),
      changed_by_name: clampString(changed_by_name, 140),
      note: clampString(note, 600),
      created_at: nowIso(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export const firebaseDataLayer = {
  mode: 'firebase',

  isFirebaseAuthenticated() {
    return Boolean(auth.currentUser);
  },

  async signInWithGoogle() {
    const credential = await signInWithPopup(auth, googleProvider);
    const fbUser = credential.user;
    const profile = await ensureUserProfile(fbUser);
    return {
      session: { userId: fbUser.uid, provider: 'firebase_google', signedInAt: nowIso() },
      user: { id: fbUser.uid, email: fbUser.email },
      profile,
    };
  },

  async getSession() {
    const fbUser = auth.currentUser;
    if (!fbUser) return { session: null, user: null, profile: null };
    const profile = await ensureUserProfile(fbUser);
    return {
      session: { userId: fbUser.uid, provider: 'firebase_google', signedInAt: nowIso() },
      user: { id: fbUser.uid, email: fbUser.email },
      profile,
    };
  },

  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback({ session: null, user: null, profile: null, source: 'firebase' });
        return;
      }
      try {
        const profile = await ensureUserProfile(fbUser);
        callback({
          session: { userId: fbUser.uid, provider: 'firebase_google', signedInAt: nowIso() },
          user: { id: fbUser.uid, email: fbUser.email },
          profile,
          source: 'firebase',
        });
      } catch (err) {
        console.error('Firebase auth state profile load failed:', err);
        callback({ session: null, user: null, profile: null, source: 'firebase' });
      }
    });
  },

  async signOut() {
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  },

  async updateProfile(userId, updates) {
    const path = `users/${userId}`;
    const ref = doc(db, 'users', userId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const current = snap.data();
      const safeLang = ['en', 'hi', 'te'].includes(updates.preferred_language)
        ? updates.preferred_language
        : current.preferred_language || 'en';

      const merged = {
        id: current.id,
        email: current.email,
        full_name: clampString(updates.full_name ?? current.full_name, 140) || current.full_name,
        phone: clampString(updates.phone ?? current.phone ?? '', 32),
        role: current.role,
        district: clampString(updates.district ?? current.district ?? DEFAULT_DISTRICT, 120),
        locality: clampString(updates.locality ?? current.locality ?? '', 120),
        preferred_language: safeLang,
        created_at: current.created_at || nowIso(),
        updated_at: nowIso(),
      };
      await updateDoc(ref, merged);
      return merged;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // -------------------------------------------------------------------------
  // Incidents
  // -------------------------------------------------------------------------
  async uploadIncidentPhoto(_userId, file) {
    return fileToCompressedDataUrl(file);
  },

  async createIncident(userId, payload) {
    const id = makeDocId('inc');
    const path = `incidents/${id}`;
    const lat = Number.isFinite(Number(payload.latitude))
      ? Number(payload.latitude)
      : EAST_GODAVARI_CENTER.lat;
    const lng = Number.isFinite(Number(payload.longitude))
      ? Number(payload.longitude)
      : EAST_GODAVARI_CENTER.lng;

    const record = {
      incident_code: generateCode('INC'),
      reporter_id: userId,
      title: clampString(payload.title || 'Flood observation report', 180),
      description: clampString(payload.description || 'Field observation submitted.', 2000),
      category: clampString(payload.category || 'residential_flooding', 64),
      severity: ['low', 'medium', 'high', 'critical'].includes(payload.severity)
        ? payload.severity
        : 'medium',
      reviewed_priority: '',
      status: 'pending_verification',
      locality: clampString(payload.locality || 'Rajahmundry Urban', 120),
      location_text: clampString(payload.location_text || '', 240),
      latitude: lat,
      longitude: lng,
      photo_urls: Array.isArray(payload.photo_urls) ? payload.photo_urls.slice(0, 3) : [],
      info_origin: 'citizen_report',
      verification_note: '',
      observed_at: payload.observed_at || nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    try {
      await setDoc(doc(db, 'incidents', id), record);
      await pushNotification(userId, {
        title: 'Flood Report Submitted',
        message: `Report ${record.incident_code} (${record.locality}) has been logged for District Admin verification.`,
        category: 'incident',
        related_id: id,
      });
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async getMyIncidents(userId) {
    const path = 'incidents';
    try {
      const q = query(collection(db, 'incidents'), where('reporter_id', '==', userId));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data(), isOwnReport: true }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async getMapIncidents({ userId } = {}) {
    const path = 'incidents';
    try {
      const verifiedSnap = await getDocs(
        query(collection(db, 'incidents'), where('status', '==', 'verified'))
      );
      const mapById = new Map();
      verifiedSnap.docs.forEach((d) => {
        const data = d.data();
        mapById.set(d.id, {
          id: d.id,
          ...data,
          isOwnReport: Boolean(userId && data.reporter_id === userId),
        });
      });

      if (userId) {
        const ownSnap = await getDocs(
          query(collection(db, 'incidents'), where('reporter_id', '==', userId))
        );
        ownSnap.docs.forEach((d) => {
          mapById.set(d.id, { id: d.id, ...d.data(), isOwnReport: true });
        });
      }

      return Array.from(mapById.values()).sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || ''))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async getAllIncidents() {
    const path = 'incidents';
    try {
      const snap = await getDocs(collection(db, 'incidents'));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async updateIncidentAdmin(adminUserId, incidentId, updates, reasonNote = '') {
    const path = `incidents/${incidentId}`;
    const ref = doc(db, 'incidents', incidentId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Incident not found.');
      const current = snap.data();
      const next = {
        ...current,
        title: clampString(updates.title ?? current.title, 180),
        description: clampString(updates.description ?? current.description, 2000),
        category: clampString(updates.category ?? current.category, 64),
        severity: ['low', 'medium', 'high', 'critical'].includes(updates.severity)
          ? updates.severity
          : current.severity,
        reviewed_priority: updates.reviewed_priority ?? current.reviewed_priority ?? '',
        status: ['pending_verification', 'verified', 'rejected', 'resolved'].includes(updates.status)
          ? updates.status
          : current.status,
        locality: clampString(updates.locality ?? current.locality, 120),
        location_text: clampString(updates.location_text ?? current.location_text ?? '', 240),
        verification_note: clampString(reasonNote || updates.verification_note || current.verification_note || '', 800),
        updated_at: nowIso(),
      };
      await setDoc(ref, next);

      await writeAuditEntry({
        kind: 'incident',
        target_id: incidentId,
        target_code: current.incident_code || incidentId,
        from_status: current.status,
        to_status: next.status,
        changed_by: adminUserId,
        changed_by_name: auth.currentUser?.displayName || 'District Admin',
        note: reasonNote || `Incident updated to ${next.status}`,
      });

      if (current.reporter_id) {
        await pushNotification(current.reporter_id, {
          title: `Report ${current.incident_code}: ${next.status}`,
          message: reasonNote || `District Admin updated your flood report status to ${next.status}.`,
          category: 'incident',
          related_id: incidentId,
        });
      }

      return { id: incidentId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async getIncidentVerificationHistory() {
    const path = 'audit_history';
    try {
      const snap = await getDocs(
        query(collection(db, 'audit_history'), where('kind', '==', 'incident'))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  // -------------------------------------------------------------------------
  // Emergency Requests
  // -------------------------------------------------------------------------
  async createEmergencyRequest(userId, payload) {
    const id = makeDocId('req');
    const path = `emergency_requests/${id}`;
    const lat = Number.isFinite(Number(payload.latitude))
      ? Number(payload.latitude)
      : EAST_GODAVARI_CENTER.lat;
    const lng = Number.isFinite(Number(payload.longitude))
      ? Number(payload.longitude)
      : EAST_GODAVARI_CENTER.lng;

    const record = {
      request_code: generateCode('ER'),
      requester_id: userId,
      requester_name: clampString(payload.requester_name || auth.currentUser?.displayName || '', 140),
      contact_phone: clampString(payload.contact_phone || '', 32),
      people_count: Math.max(1, Math.min(500, Math.round(Number(payload.people_count) || 1))),
      children_count: Math.max(0, Math.min(200, Math.round(Number(payload.children_count) || 0))),
      elderly_count: Math.max(0, Math.min(200, Math.round(Number(payload.elderly_count) || 0))),
      is_trapped: Boolean(payload.is_trapped),
      medical_needs: clampString(payload.medical_needs || '', 500),
      accessibility_needs: clampString(payload.accessibility_needs || '', 500),
      description: clampString(payload.description || '', 2000),
      severity: ['low', 'medium', 'high', 'critical'].includes(payload.severity)
        ? payload.severity
        : 'high',
      reviewed_priority: '',
      status: 'pending',
      locality: clampString(payload.locality || 'Rajahmundry Urban', 120),
      location_text: clampString(payload.location_text || '', 240),
      latitude: lat,
      longitude: lng,
      assigned_team_id: '',
      assigned_responder_id: '',
      assigned_team_name: '',
      rescue_notes: '',
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    try {
      await setDoc(doc(db, 'emergency_requests', id), record);
      await pushNotification(userId, {
        title: 'Emergency Request Logged',
        message: `Emergency Request ${record.request_code} has been queued for Control Room dispatch.`,
        category: 'emergency',
        related_id: id,
      });
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async getMyEmergencyRequests(userId) {
    const path = 'emergency_requests';
    try {
      const snap = await getDocs(
        query(collection(db, 'emergency_requests'), where('requester_id', '==', userId))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async cancelEmergencyRequest(userId, requestId) {
    const path = `emergency_requests/${requestId}`;
    const ref = doc(db, 'emergency_requests', requestId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Request not found.');
      const current = snap.data();
      const next = { ...current, status: 'cancelled', updated_at: nowIso() };
      await setDoc(ref, next);
      await writeAuditEntry({
        kind: 'rescue',
        target_id: requestId,
        target_code: current.request_code || requestId,
        from_status: current.status,
        to_status: 'cancelled',
        changed_by: userId,
        changed_by_name: auth.currentUser?.displayName || 'Citizen',
        note: 'Cancelled by requester',
      });
      return { id: requestId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async getAllEmergencyRequests() {
    const path = 'emergency_requests';
    try {
      const snap = await getDocs(collection(db, 'emergency_requests'));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async updateEmergencyRequestAdmin(adminUserId, requestId, updates, note = '') {
    const path = `emergency_requests/${requestId}`;
    const ref = doc(db, 'emergency_requests', requestId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Emergency request not found.');
      const current = snap.data();
      let assignedResponderId = updates.assigned_responder_id ?? current.assigned_responder_id ?? '';
      let assignedTeamName = updates.assigned_team_name ?? current.assigned_team_name ?? '';

      if (updates.assigned_team_id && updates.assigned_team_id !== current.assigned_team_id) {
        const teamSnap = await getDoc(doc(db, 'rescue_teams', updates.assigned_team_id));
        if (teamSnap.exists()) {
          const team = teamSnap.data();
          assignedResponderId = team.leader_user_id || assignedResponderId;
          assignedTeamName = team.name || assignedTeamName;
        }
      }

      const next = {
        ...current,
        status: updates.status ?? current.status,
        reviewed_priority: updates.reviewed_priority ?? current.reviewed_priority ?? '',
        assigned_team_id: updates.assigned_team_id ?? current.assigned_team_id ?? '',
        assigned_responder_id: assignedResponderId,
        assigned_team_name: assignedTeamName,
        rescue_notes: clampString(note || updates.rescue_notes || current.rescue_notes || '', 800),
        updated_at: nowIso(),
      };
      await setDoc(ref, next);

      await writeAuditEntry({
        kind: 'rescue',
        target_id: requestId,
        target_code: current.request_code || requestId,
        from_status: current.status,
        to_status: next.status,
        changed_by: adminUserId,
        changed_by_name: auth.currentUser?.displayName || 'District Admin',
        note: note || `Status updated to ${next.status}`,
      });

      if (current.requester_id) {
        await pushNotification(current.requester_id, {
          title: `Emergency ${current.request_code}: ${next.status}`,
          message: note || `Your emergency request status is now ${next.status}.`,
          category: 'emergency',
          related_id: requestId,
        });
      }

      return { id: requestId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async getRescueStatusHistory(requestId) {
    const path = 'audit_history';
    try {
      const q = requestId
        ? query(
            collection(db, 'audit_history'),
            where('kind', '==', 'rescue'),
            where('target_id', '==', requestId)
          )
        : query(collection(db, 'audit_history'), where('kind', '==', 'rescue'));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  // -------------------------------------------------------------------------
  // Shelters, Alerts, Official Info
  // -------------------------------------------------------------------------
  async getShelters() {
    const path = 'shelters';
    try {
      const snap = await getDocs(collection(db, 'shelters'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async createShelter(_adminUserId, payload) {
    const id = makeDocId('sh');
    const path = `shelters/${id}`;
    const cap = Math.max(1, Math.min(50000, Math.round(Number(payload.capacity) || 100)));
    const occ = Math.max(0, Math.min(cap, Math.round(Number(payload.current_occupancy) || 0)));
    const record = {
      name: clampString(payload.name || 'Relief Shelter', 160),
      address: clampString(payload.address || '', 240),
      locality: clampString(payload.locality || 'Rajahmundry Urban', 120),
      capacity: cap,
      current_occupancy: occ,
      status: ['open', 'near_capacity', 'full', 'closed'].includes(payload.status)
        ? payload.status
        : 'open',
      latitude: Number(payload.latitude) || EAST_GODAVARI_CENTER.lat,
      longitude: Number(payload.longitude) || EAST_GODAVARI_CENTER.lng,
      amenities: Array.isArray(payload.amenities) ? payload.amenities.slice(0, 15) : [],
      contact_officer_name: clampString(payload.contact_officer_name || '', 120),
      contact_phone: clampString(payload.contact_phone || '', 32),
      info_origin: 'admin_issued',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    try {
      await setDoc(doc(db, 'shelters', id), record);
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async updateShelter(_adminUserId, shelterId, updates) {
    const path = `shelters/${shelterId}`;
    const ref = doc(db, 'shelters', shelterId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Shelter not found.');
      const cur = snap.data();
      const cap = Math.max(1, Math.min(50000, Math.round(Number(updates.capacity ?? cur.capacity) || 100)));
      const occ = Math.max(0, Math.min(cap, Math.round(Number(updates.current_occupancy ?? cur.current_occupancy) || 0)));
      const next = {
        ...cur,
        name: clampString(updates.name ?? cur.name, 160),
        address: clampString(updates.address ?? cur.address ?? '', 240),
        locality: clampString(updates.locality ?? cur.locality, 120),
        capacity: cap,
        current_occupancy: occ,
        status: ['open', 'near_capacity', 'full', 'closed'].includes(updates.status)
          ? updates.status
          : cur.status,
        latitude: Number(updates.latitude ?? cur.latitude),
        longitude: Number(updates.longitude ?? cur.longitude),
        amenities: Array.isArray(updates.amenities) ? updates.amenities.slice(0, 15) : cur.amenities || [],
        contact_officer_name: clampString(updates.contact_officer_name ?? cur.contact_officer_name ?? '', 120),
        updated_at: nowIso(),
      };
      await setDoc(ref, next);
      return { id: shelterId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async deleteShelter(shelterId) {
    const path = `shelters/${shelterId}`;
    try {
      await deleteDoc(doc(db, 'shelters', shelterId));
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async getActiveAlerts() {
    const path = 'alerts';
    try {
      const snap = await getDocs(query(collection(db, 'alerts'), where('status', '==', 'active')));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async getAllAlerts() {
    const path = 'alerts';
    try {
      const snap = await getDocs(collection(db, 'alerts'));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async createAlert(adminUserId, payload) {
    const id = makeDocId('alert');
    const path = `alerts/${id}`;
    const record = {
      title: clampString(payload.title || 'Flood Alert', 180),
      message: clampString(payload.message || '', 2000),
      severity: ['low', 'medium', 'high', 'critical'].includes(payload.severity)
        ? payload.severity
        : 'high',
      affected_area: clampString(payload.affected_area || 'East Godavari', 160),
      source_name: clampString(payload.source_name || 'District Emergency Operations Centre', 160),
      info_origin: payload.info_origin === 'official' ? 'official' : 'admin_issued',
      status: 'active',
      issued_by: adminUserId,
      published_at: nowIso(),
      expires_at: payload.expires_at || '',
      updated_at: nowIso(),
    };
    try {
      await setDoc(doc(db, 'alerts', id), record);
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async updateAlert(alertId, updates) {
    const path = `alerts/${alertId}`;
    const ref = doc(db, 'alerts', alertId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Alert not found.');
      const cur = snap.data();
      const next = {
        ...cur,
        title: clampString(updates.title ?? cur.title, 180),
        message: clampString(updates.message ?? cur.message, 2000),
        severity: ['low', 'medium', 'high', 'critical'].includes(updates.severity)
          ? updates.severity
          : cur.severity,
        affected_area: clampString(updates.affected_area ?? cur.affected_area, 160),
        status: ['active', 'expired'].includes(updates.status) ? updates.status : cur.status,
        updated_at: nowIso(),
      };
      await setDoc(ref, next);
      return { id: alertId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // -------------------------------------------------------------------------
  // Rescue Teams, Volunteers, Tasks, Users
  // -------------------------------------------------------------------------
  async getRescueTeams() {
    const path = 'rescue_teams';
    try {
      const snap = await getDocs(collection(db, 'rescue_teams'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async createRescueTeam(payload) {
    const id = makeDocId('team');
    const path = `rescue_teams/${id}`;
    const record = {
      name: clampString(payload.name || 'Rescue Unit', 140),
      code: clampString(payload.code || generateCode('RT'), 40),
      status: ['available', 'deployed', 'standby', 'offline'].includes(payload.status)
        ? payload.status
        : 'available',
      base_locality: clampString(payload.base_locality || 'Rajahmundry Urban', 120),
      leader_user_id: clampString(payload.leader_user_id || '', 128),
      leader_name: clampString(payload.leader_name || '', 120),
      member_count: Math.max(1, Math.min(100, Math.round(Number(payload.member_count) || 6))),
      capabilities: Array.isArray(payload.capabilities) ? payload.capabilities.slice(0, 15) : [],
      contact_channel: clampString(payload.contact_channel || '', 80),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    try {
      await setDoc(doc(db, 'rescue_teams', id), record);
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async updateRescueTeam(teamId, updates) {
    const path = `rescue_teams/${teamId}`;
    const ref = doc(db, 'rescue_teams', teamId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Rescue team not found.');
      const cur = snap.data();
      const next = {
        ...cur,
        ...updates,
        status: ['available', 'deployed', 'standby', 'offline'].includes(updates.status)
          ? updates.status
          : cur.status,
        updated_at: nowIso(),
      };
      await setDoc(ref, next);
      return { id: teamId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async getVolunteers() {
    const path = 'volunteers';
    try {
      const snap = await getDocs(collection(db, 'volunteers'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async reviewVolunteerApplication(_adminUserId, volunteerId, decision) {
    const path = `volunteers/${volunteerId}`;
    const ref = doc(db, 'volunteers', volunteerId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Volunteer record not found.');
      const cur = snap.data();
      const nextStatus = decision === 'approved' ? 'approved' : 'rejected';
      const next = { ...cur, approval_status: nextStatus, updated_at: nowIso() };
      await setDoc(ref, next);
      if (cur.user_id) {
        await pushNotification(cur.user_id, {
          title: `Volunteer Application ${nextStatus}`,
          message: `Your FloodConnect volunteer registration status has been updated to ${nextStatus}.`,
          category: 'volunteer',
          related_id: volunteerId,
        });
      }
      return { id: volunteerId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async getVolunteerTasks() {
    const path = 'volunteer_tasks';
    try {
      const snap = await getDocs(collection(db, 'volunteer_tasks'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async createVolunteerTask(adminUserId, payload) {
    const id = makeDocId('vtask');
    const path = `volunteer_tasks/${id}`;
    const record = {
      title: clampString(payload.title || 'Field Support Task', 180),
      description: clampString(payload.description || '', 1500),
      locality: clampString(payload.locality || 'Rajahmundry Urban', 120),
      priority: ['low', 'medium', 'high', 'critical'].includes(payload.priority)
        ? payload.priority
        : 'medium',
      status: 'assigned',
      assigned_volunteer_id: clampString(payload.assigned_volunteer_id || '', 128),
      assigned_user_id: clampString(payload.assigned_user_id || '', 128),
      assigned_user_name: clampString(payload.assigned_user_name || '', 140),
      progress_note: '',
      created_by: adminUserId,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    try {
      await setDoc(doc(db, 'volunteer_tasks', id), record);
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async getAllUsers() {
    const path = 'users';
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async updateUserRole(_adminUserId, targetUserId, nextRole) {
    const path = `users/${targetUserId}`;
    const ref = doc(db, 'users', targetUserId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('User not found.');
      const cur = snap.data();
      const next = { ...cur, role: nextRole, updated_at: nowIso() };
      await setDoc(ref, next);
      if (nextRole === ROLES.ADMIN) {
        await setDoc(doc(db, 'admins', targetUserId), {
          email: cur.email,
          granted_by: auth.currentUser?.uid || 'admin',
          created_at: nowIso(),
        });
      }
      return next;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // -------------------------------------------------------------------------
  // Rescue Team & Volunteer Portals
  // -------------------------------------------------------------------------
  async getMyRescueTeams(rescueUserId) {
    const path = 'rescue_teams';
    try {
      const snap = await getDocs(
        query(collection(db, 'rescue_teams'), where('leader_user_id', '==', rescueUserId))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async getAssignedEmergencyRequests(rescueUserId) {
    const path = 'emergency_requests';
    try {
      const snap = await getDocs(
        query(collection(db, 'emergency_requests'), where('assigned_responder_id', '==', rescueUserId))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async updateRescueProgress(rescueUserId, requestId, payload) {
    const path = `emergency_requests/${requestId}`;
    const ref = doc(db, 'emergency_requests', requestId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Assigned request not found.');
      const cur = snap.data();
      const nextStatus = payload.status || cur.status;
      const next = {
        ...cur,
        status: nextStatus,
        rescue_notes: clampString(payload.note || cur.rescue_notes || '', 800),
        updated_at: nowIso(),
      };
      await setDoc(ref, next);

      await writeAuditEntry({
        kind: 'rescue',
        target_id: requestId,
        target_code: cur.request_code || requestId,
        from_status: cur.status,
        to_status: nextStatus,
        changed_by: rescueUserId,
        changed_by_name: auth.currentUser?.displayName || 'Rescue Team',
        note: payload.note || `Rescue status updated to ${nextStatus}`,
      });

      if (cur.requester_id) {
        await pushNotification(cur.requester_id, {
          title: `Rescue Update (${cur.request_code})`,
          message: payload.note || `Assigned rescue team updated status to ${nextStatus}.`,
          category: 'rescue',
          related_id: requestId,
        });
      }

      return { id: requestId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async getMyRescueHistory(rescueUserId) {
    const path = 'audit_history';
    try {
      const snap = await getDocs(
        query(
          collection(db, 'audit_history'),
          where('kind', '==', 'rescue'),
          where('changed_by', '==', rescueUserId)
        )
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async getMyVolunteerRecord(userId) {
    const path = 'volunteers';
    try {
      const snap = await getDocs(query(collection(db, 'volunteers'), where('user_id', '==', userId)));
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async updateVolunteerAvailability(userId, availabilityStatus) {
    const existing = await this.getMyVolunteerRecord(userId);
    if (!existing) return null;
    const path = `volunteers/${existing.id}`;
    try {
      const next = { ...existing, availability_status: availabilityStatus, updated_at: nowIso() };
      delete next.id;
      await setDoc(doc(db, 'volunteers', existing.id), next);
      return { id: existing.id, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async getVolunteerTasksForUser(userId) {
    const path = 'volunteer_tasks';
    try {
      const snap = await getDocs(
        query(collection(db, 'volunteer_tasks'), where('assigned_user_id', '==', userId))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async respondToVolunteerTask(_userId, taskId, action, progressNote = '') {
    const path = `volunteer_tasks/${taskId}`;
    const ref = doc(db, 'volunteer_tasks', taskId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Volunteer task not found.');
      const cur = snap.data();
      const next = {
        ...cur,
        status: action,
        progress_note: clampString(progressNote || cur.progress_note || '', 600),
        updated_at: nowIso(),
      };
      await setDoc(ref, next);
      return { id: taskId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // -------------------------------------------------------------------------
  // Notifications (Realtime via Firestore onSnapshot)
  // -------------------------------------------------------------------------
  async getNotifications(userId) {
    const path = 'notifications';
    try {
      const snap = await getDocs(
        query(collection(db, 'notifications'), where('user_id', '==', userId))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  subscribeToNotifications(userId, callback) {
    if (!userId) return () => {};
    const q = query(collection(db, 'notifications'), where('user_id', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        callback(items);
      },
      (err) => {
        console.error('Notification listener error:', err);
      }
    );
  },

  async markNotificationRead(_userId, notificationId) {
    const path = `notifications/${notificationId}`;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { is_read: true });
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async markAllNotificationsRead(userId) {
    const path = 'notifications';
    try {
      const snap = await getDocs(
        query(
          collection(db, 'notifications'),
          where('user_id', '==', userId),
          where('is_read', '==', false)
        )
      );
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { is_read: true }));
      await batch.commit();
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // -------------------------------------------------------------------------
  // Official Info & Computed Admin Stats / Analytics
  // -------------------------------------------------------------------------
  async getOfficialInformation() {
    const path = 'official_info';
    try {
      const snap = await getDocs(collection(db, 'official_info'));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async createOfficialInfo(adminUserId, payload) {
    const id = makeDocId('info');
    const path = `official_info/${id}`;
    const record = {
      category: ['rainfall', 'forecast', 'river_level', 'advisory'].includes(payload.category)
        ? payload.category
        : 'advisory',
      title: clampString(payload.title || 'Official Hydro Update', 180),
      summary: clampString(payload.summary || '', 2000),
      value_reading: clampString(payload.value_reading || '', 120),
      source_name: clampString(payload.source_name || 'East Godavari Irrigation & IMD', 160),
      area: clampString(payload.area || 'East Godavari', 120),
      published_by: adminUserId,
      published_at: nowIso(),
      updated_at: nowIso(),
    };
    try {
      await setDoc(doc(db, 'official_info', id), record);
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async updateOfficialInfo(entryId, updates) {
    const path = `official_info/${entryId}`;
    const ref = doc(db, 'official_info', entryId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Official info entry not found.');
      const cur = snap.data();
      const next = { ...cur, ...updates, updated_at: nowIso() };
      await setDoc(ref, next);
      return { id: entryId, ...next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async deleteOfficialInfo(entryId) {
    const path = `official_info/${entryId}`;
    try {
      await deleteDoc(doc(db, 'official_info', entryId));
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async getAdminDashboardStats() {
    const [incidents, requests, teams, volunteers] = await Promise.all([
      this.getAllIncidents(),
      this.getAllEmergencyRequests(),
      this.getRescueTeams(),
      this.getVolunteers(),
    ]);

    return {
      totalIncidents: incidents.length,
      pendingIncidents: incidents.filter((i) => i.status === 'pending_verification').length,
      verifiedIncidents: incidents.filter((i) => i.status === 'verified').length,
      criticalIncidents: incidents.filter((i) => (i.reviewed_priority || i.severity) === 'critical').length,
      totalRequests: requests.length,
      pendingRequests: requests.filter((r) => r.status === 'pending').length,
      activeOperations: requests.filter((r) =>
        ['assigned', 'en_route', 'on_site', 'in_progress'].includes(r.status)
      ).length,
      resolvedRequests: requests.filter((r) => r.status === 'resolved').length,
      availableTeams: teams.filter((t) => t.status === 'available').length,
      totalTeams: teams.length,
      approvedVolunteers: volunteers.filter((v) => v.approval_status === 'approved').length,
      pendingVolunteers: volunteers.filter((v) => v.approval_status === 'pending').length,
    };
  },

  async getAdminAnalytics() {
    const [incidents, requests, teams] = await Promise.all([
      this.getAllIncidents(),
      this.getAllEmergencyRequests(),
      this.getRescueTeams(),
    ]);

    const byCategory = {};
    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    const byLocality = {};

    incidents.forEach((inc) => {
      byCategory[inc.category || 'other'] = (byCategory[inc.category || 'other'] || 0) + 1;
      const sev = inc.reviewed_priority || inc.severity || 'medium';
      if (bySeverity[sev] !== undefined) bySeverity[sev] += 1;
      const loc = inc.locality || 'East Godavari';
      byLocality[loc] = (byLocality[loc] || 0) + 1;
    });

    const trendsMap = {};
    requests.forEach((req) => {
      const day = String(req.created_at || nowIso()).slice(0, 10);
      if (!trendsMap[day]) trendsMap[day] = { date: day, total: 0, resolved: 0, active: 0 };
      trendsMap[day].total += 1;
      if (req.status === 'resolved') trendsMap[day].resolved += 1;
      else if (req.status !== 'cancelled') trendsMap[day].active += 1;
    });

    return {
      incidentTypeDistribution: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
      severityDistribution: Object.entries(bySeverity).map(([name, value]) => ({ name, value })),
      requestTrends: Object.values(trendsMap).sort((a, b) => a.date.localeCompare(b.date)),
      districtReports: Object.entries(byLocality).map(([locality, count]) => ({ locality, count })),
      rescueStats: {
        totalTeams: teams.length,
        availableTeams: teams.filter((t) => t.status === 'available').length,
        deployedTeams: teams.filter((t) => t.status === 'deployed').length,
        resolvedRequests: requests.filter((r) => r.status === 'resolved').length,
        activeRequests: requests.filter((r) => !['resolved', 'cancelled'].includes(r.status)).length,
      },
    };
  },

  async getPublicSummary() {
    const [incidents, shelters, alerts] = await Promise.all([
      this.getMapIncidents(),
      this.getShelters(),
      this.getActiveAlerts(),
    ]);
    return {
      verifiedIncidents: incidents.filter((i) => i.status === 'verified').length,
      openShelters: shelters.filter((s) => s.status !== 'closed').length,
      activeAlerts: alerts.length,
    };
  },

  async submitContactInquiry() {
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // Per-User Multi-Turn Gemini Assistant Chat History (Firestore)
  // -------------------------------------------------------------------------
  async getChatMessages(userId) {
    const path = `users/${userId}/chat_messages`;
    try {
      const snap = await getDocs(
        query(collection(db, 'users', userId, 'chat_messages'), orderBy('created_at', 'asc'))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async saveChatMessage(userId, { role, text, model = '' }) {
    const id = makeDocId('msg');
    const path = `users/${userId}/chat_messages/${id}`;
    const record = {
      role: role === 'model' ? 'model' : 'user',
      text: clampString(text, 8000),
      model: clampString(model, 64),
      created_at: nowIso(),
    };
    try {
      await setDoc(doc(db, 'users', userId, 'chat_messages', id), record);
      return { id, ...record };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  async clearChatMessages(userId) {
    const path = `users/${userId}/chat_messages`;
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'chat_messages'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },
};
