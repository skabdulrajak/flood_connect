import i18n, { getIntlLocale } from '../i18n';

export const ROLES = Object.freeze({
  CITIZEN: 'citizen',
  VOLUNTEER: 'volunteer',
  RESCUE_TEAM: 'rescue_team',
  ADMIN: 'admin',
});

export const ROLE_META = Object.freeze({
  citizen: {
    label: 'Citizen',
    shortLabel: 'Citizen',
    dashboardPath: '/dashboard/citizen',
    description: 'Report flood incidents, request emergency rescue, and track official alerts and nearby relief shelters.',
  },
  volunteer: {
    label: 'Volunteer',
    shortLabel: 'Volunteer',
    dashboardPath: '/dashboard/volunteer',
    description: 'Support community coordination, shelter registration, and field verification tasks once approved by an Admin.',
  },
  rescue_team: {
    label: 'Rescue Team',
    shortLabel: 'Rescue Team',
    dashboardPath: '/dashboard/rescue',
    description: 'Receive assigned emergency dispatch tickets, view protected rescue coordinates, and update live rescue progress.',
  },
  admin: {
    label: 'District Admin',
    shortLabel: 'Admin',
    dashboardPath: '/dashboard/admin',
    description: 'Verify citizen reports, triage emergencies, dispatch rescue units, approve volunteers, and publish official bulletins.',
  },
});

export function getRoleMeta(role) {
  const base = ROLE_META[role] || ROLE_META.citizen;
  const roleKey = ROLE_META[role] ? role : 'citizen';
  const descKeyMap = {
    citizen: 'landing.roleCitizenDesc',
    volunteer: 'landing.roleVolunteerDesc',
    rescue_team: 'landing.roleRescueDesc',
    admin: 'landing.roleAdminDesc',
  };
  const label = i18n.t(`nav.roles.${roleKey}`, { defaultValue: base.label });
  return {
    ...base,
    label,
    shortLabel: label,
    description: i18n.t(descKeyMap[roleKey], { defaultValue: base.description }),
  };
}

export const INCIDENT_STATUSES = Object.freeze({
  queued_offline: { label: 'Queued Offline (Auto-Sync)', tone: 'orange' },
  pending_verification: { label: 'Pending Verification', tone: 'amber' },
  verified: { label: 'Verified', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'slate' },
  duplicate: { label: 'Duplicate', tone: 'slate' },
});

export const EMERGENCY_STATUSES = Object.freeze({
  pending: { label: 'Pending Triage', tone: 'amber' },
  verified: { label: 'Verified', tone: 'teal' },
  assigned: { label: 'Team Assigned', tone: 'navy' },
  rescue_in_progress: { label: 'Rescue In Progress', tone: 'orange' },
  resolved: { label: 'Resolved', tone: 'green' },
  closed: { label: 'Closed', tone: 'slate' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
});

export const SEVERITY_LEVELS = Object.freeze({
  low: { label: 'Low', tone: 'slate' },
  medium: { label: 'Medium', tone: 'amber' },
  high: { label: 'High', tone: 'orange' },
  critical: { label: 'Critical', tone: 'red' },
});

export function getStatusMeta(status, kind = 'incident') {
  const map = kind === 'emergency' ? EMERGENCY_STATUSES : INCIDENT_STATUSES;
  const base = map[status] || { label: status || i18n.t('common.unknown'), tone: 'slate' };
  const key = kind === 'emergency' && status === 'pending' ? 'emergency.steps.pending' : `status.${status}`;
  return {
    ...base,
    label: i18n.t(key, { defaultValue: base.label }),
  };
}

export function getSeverityMeta(severity) {
  const key = severity === 'moderate' ? 'medium' : severity;
  const base = SEVERITY_LEVELS[key] || { label: severity || i18n.t('common.unknown'), tone: 'slate' };
  const i18nKey = severity === 'medium' ? 'severity.moderate' : `severity.${severity}`;
  return {
    ...base,
    label: i18n.t(i18nKey, { defaultValue: base.label }),
  };
}

export const INFO_ORIGINS = Object.freeze({
  citizen_submitted: {
    label: 'Citizen-submitted',
    description: 'Submitted by a community member; unverified until reviewed by an authorized administrator.',
  },
  admin_verified: {
    label: 'Admin-verified',
    description: 'Reviewed and confirmed by a FloodConnect District Administrator.',
  },
  official_government: {
    label: 'Official / Government',
    description: 'Published directly from an authorized government or disaster management authority with source & timestamp.',
  },
  ai_suggested: {
    label: 'AI-suggested',
    description: 'Draft suggestion generated to assist human triage. AI never verifies incidents or dispatches teams.',
  },
});

export function getInfoOriginMeta(origin) {
  const base = INFO_ORIGINS[origin] || INFO_ORIGINS.citizen_submitted;
  const keyMap = {
    citizen_submitted: 'alerts.originCitizen',
    admin_verified: 'alerts.originAdminVerified',
    official_government: 'alerts.originOfficial',
    ai_suggested: 'common.aiSuggested',
  };
  return {
    ...base,
    label: i18n.t(keyMap[origin] || 'alerts.originCitizen', { defaultValue: base.label }),
  };
}

export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
]);

export const DEFAULT_DISTRICT = 'East Godavari';

export const EAST_GODAVARI_LOCALITIES = Object.freeze([
  'Rajahmundry Urban',
  'Rajahmundry Rural',
  'Dowleswaram',
  'Kadiam',
  'Korukonda',
  'Anaparthi',
  'Kovvur',
  'Rajanagaram',
  'Gokavaram',
  'Tallapudi',
  'Peravali',
  'Nidadavole',
  'Chagallu',
  'Biccavolu',
  'Rangampeta',
  'Seethanagaram',
  'Kotipalli Ferry Road',
]);

