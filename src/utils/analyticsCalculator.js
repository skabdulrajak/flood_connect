import i18n, { getIntlLocale } from '../i18n';
import { getIncidentCategoryLabel, getSeverityMeta } from './constants';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#F28C28',
  medium: '#D97706',
  low: '#13A89E',
};

const RESCUE_STATUS_ORDER = [
  'pending',
  'verified',
  'assigned',
  'rescue_in_progress',
  'resolved',
  'closed',
  'cancelled',
];

function toDayKey(isoString) {
  if (!isoString) return 'Unknown';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(dayKey) {
  if (dayKey === 'Unknown') return i18n.t('common.unknown');
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return new Intl.DateTimeFormat(getIntlLocale(i18n.language), {
    day: '2-digit',
    month: 'short',
  }).format(d);
}

/**
 * Pure analytics computation from real stored FloodConnect records.
 * Never fabricates data points; returns empty series when records are absent.
 */
export function computeAdminAnalytics({ incidents = [], emergencyRequests = [], rescueTeams = [] }) {
  // 1. Incident Type Distribution
  const typeCounts = {};
  incidents.forEach((inc) => {
    const key = inc.category || 'other';
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });
  const incidentTypeDistribution = Object.entries(typeCounts)
    .map(([category, count]) => ({
      category,
      name: getIncidentCategoryLabel(category),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // 2. Severity Distribution (uses reviewed_priority if set by Admin, else reporter severity)
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  incidents.forEach((inc) => {
    const sev = inc.reviewed_priority || inc.severity || 'medium';
    if (sevCounts[sev] !== undefined) sevCounts[sev] += 1;
  });
  const severityDistribution = SEVERITY_ORDER.map((key) => ({
    key,
    name: getSeverityMeta(key).label,
    count: sevCounts[key],
    color: SEVERITY_COLORS[key],
  })).filter((entry) => entry.count > 0);

  // 3. Request & Incident Trends Over Time (grouped by calendar day)
  const dayBuckets = {};
  incidents.forEach((inc) => {
    const key = toDayKey(inc.created_at);
    if (!dayBuckets[key]) dayBuckets[key] = { dayKey: key, incidents: 0, emergencyRequests: 0 };
    dayBuckets[key].incidents += 1;
  });
  emergencyRequests.forEach((req) => {
    const key = toDayKey(req.created_at);
    if (!dayBuckets[key]) dayBuckets[key] = { dayKey: key, incidents: 0, emergencyRequests: 0 };
    dayBuckets[key].emergencyRequests += 1;
  });
  const trendsOverTime = Object.values(dayBuckets)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .map((bucket) => ({
      date: formatDayLabel(bucket.dayKey),
      dayKey: bucket.dayKey,
      incidents: bucket.incidents,
      emergencyRequests: bucket.emergencyRequests,
    }));

  // 4. Rescue Stats (by emergency request status & team readiness)
  const rescueStatusCounts = {};
  RESCUE_STATUS_ORDER.forEach((st) => {
    rescueStatusCounts[st] = 0;
  });
  let totalPeopleRequested = 0;
  let peopleResolved = 0;
  emergencyRequests.forEach((req) => {
    const st = req.status || 'pending';
    rescueStatusCounts[st] = (rescueStatusCounts[st] || 0) + 1;
    const people = Number(req.people_count || 0);
    totalPeopleRequested += people;
    if (st === 'resolved' || st === 'closed') {
      peopleResolved += people;
    }
  });

  const rescueStatusDistribution = RESCUE_STATUS_ORDER.map((st) => ({
    status: st,
    name: i18n.t(`status.${st}`, { defaultValue: st }),
    count: rescueStatusCounts[st] || 0,
  }));

  const teamReadiness = ['available', 'deployed', 'standby', 'offline'].map((status) => ({
    status,
    name: i18n.t(`status.${status}`, {
      defaultValue: status.charAt(0).toUpperCase() + status.slice(1),
    }),
    count: rescueTeams.filter((t) => t.status === status).length,
  }));

  const resolvedCount = (rescueStatusCounts.resolved || 0) + (rescueStatusCounts.closed || 0);
  const activeCount = (rescueStatusCounts.assigned || 0) + (rescueStatusCounts.rescue_in_progress || 0);
  const resolutionRate =
    emergencyRequests.length > 0
      ? Math.round((resolvedCount / emergencyRequests.length) * 100)
      : 0;

  // 5. District-wise & Locality-wise Reports
  const districtMap = {};
  const localityMap = {};
  const unspecifiedLabel = i18n.t('common.unspecified');

  incidents.forEach((inc) => {
    const dist = inc.district || 'East Godavari';
    const loc = inc.locality || unspecifiedLabel;
    if (!districtMap[dist]) districtMap[dist] = { name: dist, incidents: 0, requests: 0 };
    districtMap[dist].incidents += 1;

    if (!localityMap[loc]) localityMap[loc] = { name: loc, incidents: 0, requests: 0 };
    localityMap[loc].incidents += 1;
  });

  emergencyRequests.forEach((req) => {
    const dist = req.district || 'East Godavari';
    const loc = req.locality || unspecifiedLabel;
    if (!districtMap[dist]) districtMap[dist] = { name: dist, incidents: 0, requests: 0 };
    districtMap[dist].requests += 1;

    if (!localityMap[loc]) localityMap[loc] = { name: loc, incidents: 0, requests: 0 };
    localityMap[loc].requests += 1;
  });

  const districtWiseReports = Object.values(districtMap).sort(
    (a, b) => b.incidents + b.requests - (a.incidents + a.requests)
  );
  const localityWiseReports = Object.values(localityMap)
    .sort((a, b) => b.incidents + b.requests - (a.incidents + a.requests))
    .slice(0, 10);

  return {
    totals: {
      incidents: incidents.length,
      verifiedIncidents: incidents.filter((i) => i.status === 'verified').length,
      emergencyRequests: emergencyRequests.length,
      activeRescues: activeCount,
      resolvedRescues: resolvedCount,
      resolutionRate,
      totalPeopleRequested,
      peopleResolved,
      totalTeams: rescueTeams.length,
      availableTeams: rescueTeams.filter((t) => t.status === 'available').length,
    },
    incidentTypeDistribution,
    severityDistribution,
    trendsOverTime,
    rescueStatusDistribution,
    teamReadiness,
    districtWiseReports,
    localityWiseReports,
  };
}
