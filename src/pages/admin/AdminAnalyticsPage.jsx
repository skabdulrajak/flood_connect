import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';
import { DemoDataBadge } from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { AdminAreaSummaryPanel } from '../../components/ai/AdminAreaSummaryPanel';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import {
  formatNumber,
  getIncidentCategoryLabel,
  getSeverityMeta,
  getStatusMeta,
} from '../../utils/constants';

const RESCUE_STATUS_COLORS = {
  pending: '#D97706',
  verified: '#13A89E',
  assigned: '#0B2545',
  rescue_in_progress: '#F28C28',
  resolved: '#15803D',
  closed: '#475569',
  cancelled: '#94A3B8',
};

const TEAM_STATUS_COLORS = {
  available: '#15803D',
  deployed: '#F28C28',
  standby: '#D97706',
  offline: '#64748B',
};

function ChartCard({ title, subtitle, children, rightSlot = null }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#0B2545]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </div>
      {children}
    </section>
  );
}

export function AdminAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const { isDemoMode } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [rawIncidents, setRawIncidents] = useState([]);
  const [rawRequests, setRawRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [geoView, setGeoView] = useState('district'); // 'district' | 'locality'

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, incList, reqList] = await Promise.all([
        dataService.getAdminAnalytics(),
        dataService.getAllIncidents(),
        dataService.getAllEmergencyRequests(),
      ]);
      setAnalytics(data);
      setRawIncidents(incList);
      setRawRequests(reqList);
    } catch (err) {
      setError(err?.message || t('errors.loadAnalyticsFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const localizedIncidentTypes = useMemo(() => {
    if (!analytics?.incidentTypeDistribution) return [];
    return analytics.incidentTypeDistribution.map((item) => ({
      ...item,
      name: item.category ? getIncidentCategoryLabel(item.category) : item.name,
    }));
  }, [analytics, i18n.language]);

  const localizedSeverities = useMemo(() => {
    if (!analytics?.severityDistribution) return [];
    return analytics.severityDistribution.map((item) => ({
      ...item,
      name: item.key ? getSeverityMeta(item.key).label : item.name,
    }));
  }, [analytics, i18n.language]);

  const localizedRescueStatuses = useMemo(() => {
    if (!analytics?.rescueStatusDistribution) return [];
    return analytics.rescueStatusDistribution.map((item) => ({
      ...item,
      name: item.status ? getStatusMeta(item.status, 'emergency').label : item.name,
    }));
  }, [analytics, i18n.language]);

  const localizedTeamReadiness = useMemo(() => {
    if (!analytics?.teamReadiness) return [];
    return analytics.teamReadiness.map((item) => ({
      ...item,
      name: t(`status.team.${item.status}`, { defaultValue: item.name }),
    }));
  }, [analytics, t]);

  const geoSeries =
    geoView === 'district'
      ? analytics?.districtWiseReports || []
      : analytics?.localityWiseReports || [];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0E857D]">{t('analytics.eyebrow')}</p>
          <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('analytics.heading')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDemoMode ? <DemoDataBadge compact /> : null}
          <button
            type="button"
            onClick={loadAnalytics}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('analytics.refreshDataBtn')}</span>
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('analytics.loadingMessage')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAnalytics} />
      ) : !analytics ? (
        <EmptyState
          icon={BarChart3}
          title={t('analytics.emptyTitle')}
          description={t('analytics.emptyDesc')}
        />
      ) : (
        <>
          {/* Stage 5: Grounded AI Area Summary */}
          <AdminAreaSummaryPanel
            incidents={rawIncidents}
            emergencyRequests={rawRequests}
          />

          {/* Summary KPI Strip */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-600">
                {t('analytics.kpiLoggedIncidents')}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-[#0B2545] tabular-nums">
                {formatNumber(analytics.totals.incidents)}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700 tabular-nums">
                {t('analytics.kpiAdminVerifiedSub', {
                  count: formatNumber(analytics.totals.verifiedIncidents),
                })}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-600">
                {t('analytics.kpiEmergencyRequests')}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-[#C06310] tabular-nums">
                {formatNumber(analytics.totals.emergencyRequests)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                {t('analytics.kpiActiveResolvedSub', {
                  active: formatNumber(analytics.totals.activeRescues),
                  resolved: formatNumber(analytics.totals.resolvedRescues),
                })}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-600">
                {t('analytics.kpiResolutionRate')}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {formatNumber(analytics.totals.resolutionRate)}%
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                {t('analytics.kpiPeopleResolvedSub', {
                  resolved: formatNumber(analytics.totals.peopleResolved),
                  total: formatNumber(analytics.totals.totalPeopleRequested),
                })}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-600">
                {t('analytics.kpiFleetReadiness')}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-[#0E857D] tabular-nums">
                {formatNumber(analytics.totals.availableTeams)} /{' '}
                {formatNumber(analytics.totals.totalTeams)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {t('analytics.kpiUnitsAvailableSub')}
              </p>
            </div>
          </section>

          {/* Row 1: Incident Type Distribution + Severity Distribution */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <ChartCard
                title={t('analytics.chartIncidentTypeTitle')}
                subtitle={t('analytics.chartIncidentTypeSubtitle')}
              >
                {localizedIncidentTypes.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-500">
                    {t('analytics.noIncidentRecords')}
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={localizedIncidentTypes}
                        layout="vertical"
                        margin={{ top: 8, right: 20, left: 10, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={150}
                          tick={{ fontSize: 11, fill: '#0B2545' }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          name={t('analytics.seriesIncidents')}
                          fill="#0B2545"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="lg:col-span-5">
              <ChartCard
                title={t('analytics.chartSeverityTitle')}
                subtitle={t('analytics.chartSeveritySubtitle')}
              >
                {localizedSeverities.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-500">
                    {t('analytics.noSeverityRecords')}
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={localizedSeverities}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={3}
                        >
                          {localizedSeverities.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={32} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>
          </div>

          {/* Row 2: Request & Incident Trends Over Time */}
          <ChartCard
            title={t('analytics.chartTrendsTitle')}
            subtitle={t('analytics.chartTrendsSubtitle')}
          >
            {analytics.trendsOverTime.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-500">
                {t('analytics.noTimeSeriesRecords')}
              </p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.trendsOverTime}
                    margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#334155' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#334155' }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="incidents"
                      name={t('analytics.seriesFloodIncidents')}
                      stroke="#13A89E"
                      fill="#13A89E"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="emergencyRequests"
                      name={t('analytics.seriesEmergencyRequests')}
                      stroke="#F28C28"
                      fill="#F28C28"
                      fillOpacity={0.22}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Row 3: Rescue Stats + District/Locality-wise Reports */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <ChartCard
                title={t('analytics.chartRescueOpsTitle')}
                subtitle={t('analytics.chartRescueOpsSubtitle')}
              >
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={localizedRescueStatuses}
                      margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name={t('analytics.seriesRequests')}
                        radius={[4, 4, 0, 0]}
                      >
                        {localizedRescueStatuses.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={RESCUE_STATUS_COLORS[entry.status] || '#0B2545'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Team readiness breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                  {localizedTeamReadiness.map((item) => (
                    <div
                      key={item.status}
                      className="rounded border border-slate-200 bg-[#F4F6F8] px-2.5 py-2 text-center"
                    >
                      <p className="text-[11px] font-semibold text-slate-600">{item.name}</p>
                      <p
                        className="mt-0.5 font-mono text-base font-bold tabular-nums"
                        style={{ color: TEAM_STATUS_COLORS[item.status] || '#0B2545' }}
                      >
                        {formatNumber(item.count)}
                      </p>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            <div className="lg:col-span-6">
              <ChartCard
                title={
                  geoView === 'district'
                    ? t('analytics.chartDistrictWiseTitle')
                    : t('analytics.chartLocalityWiseTitle')
                }
                subtitle={t('analytics.chartGeoSubtitle')}
                rightSlot={
                  <div className="inline-flex rounded-md border border-slate-200 bg-[#F4F6F8] p-0.5">
                    <button
                      type="button"
                      onClick={() => setGeoView('district')}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        geoView === 'district'
                          ? 'bg-[#0B2545] text-white'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      {t('analytics.districtWiseBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeoView('locality')}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        geoView === 'locality'
                          ? 'bg-[#0B2545] text-white'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      {t('analytics.localityWiseBtn')}
                    </button>
                  </div>
                }
              >
                {geoSeries.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-500">
                    {t('analytics.noGeoRecords')}
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={geoSeries}
                        margin={{ top: 8, right: 16, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#334155' }}
                          interval={0}
                          angle={geoView === 'locality' ? -20 : 0}
                          textAnchor={geoView === 'locality' ? 'end' : 'middle'}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="incidents"
                          name={t('analytics.seriesIncidents')}
                          fill="#0B2545"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="requests"
                          name={t('analytics.seriesEmergencyRequests')}
                          fill="#F28C28"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