export const EAST_GODAVARI_CENTER = Object.freeze({
  lat: 17.0005,
  lng: 81.804,
  zoom: 11,
});

export const EAST_GODAVARI_COORDS = Object.freeze({
  'Rajahmundry Urban': { lat: 17.0005, lng: 81.804 },
  'Rajahmundry Rural': { lat: 17.0321, lng: 81.8125 },
  Dowleswaram: { lat: 16.9408, lng: 81.7785 },
  Kadiam: { lat: 16.9154, lng: 81.8251 },
  Korukonda: { lat: 17.1724, lng: 81.8305 },
  Anaparthi: { lat: 16.9355, lng: 81.9462 },
  Kovvur: { lat: 17.0112, lng: 81.7276 },
  Rajanagaram: { lat: 17.0793, lng: 81.9032 },
  Gokavaram: { lat: 17.2602, lng: 81.8481 },
  Tallapudi: { lat: 17.1169, lng: 81.6524 },
  Peravali: { lat: 16.7524, lng: 81.7372 },
  Nidadavole: { lat: 16.9041, lng: 81.6716 },
  Chagallu: { lat: 16.9794, lng: 81.6589 },
  Biccavolu: { lat: 16.9598, lng: 82.0548 },
  Rangampeta: { lat: 17.0641, lng: 82.0252 },
  Seethanagaram: { lat: 17.1489, lng: 81.7164 },
  'Kotipalli Ferry Road': { lat: 16.9685, lng: 81.7691 },
});

export const INCIDENT_CATEGORIES = Object.freeze([
  { value: 'residential_flooding', label: 'Residential Flooding' },
  { value: 'road_waterlogging', label: 'Road Waterlogging' },
  { value: 'bridge_blockage', label: 'Bridge / Causeway Blockage' },
  { value: 'embankment_breach', label: 'Embankment / Canal Overflow' },
  { value: 'drainage_overflow', label: 'Drainage / Culvert Overflow' },
  { value: 'power_or_utility_hazard', label: 'Power or Utility Hazard' },
  { value: 'other', label: 'Other Flood Hazard' },
]);

export function getIncidentCategories() {
  return INCIDENT_CATEGORIES.map((cat) => ({
    value: cat.value,
    label: getIncidentCategoryLabel(cat.value),
  }));
}

export function getIncidentCategoryLabel(value) {
  const key = value === 'power_or_utility_hazard' ? 'power_hazard' : value;
  const fallback = INCIDENT_CATEGORIES.find((c) => c.value === value)?.label || value;
  return i18n.t(`incident.categories.${key}`, { defaultValue: fallback });
}

export const EMERGENCY_TRACKER_STEPS = Object.freeze([
  { key: 'pending', label: 'Pending', description: 'Logged for district triage' },
  { key: 'verified', label: 'Verified', description: 'Confirmed by control room' },
  { key: 'assigned', label: 'Assigned', description: 'Rescue team dispatched' },
  { key: 'rescue_in_progress', label: 'In Progress', description: 'Team en route / on site' },
  { key: 'resolved', label: 'Resolved', description: 'Residents evacuated / safe' },
  { key: 'closed', label: 'Closed', description: 'Case finalized & archived' },
]);

export function getEmergencyTrackerSteps() {
  return EMERGENCY_TRACKER_STEPS.map((step) => ({
    key: step.key,
    label: i18n.t(`emergency.steps.${step.key}`, {
      defaultValue: i18n.t(`status.${step.key}`, { defaultValue: step.label }),
    }),
    description: i18n.t(`emergency.stepDescriptions.${step.key}`, {
      defaultValue: step.description,
    }),
  }));
}

export const OFFICIAL_EMERGENCY_HELPLINES = Object.freeze([
  { number: '112', label: 'National Emergency (ERSS)', note: 'All-in-one police, fire & rescue' },
  { number: '108', label: 'Emergency Ambulance', note: 'Medical evacuation & trauma' },
  { number: '101', label: 'Fire & Rescue Services', note: 'Flood rescue & structural hazards' },
  { number: '1077', label: 'District Control Room', note: 'East Godavari Collectorate desk' },
]);

export function getOfficialEmergencyHelplines() {
  return [
    {
      number: '112',
      label: i18n.t('common.helplineNationalEmergency'),
      note: i18n.t('emergency.helplineNote112', { defaultValue: 'All-in-one police, fire & rescue' }),
    },
    {
      number: '108',
      label: i18n.t('common.helplineMedicalAmbulance'),
      note: i18n.t('emergency.helplineNote108', { defaultValue: 'Medical evacuation & trauma' }),
    },
    {
      number: '101',
      label: i18n.t('common.helplineFireRescue'),
      note: i18n.t('emergency.helplineNote101', { defaultValue: 'Flood rescue & structural hazards' }),
    },
    {
      number: '1077',
      label: i18n.t('common.helplineDistrictControl'),
      note: i18n.t('emergency.helplineNote1077', { defaultValue: 'East Godavari Collectorate desk' }),
    },
  ];
}

export const HERO_MEDIA = Object.freeze({
  hero: '/src/assets/images/hero_godavari_response_1795071226110.jpg',
  fieldBridge: '/src/assets/images/field_coordination_bridge_1795071175109.jpg',
  shelterOps: '/src/assets/images/community_shelter_ops_1795071229932.jpg',
});

export function getDashboardPathForRole(role) {
  return ROLE_META[role]?.dashboardPath || '/dashboard/citizen';
}

export function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value ?? '0');
  return new Intl.NumberFormat(getIntlLocale(i18n.language)).format(num);
}

export function formatTimestamp(isoString) {
  if (!isoString) return i18n.t('common.unavailable');
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat(getIntlLocale(i18n.language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
