import { supabase } from './supabaseClient';
import { DEFAULT_DISTRICT, ROLES } from '../utils/constants';
import { computeAdminAnalytics } from '../utils/analyticsCalculator';

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or enable VITE_DEMO_MODE=true.'
    );
  }
  return supabase;
}

async function fetchProfile(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, full_name, email, phone, preferred_language, district, locality, role, volunteer_status, created_at, updated_at'
    )
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

const PUBLIC_INCIDENT_COLUMNS =
  'id, incident_code, user_id, title, description, category, location_text, locality, district, latitude, longitude, severity, reviewed_priority, status, info_origin, photo_urls, observed_at, created_at, updated_at';

export const supabaseDataLayer = {
  mode: 'supabase',

  async getSession() {
    const client = requireSupabase();
    const {
      data: { session },
      error,
    } = await client.auth.getSession();
    if (error) throw error;
    if (!session?.user) return { session: null, user: null, profile: null };
    const profile = await fetchProfile(session.user.id);
    return { session, user: session.user, profile };
  },

  onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        callback({ session: null, user: null, profile: null });
        return;
      }
      try {
        const profile = await fetchProfile(session.user.id);
        callback({ session, user: session.user, profile });
      } catch {
        callback({ session, user: session.user, profile: null });
      }
    });
    return () => subscription.unsubscribe();
  },

  async signIn({ email, password }) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    const profile = await fetchProfile(data.user.id);
    return { session: data.session, user: data.user, profile };
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
    const client = requireSupabase();
    if (accountType !== 'citizen' && accountType !== 'volunteer') {
      throw new Error('Self-registration is restricted to Citizen or Volunteer accounts.');
    }

    const safeLang = ['en', 'hi', 'te'].includes(preferredLanguage) ? preferredLanguage : 'en';

    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: fullName.trim(),
          phone: (phone || '').trim(),
          preferred_language: safeLang,
          district: (district || DEFAULT_DISTRICT).trim(),
          locality: (locality || '').trim(),
          requested_volunteer: accountType === 'volunteer',
        },
      },
    });
    if (error) throw error;

    let profile = null;
    if (data.session && data.user) {
      profile = await fetchProfile(data.user.id);
    }
    return {
      session: data.session || null,
      user: data.user,
      profile,
      needsEmailConfirmation: !data.session,
    };
  },

  async resendConfirmationEmail(email) {
    const client = requireSupabase();
    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) throw error;
    return { sent: true };
  },

  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async requestPasswordReset(email) {
    const client = requireSupabase();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
    return {
      sent: true,
      demoResetToken: null,
      message: 'If an account matches this email, a password reset link has been sent.',
    };
  },

  async resetPassword({ newPassword }) {
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { success: true };
  },

  async updateProfile(userId, updates) {
    const client = requireSupabase();
    const safeLang = ['en', 'hi', 'te'].includes(updates.preferred_language)
      ? updates.preferred_language
      : 'en';
    const { data, error } = await client
      .from('profiles')
      .update({
        full_name: updates.full_name?.trim() ?? '',
        phone: updates.phone?.trim() ?? '',
        preferred_language: safeLang,
        district: updates.district?.trim() || DEFAULT_DISTRICT,
        locality: updates.locality?.trim() ?? '',
      })
      .eq('id', userId)
      .select(
        'id, full_name, email, phone, preferred_language, district, locality, role, volunteer_status, created_at, updated_at'
      )
      .single();
    if (error) throw error;
    return data;
  },

  // =========================================================================
  // STAGE 2: CITIZEN & PUBLIC DATA
  // =========================================================================

  async uploadIncidentPhoto(userId, file) {
    const client = requireSupabase();
    if (!file) return null;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, or WebP images are supported.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Photo must be 5 MB or smaller.');
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const { error: uploadError } = await client.storage
      .from('incident-photos')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = client.storage.from('incident-photos').getPublicUrl(path);
    return { url: publicUrlData.publicUrl, storageMode: 'supabase_storage', fileName: file.name };
  },

  async createIncident(userId, payload) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('incidents')
      .insert({
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
        status: 'pending_verification',
        info_origin: 'citizen_submitted',
        contact_phone: (payload.contact_phone || '').trim(),
        photo_urls: Array.isArray(payload.photo_urls) ? payload.photo_urls : [],
        observed_at: payload.observed_at || new Date().toISOString(),
      })
      .select(PUBLIC_INCIDENT_COLUMNS)
      .single();
    if (error) throw error;

    // Insert self-confirmation notification (non-blocking)
    await client.from('notifications').insert({
      user_id: userId,
      title: `Incident ${data.incident_code} Submitted`,
      message: `Your flood report in ${data.locality} is queued for District Admin verification.`,
      type: 'incident_update',
      related_entity_type: 'incident',
      related_entity_id: data.id,
    });

    return data;
  },

  async getMyIncidents(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('incidents')
      .select(PUBLIC_INCIDENT_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getMapIncidents({ userId = null, role = null } = {}) {
    const client = requireSupabase();
    let query = client
      .from('incidents')
      .select(PUBLIC_INCIDENT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(200);

    if (role !== ROLES.ADMIN) {
      if (userId) {
        query = query.or(`status.eq.verified,user_id.eq.${userId}`);
      } else {
        query = query.eq('status', 'verified');
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((item) => ({
      ...item,
      isOwnReport: Boolean(userId && item.user_id === userId),
    }));
  },

  async createEmergencyRequest(userId, payload) {
    const client = requireSupabase();
    const childrenCount = Math.max(0, Number(payload.children_count || 0));
    const elderlyCount = Math.max(0, Number(payload.elderly_count || 0));
    const { data, error } = await client
      .from('emergency_requests')
      .insert({
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
        status: 'pending',
        info_origin: 'citizen_submitted',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getMyEmergencyRequests(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('emergency_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async cancelEmergencyRequest(userId, requestId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('emergency_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getShelters() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('shelters')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getActiveAlerts() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('alerts')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false });
    if (error) throw error;
    const now = Date.now();
    return (data || []).filter((a) => !a.expires_at || new Date(a.expires_at).getTime() >= now);
  },

  async getNotifications(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  async markNotificationRead(userId, notificationId) {
    const client = requireSupabase();
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  },

  async markAllNotificationsRead(userId) {
    const client = requireSupabase();
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return true;
  },

  // =========================================================================
  // STAGE 3: ADMIN COMMAND OPERATIONS
  // =========================================================================

  async getAdminDashboardStats() {
    const client = requireSupabase();
    const [incRes, reqRes, teamRes, volRes, alertRes, shelterRes] = await Promise.all([
      client.from('incidents').select('status, severity, reviewed_priority'),
      client.from('emergency_requests').select('status'),
      client.from('rescue_teams').select('status'),
      client.from('volunteers').select('approval_status'),
      client.from('alerts').select('id, is_active, expires_at').eq('is_active', true),
      client.from('shelters').select('status'),
    ]);

    const incidents = incRes.data || [];
    const requests = reqRes.data || [];
    const teams = teamRes.data || [];
    const volunteers = volRes.data || [];
    const now = Date.now();
    const alerts = (alertRes.data || []).filter(
      (a) => !a.expires_at || new Date(a.expires_at).getTime() >= now
    );
    const shelters = shelterRes.data || [];

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
    const client = requireSupabase();
    const { data, error } = await client
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateIncidentAdmin(adminUserId, incidentId, updates, reasonNote = '') {
    const client = requireSupabase();
    const { data: current, error: fetchErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();
    if (fetchErr) throw fetchErr;

    const nextStatus = updates.status ?? current.status;
    const nowIso = new Date().toISOString();

    const { data, error } = await client
      .from('incidents')
      .update({
        title: updates.title?.trim() ?? current.title,
        description: updates.description?.trim() ?? current.description,
        category: updates.category ?? current.category,
        locality: updates.locality?.trim() ?? current.locality,
        location_text: updates.location_text?.trim() ?? current.location_text,
        severity: updates.severity ?? current.severity,
        reviewed_priority:
          updates.reviewed_priority !== undefined
            ? updates.reviewed_priority || null
            : current.reviewed_priority,
        status: nextStatus,
        info_origin: nextStatus === 'verified' ? 'admin_verified' : current.info_origin,
        verified_by: nextStatus === 'verified' ? adminUserId : current.verified_by,
        verified_at: nextStatus === 'verified' ? nowIso : current.verified_at,
      })
      .eq('id', incidentId)
      .select('*')
      .single();
    if (error) throw error;

    if (reasonNote.trim()) {
      await client.from('incident_verification_history').insert({
        incident_id: incidentId,
        changed_by: adminUserId,
        previous_status: current.status,
        new_status: data.status,
        previous_priority: current.reviewed_priority,
        new_priority: data.reviewed_priority,
        notes: reasonNote.trim(),
      });
    }

    if (nextStatus !== current.status) {
      await client.from('notifications').insert({
        user_id: data.user_id,
        title: `Incident ${data.incident_code} ${nextStatus.replace('_', ' ')}`,
        message: reasonNote.trim()
          ? `Status updated: ${reasonNote.trim()}`
          : `District Control updated your incident report status to ${nextStatus.replace('_', ' ')}.`,
        type: 'incident_update',
        related_entity_type: 'incident',
        related_entity_id: data.id,
      });
    }

    return data;
  },

  async getIncidentVerificationHistory() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('incident_verification_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async getAllEmergencyRequests() {
    const client = requireSupabase();
    const [reqRes, teamRes] = await Promise.all([
      client.from('emergency_requests').select('*').order('created_at', { ascending: false }),
      client.from('rescue_teams').select('id, name, team_code'),
    ]);
    if (reqRes.error) throw reqRes.error;
    const teamMap = new Map((teamRes.data || []).map((t) => [t.id, `${t.name} (${t.team_code})`]));
    return (reqRes.data || []).map((r) => ({
      ...r,
      assigned_team_name: r.assigned_team_id ? teamMap.get(r.assigned_team_id) || null : null,
    }));
  },

  async updateEmergencyRequestAdmin(adminUserId, requestId, updates, note = '') {
    const client = requireSupabase();
    const { data: current, error: fetchErr } = await client
      .from('emergency_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (fetchErr) throw fetchErr;

    let nextStatus = updates.status ?? current.status;
    const assignedTeamId =
      updates.assigned_team_id !== undefined ? updates.assigned_team_id : current.assigned_team_id;
    if (assignedTeamId && (nextStatus === 'pending' || nextStatus === 'verified')) {
      nextStatus = 'assigned';
    }

    const { data, error } = await client
      .from('emergency_requests')
      .update({
        status: nextStatus,
        reviewed_priority:
          updates.reviewed_priority !== undefined
            ? updates.reviewed_priority || null
            : current.reviewed_priority,
        assigned_team_id: assignedTeamId || null,
        verified_by:
          nextStatus === 'verified' || nextStatus === 'assigned'
            ? current.verified_by || adminUserId
            : current.verified_by,
        resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : current.resolved_at,
      })
      .eq('id', requestId)
      .select('*')
      .single();
    if (error) throw error;

    if (assignedTeamId && assignedTeamId !== current.assigned_team_id) {
      await client.from('rescue_assignments').insert({
        emergency_request_id: requestId,
        rescue_team_id: assignedTeamId,
        assigned_by: adminUserId,
        status: 'assigned',
        notes: note.trim(),
      });
      const { data: team } = await client
        .from('rescue_teams')
        .select('id, name, team_code, lead_user_id')
        .eq('id', assignedTeamId)
        .single();
      if (team?.lead_user_id) {
        await client.from('notifications').insert({
          user_id: team.lead_user_id,
          title: `Dispatch Assigned: ${data.request_code}`,
          message: `${data.people_count} residents in ${data.locality}. Open Assigned Rescues for details.`,
          type: 'assignment',
          related_entity_type: 'emergency_request',
          related_entity_id: data.id,
        });
      }
    }

    if (nextStatus !== current.status) {
      await client.from('notifications').insert({
        user_id: data.user_id,
        title: `Emergency ${data.request_code}: ${nextStatus.replaceAll('_', ' ')}`,
        message: note.trim() || `Status updated to ${nextStatus.replaceAll('_', ' ')}.`,
        type: 'emergency_update',
        related_entity_type: 'emergency_request',
        related_entity_id: data.id,
      });
    }

    return data;
  },

  async getRescueStatusHistory(requestId = null) {
    const client = requireSupabase();
    let query = client
      .from('rescue_status_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (requestId) query = query.eq('emergency_request_id', requestId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getRescueTeams() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('rescue_teams')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createRescueTeam(payload) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('rescue_teams')
      .insert({
        team_code: payload.team_code.trim(),
        name: payload.name.trim(),
        team_type: payload.team_type || 'boat_rescue',
        base_location: payload.base_location.trim(),
        district: (payload.district || DEFAULT_DISTRICT).trim(),
        capacity: Math.max(1, Number(payload.capacity || 6)),
        equipment_summary: (payload.equipment_summary || '').trim(),
        status: payload.status || 'available',
        lead_user_id: payload.lead_user_id || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateRescueTeam(teamId, updates) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('rescue_teams')
      .update(updates)
      .eq('id', teamId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getVolunteers() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('volunteers')
      .select('*, profiles(full_name, email, phone, locality)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((v) => ({
      ...v,
      full_name: v.profiles?.full_name || '',
      email: v.profiles?.email || '',
      phone: v.profiles?.phone || '',
      locality: v.profiles?.locality || v.locality,
    }));
  },

  async reviewVolunteerApplication(adminUserId, volunteerId, decision) {
    const client = requireSupabase();
    const nowIso = new Date().toISOString();
    const { data: vol, error } = await client
      .from('volunteers')
      .update({
        approval_status: decision,
        availability_status: decision === 'approved' ? 'available' : 'offline',
        approved_by: adminUserId,
        approved_at: decision === 'approved' ? nowIso : null,
      })
      .eq('id', volunteerId)
      .select('*')
      .single();
    if (error) throw error;

    await client
      .from('profiles')
      .update({
        role: decision === 'approved' ? ROLES.VOLUNTEER : ROLES.CITIZEN,
        volunteer_status: decision,
      })
      .eq('id', vol.user_id);

    await client.from('notifications').insert({
      user_id: vol.user_id,
      title:
        decision === 'approved'
          ? 'Volunteer Application Approved'
          : 'Volunteer Application Not Approved',
      message:
        decision === 'approved'
          ? 'District Control approved your volunteer account.'
          : 'Your volunteer application was not approved at this time.',
      type: 'approval',
      related_entity_type: 'volunteer',
      related_entity_id: vol.id,
    });
    return vol;
  },

  async getVolunteerTasks() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('volunteer_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createVolunteerTask(adminUserId, payload) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('volunteer_tasks')
      .insert({
        title: payload.title.trim(),
        description: payload.description.trim(),
        task_type: payload.task_type || 'field_support',
        locality: payload.locality.trim(),
        shelter_id: payload.shelter_id || null,
        assigned_volunteer_id: payload.assigned_volunteer_id || null,
        created_by: adminUserId,
        priority: payload.priority || 'medium',
        status: payload.assigned_volunteer_id ? 'assigned' : 'open',
        due_at: payload.due_at || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getAllAlerts() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('alerts')
      .select('*')
      .order('published_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createAlert(adminUserId, payload) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('alerts')
      .insert({
        title: payload.title.trim(),
        message: payload.message.trim(),
        severity: payload.severity || 'medium',
        info_origin:
          payload.info_origin === 'official_government' ? 'official_government' : 'admin_verified',
        source_agency: payload.source_agency.trim(),
        published_at: payload.published_at || new Date().toISOString(),
        expires_at: payload.expires_at || null,
        affected_localities: Array.isArray(payload.affected_localities)
          ? payload.affected_localities
          : [],
        is_active: true,
        created_by: adminUserId,
      })
      .select('*')
      .single();
    if (error) throw error;

    // Notify users about published alert (non-blocking best-effort fan-out)
    const { data: allProfiles } = await client.from('profiles').select('id').limit(250);
    if (Array.isArray(allProfiles) && allProfiles.length > 0) {
      const originText =
        data.info_origin === 'official_government' ? 'Official Alert' : 'Admin-issued Alert';
      await client.from('notifications').insert(
        allProfiles.map((p) => ({
          user_id: p.id,
          title: `${originText}: ${data.title}`,
          message: `${data.source_agency} (${data.severity.toUpperCase()}): ${data.message}`,
          type: 'alert',
          related_entity_type: 'alert',
          related_entity_id: data.id,
        }))
      );
    }

    return data;
  },

  async updateAlert(alertId, updates) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('alerts')
      .update(updates)
      .eq('id', alertId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async createShelter(adminUserId, payload) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('shelters')
      .insert({
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
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateShelter(adminUserId, shelterId, updates) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('shelters')
      .update({ ...updates, updated_by: adminUserId })
      .eq('id', shelterId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteShelter(shelterId) {
    const client = requireSupabase();
    const { error } = await client.from('shelters').delete().eq('id', shelterId);
    if (error) throw error;
    return true;
  },

  async getAllUsers() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .select(
        'id, full_name, email, phone, preferred_language, district, locality, role, volunteer_status, created_at, updated_at'
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateUserRole(adminUserId, targetUserId, nextRole) {
    if (adminUserId === targetUserId && nextRole !== ROLES.ADMIN) {
      throw new Error('You cannot remove your own Administrator role while signed in.');
    }
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .update({
        role: nextRole,
        ...(nextRole === ROLES.VOLUNTEER ? { volunteer_status: 'approved' } : {}),
      })
      .eq('id', targetUserId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // =========================================================================
  // STAGE 3: RESCUE TEAM OPERATIONS
  // =========================================================================

  async getMyRescueTeams(rescueUserId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('rescue_teams')
      .select('*')
      .eq('lead_user_id', rescueUserId);
    if (error) throw error;
    return data || [];
  },

  async getAssignedEmergencyRequests(_rescueUserId) {
    const client = requireSupabase();
    // RLS strictly filters emergency_requests to those assigned to this rescue lead's team
    const { data, error } = await client
      .from('emergency_requests')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateRescueProgress(_rescueUserId, requestId, { nextStatus, assignmentStatus, notes = '' }) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('emergency_requests')
      .update({
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      })
      .eq('id', requestId)
      .select('*')
      .single();
    if (error) throw error;

    if (assignmentStatus || notes.trim()) {
      await client
        .from('rescue_assignments')
        .update({
          ...(assignmentStatus ? { status: assignmentStatus } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        })
        .eq('emergency_request_id', requestId);
    }

    // Notify citizen about live rescue progress / resolution
    if (data?.user_id) {
      const statusLabel = (nextStatus || data.status || '').replaceAll('_', ' ');
      await client.from('notifications').insert({
        user_id: data.user_id,
        title: `Rescue Update for ${data.request_code}`,
        message:
          nextStatus === 'resolved'
            ? `Your rescue team marked ${data.request_code} as Resolved.${notes.trim() ? ` Note: ${notes.trim()}` : ''}`
            : `Rescue status: ${statusLabel}.${notes.trim() ? ` Note: ${notes.trim()}` : ''}`,
        type: 'emergency_update',
        related_entity_type: 'emergency_request',
        related_entity_id: data.id,
      });
    }

    return data;
  },

  async getMyRescueHistory(_rescueUserId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('rescue_status_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  // =========================================================================
  // STAGE 3: VOLUNTEER OPERATIONS
  // =========================================================================

  async getMyVolunteerRecord(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('volunteers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateVolunteerAvailability(userId, availabilityStatus) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('volunteers')
      .update({ availability_status: availabilityStatus })
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getVolunteerTasksForUser(_userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('volunteer_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async respondToVolunteerTask(userId, taskId, action) {
    const client = requireSupabase();
    const myVol = await this.getMyVolunteerRecord(userId);
    if (!myVol || myVol.approval_status !== 'approved') {
      throw new Error('Only approved volunteers can update tasks.');
    }

    const patch =
      action === 'accept'
        ? { assigned_volunteer_id: myVol.id, status: 'assigned' }
        : action === 'decline'
        ? { assigned_volunteer_id: null, status: 'open' }
        : action === 'start'
        ? { status: 'in_progress' }
        : { status: 'completed' };

    const { data, error } = await client
      .from('volunteer_tasks')
      .update(patch)
      .eq('id', taskId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // =========================================================================
  // STAGE 4: REALTIME NOTIFICATIONS, ANALYTICS & OFFICIAL INFORMATION
  // =========================================================================

  subscribeToNotifications(userId, callback) {
    if (!supabase || !userId) return () => {};
    const channel = supabase
      .channel(`fc-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType,
            new: payload.new || null,
            old: payload.old || null,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async getAdminAnalytics() {
    const client = requireSupabase();
    const [incRes, reqRes, teamRes] = await Promise.all([
      client
        .from('incidents')
        .select('id, category, severity, reviewed_priority, status, district, locality, created_at'),
      client
        .from('emergency_requests')
        .select('id, status, people_count, district, locality, created_at'),
      client.from('rescue_teams').select('id, status'),
    ]);
    if (incRes.error) throw incRes.error;
    if (reqRes.error) throw reqRes.error;
    if (teamRes.error) throw teamRes.error;

    return computeAdminAnalytics({
      incidents: incRes.data || [],
      emergencyRequests: reqRes.data || [],
      rescueTeams: teamRes.data || [],
    });
  },

  async getOfficialInformation({ includeInactive = false } = {}) {
    const client = requireSupabase();
    let query = client
      .from('official_information')
      .select('*')
      .order('published_at', { ascending: false });
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    const now = Date.now();
    return (data || []).filter((item) => {
      if (includeInactive) return true;
      if (item.expires_at && new Date(item.expires_at).getTime() < now) return false;
      return true;
    });
  },

  async createOfficialInfo(adminUserId, payload) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('official_information')
      .insert({
        category: payload.category || 'rainfall',
        title: payload.title.trim(),
        metric_value: (payload.metric_value || '').trim(),
        station_or_area: (payload.station_or_area || DEFAULT_DISTRICT).trim(),
        summary: payload.summary.trim(),
        source_agency: payload.source_agency.trim(),
        published_at: payload.published_at || new Date().toISOString(),
        expires_at: payload.expires_at || null,
        is_active: true,
        info_origin: 'official_government',
        created_by: adminUserId,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateOfficialInfo(entryId, updates) {
    const client = requireSupabase();
    const { data, error } = await client
      .from('official_information')
      .update(updates)
      .eq('id', entryId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteOfficialInfo(entryId) {
    const client = requireSupabase();
    const { error } = await client.from('official_information').delete().eq('id', entryId);
    if (error) throw error;
    return true;
  },

  // =========================================================================
  // PUBLIC SUMMARY & CONTACT
  // =========================================================================

  async getPublicSummary() {
    const client = requireSupabase();
    const [incidentsRes, sheltersRes, alertsRes] = await Promise.all([
      client
        .from('incidents')
        .select(
          'id, incident_code, title, locality, severity, reviewed_priority, status, info_origin, created_at'
        )
        .eq('status', 'verified')
        .order('created_at', { ascending: false })
        .limit(20),
      client
        .from('shelters')
        .select('id, name, locality, capacity, current_occupancy, status, info_origin')
        .order('updated_at', { ascending: false }),
      client.from('alerts').select('id').eq('is_active', true),
    ]);

    const incidents = incidentsRes.data || [];
    const shelters = sheltersRes.data || [];
    const alerts = alertsRes.data || [];

    return {
      isDemo: false,
      liveOfficialDataAvailable: alerts.length > 0,
      officialDataMessage:
        alerts.length > 0
          ? `${alerts.length} active official or admin-issued alert(s) published.`
          : 'Live official data is currently unavailable.',
      verifiedIncidents: incidents.length,
      pendingIncidents: null,
      openShelters: shelters.filter((s) => s.status === 'open' || s.status === 'near_capacity')
        .length,
      totalShelterCapacity: shelters.reduce((sum, s) => sum + (s.capacity || 0), 0),
      totalShelterOccupancy: shelters.reduce((sum, s) => sum + (s.current_occupancy || 0), 0),
      activeRescueTeams: null,
      activeEmergenciesCount: null,
      activeOfficialAlerts: alerts.length,
      sampleRecordsPreview: {
        verifiedIncidents: incidents.slice(0, 5),
        shelters: shelters.slice(0, 5),
      },
    };
  },

  async submitContactInquiry(payload) {
    return { id: `contact-${Date.now()}`, ...payload, submittedAt: new Date().toISOString() };
  },

  getDemoAccountsList() {
    return [];
  },
};
