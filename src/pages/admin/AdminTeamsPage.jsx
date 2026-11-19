import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, MapPin, Plus, RefreshCw, Users, Wrench } from 'lucide-react';
import { DemoDataBadge } from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { EAST_GODAVARI_LOCALITIES, formatNumber, ROLES } from '../../utils/constants';

const TEAM_STATUS_TONES = {
  available: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
  deployed: 'bg-[#FEF5EC] text-[#9A4D09] border-[#F28C28]/45',
  standby: 'bg-amber-50 text-amber-900 border-amber-500/40',
  offline: 'bg-slate-100 text-slate-600 border-slate-300',
};

export function AdminTeamsPage() {
  const { t } = useTranslation();
  const { isDemoMode } = useAuth();
  const { showToast } = useToast();

  const teamTypes = [
    { value: 'boat_rescue', label: t('admin.teamTypeBoatRescue') },
    { value: 'medical_evac', label: t('admin.teamTypeMedicalEvac') },
    { value: 'road_clearance', label: t('admin.teamTypeRoadClearance') },
    { value: 'relief_distribution', label: t('admin.teamTypeReliefDist') },
  ];

  const [teams, setTeams] = useState([]);
  const [rescueUsers, setRescueUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingTeamId, setUpdatingTeamId] = useState(null);

  const [form, setForm] = useState({
    team_code: '',
    name: '',
    team_type: 'boat_rescue',
    base_location: 'Dowleswaram Barrage Boat Yard',
    capacity: 8,
    equipment_summary: '',
    status: 'available',
    lead_user_id: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [teamList, userList] = await Promise.all([
        dataService.getRescueTeams(),
        dataService.getAllUsers(),
      ]);
      setTeams(teamList);
      setRescueUsers(userList.filter((u) => u.role === ROLES.RESCUE_TEAM));
    } catch (err) {
      setError(err.message || t('errors.loadTeamsFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.base_location.trim()) {
      showToast(t('admin.validationTeamNameBase'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await dataService.createRescueTeam(form);
      showToast(t('admin.toastTeamCreated', { name: form.name.trim() }), 'success');
      setForm({
        team_code: '',
        name: '',
        team_type: 'boat_rescue',
        base_location: EAST_GODAVARI_LOCALITIES[0],
        capacity: 8,
        equipment_summary: '',
        status: 'available',
        lead_user_id: '',
      });
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.createTeamFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeamUpdate = async (teamId, updates, label) => {
    setUpdatingTeamId(teamId);
    try {
      await dataService.updateRescueTeam(teamId, updates);
      showToast(label, 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.updateTeamFailed'), 'error');
    } finally {
      setUpdatingTeamId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('admin.teamsEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('admin.teamsHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('admin.teamsSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDemoMode ? <DemoDataBadge compact /> : null}
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('common.refresh')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showCreateForm ? t('common.closeForm') : t('admin.addRescueTeamBtn')}</span>
            </button>
          </div>
        </div>

        {showCreateForm ? (
          <form
            onSubmit={handleCreateTeam}
            className="mt-5 grid gap-4 rounded-md border border-slate-200 bg-[#F4F6F8] p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('admin.unitCodeLabel')}
              </label>
              <input
                type="text"
                value={form.team_code}
                onChange={(e) => setForm((p) => ({ ...p, team_code: e.target.value }))}
                placeholder="e.g., RT-EG-03"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('admin.teamNameLabel')} *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('admin.teamNamePlaceholder')}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('admin.unitTypeLabel')}
              </label>
              <select
                value={form.team_type}
                onChange={(e) => setForm((p) => ({ ...p, team_type: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {teamTypes.map((tt) => (
                  <option key={tt.value} value={tt.value}>
                    {tt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('admin.baseStagingLocationLabel')} *
              </label>
              <input
                type="text"
                required
                value={form.base_location}
                onChange={(e) => setForm((p) => ({ ...p, base_location: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('admin.personnelBoatCapacityLabel')}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('admin.assignedTeamLeadRoleLabel')}
              </label>
              <select
                value={form.lead_user_id}
                onChange={(e) => setForm((p) => ({ ...p, lead_user_id: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">{t('common.unassigned')}</option>
                {rescueUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.locality || 'East Godavari'})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700">
                {t('admin.equipmentSummaryLabel')}
              </label>
              <input
                type="text"
                value={form.equipment_summary}
                onChange={(e) => setForm((p) => ({ ...p, equipment_summary: e.target.value }))}
                placeholder={t('admin.equipmentSummaryPlaceholder')}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60"
              >
                {submitting ? t('common.creating') : t('admin.saveRescueTeamBtn')}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {loading ? (
        <LoadingState message={t('admin.loadingRescueTeams')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={t('admin.emptyTeamsTitle')}
          description={t('admin.emptyTeamsDesc')}
          actionLabel={t('admin.addRescueTeamBtn')}
          onAction={() => setShowCreateForm(true)}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {teams.map((team) => {
            const busy = updatingTeamId === team.id;
            const typeLabel =
              teamTypes.find((tt) => tt.value === team.team_type)?.label || team.team_type;
            return (
              <article
                key={team.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0E857D]">
                        {team.team_code}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                          TEAM_STATUS_TONES[team.status] || TEAM_STATUS_TONES.offline
                        }`}
                      >
                        {t(`status.team.${team.status}`, { defaultValue: team.status })}
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-bold text-[#0B2545]">{team.name}</h3>
                    <p className="text-xs text-slate-500">{typeLabel}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <span>
                      <strong>{t('admin.baseLabel')}:</strong> {team.base_location}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <span className="tabular-nums">
                      <strong>{t('admin.capacityLabel')}:</strong>{' '}
                      {t('rescue.crewSeatsCount', { count: formatNumber(team.capacity) })} ·{' '}
                      <strong>{t('admin.leadLabel')}:</strong> {team.lead_name || t('common.unassigned')}
                    </span>
                  </p>
                  {team.equipment_summary ? (
                    <p className="flex items-start gap-1.5">
                      <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                      <span>{team.equipment_summary}</span>
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      {t('admin.readinessStatusLabel')}
                    </label>
                    <select
                      disabled={busy}
                      value={team.status}
                      onChange={(e) =>
                        handleTeamUpdate(
                          team.id,
                          { status: e.target.value },
                          t('rescue.toastReadinessUpdated', {
                            code: team.team_code,
                            status: t(`status.team.${e.target.value}`, {
                              defaultValue: e.target.value,
                            }),
                          })
                        )
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="available">{t('status.team.available')}</option>
                      <option value="deployed">{t('status.team.deployed')}</option>
                      <option value="standby">{t('status.team.standby')}</option>
                      <option value="offline">{t('status.team.offline')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      {t('admin.assignedTeamLeadLabel')}
                    </label>
                    <select
                      disabled={busy}
                      value={team.lead_user_id || ''}
                      onChange={(e) =>
                        handleTeamUpdate(
                          team.id,
                          { lead_user_id: e.target.value || null },
                          t('admin.toastTeamLeadUpdated', { code: team.team_code })
                        )
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="">{t('common.unassigned')}</option>
                      {rescueUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                        </option>
                      ))}
                    </select>
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
