import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Info, Megaphone, PhoneCall } from 'lucide-react';
import { DemoDataBadge, OriginBadge, SeverityBadge } from '../components/common/Badges';
import { OfficialInformationSection } from '../components/official/OfficialInformationSection';
import { useAuth } from '../hooks/useAuth';
import { dataService } from '../services/dataService';
import { getOfficialEmergencyHelplines, formatTimestamp } from '../utils/constants';

export function OfficialInfoPage() {
  const { t } = useTranslation();
  const { isDemoMode } = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    dataService.getActiveAlerts().then(setAlerts).catch(() => setAlerts([]));
  }, []);

  const helplines = getOfficialEmergencyHelplines();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0E857D]">
            {t('alerts.officialDeskEyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0B2545]">
            {t('alerts.officialInfoPageTitle')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            {t('alerts.officialInfoPageSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDemoMode ? <DemoDataBadge /> : null}
          <Link
            to="/map"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#13315C]"
          >
            <span>{t('landing.ctaOpenMap')}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <OfficialInformationSection />

      {/* Active Official & Admin-Issued Alerts */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[#0B2545]">
              {t('alerts.activeAdvisoriesTitle')}
            </h2>
          </div>
          <OriginBadge origin="official_government" />
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-[#F4F6F8] p-4 text-sm text-slate-700">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0B2545]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#0B2545]">
                {t('alerts.liveOfficialUnavailable')}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {t('landing.recentAlertsEmpty')}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0B2545]">{alert.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <OriginBadge
                      origin={alert.info_origin}
                      labelOverride={
                        alert.info_origin === 'admin_verified'
                          ? t('alerts.originAdmin')
                          : t('alerts.originOfficial')
                      }
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-700">{alert.message}</p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {t('alerts.sourceAttribution', { source: alert.source_agency })} ·{' '}
                  {t('alerts.lastPublished', { time: formatTimestamp(alert.published_at) })}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Emergency Helplines */}
      <section className="rounded-lg border border-slate-200 bg-[#0B2545] p-5 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#13A89E]">
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
          <span>{t('emergency.officialContactsTitle')}</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {helplines.map((h) => (
            <div key={h.number} className="rounded-md border border-white/15 bg-white/5 p-3">
              <p className="font-mono text-lg font-bold text-[#F28C28] tabular-nums">{h.number}</p>
              <p className="text-xs font-semibold text-white">{h.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-300">{h.note}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
