import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Radio, RefreshCw, Users, Wrench } from 'lucide-react';
import { DemoDataBadge } from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { formatNumber } from '../../utils/constants';

export function RescueReadinessPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const readinessOptions = [
    { value: 'available', label: t('status.team.available'), desc: t('rescue.readinessAvailableDesc') },
    { value: 'deployed', label: t('status.team.deployed'), desc: t('rescue.readinessDeployedDesc') },
    { value: 'standby', label: t('status.team.standby'), desc: t('rescue.readinessStandbyDesc') },
    { value: 'offline', label: t('status.team.offline'), desc: t('rescue.readinessOfflineDesc') },
  ];

  const loadTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getMyRescueTeams(user.id);
      setTeams(list);
    } catch (err) {
      setError(err.message || t('errors.loadReadinessFailed'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleStatusChange = async (team, nextStatus) => {
    if (team.status === nextStatus) return;
    setUpdatingId(team.id);
    try {
      await dataService.updateRescueTeam(team.id, { status: nextStatus });
      showToast(
        t('rescue.toastReadinessUpdated', {
          code: team.team_code,
          status: t(`status.team.${nextStatus}`, { defaultValue: nextStatus }),
        }),
        'success'
      );
      await loadTeams();
    } catch (err) {
      showToast(err.message || t('errors.updateReadinessFailed'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0E857D]">{t('rescue.readinessEyebrow')}</p>
          <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('rescue.readinessHeading')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('rescue.readinessSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDemoMode ? <DemoDataBadge compact /> : null}
          <button
            type="button"
            onClick={loadTeams}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('common.refresh')}</span>
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('rescue.loadingUnitDetails')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadTeams} />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={Radio}
          title={t('rescue.noUnitLinkedTitle')}
          description={t('rescue.noUnitLinkedDesc')}
        />
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const busy = updatingId === team.id;
            return (
              <article
                key={team.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#0E857D]">
                      {team.team_code}
                    </span>
                    <h3 className="mt-0.5 text-base font-bold text-[#0B2545]">{team.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {t('rescue.stagingBaseLabel')}: {team.base_location}
                      </span>
                    </p>
                  </div>
                  <div className="text-xs text-slate-700 space-y-1">
                    <p className="flex items-center gap-1.5 tabular-nums">
                      <Users className="h-3.5 w-3.5 text-[#0B2545]" />
                      <span>
                        {t('rescue.capacityCrewSeats', { count: formatNumber(team.capacity) })}
                      </span>
                    </p>
                    {team.equipment_summary ? (
                      <p className="flex items-start gap-1.5 max-w-md">
                        <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                        <span>{team.equipment_summary}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    {t('rescue.selectCurrentReadiness')}
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {readinessOptions.map((opt) => {
                      const active = team.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={busy}
                          onClick={() => handleStatusChange(team, opt.value)}
                          className={`rounded-md border p-3 text-left transition-colors ${
                            active
                              ? 'border-[#0B2545] bg-[#0B2545] text-white'
                              : 'border-slate-200 bg-[#F4F6F8] text-slate-800 hover:border-[#13A89E]'
                          }`}
                        >
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p
                            className={`mt-0.5 text-[11px] ${
                              active ? 'text-slate-200' : 'text-slate-500'
                            }`}
                          >
                            {opt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
