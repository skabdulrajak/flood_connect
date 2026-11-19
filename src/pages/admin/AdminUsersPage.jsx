import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';
import { DemoDataBadge } from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { formatNumber, formatTimestamp, getRoleMeta, ROLES } from '../../utils/constants';

const ROLE_BADGE_STYLES = {
  citizen: 'bg-slate-100 text-slate-700 border-slate-300',
  volunteer: 'bg-[#ECFAF8] text-[#0A625C] border-[#13A89E]/40',
  rescue_team: 'bg-[#FEF5EC] text-[#9A4D09] border-[#F28C28]/45',
  admin: 'bg-[#0B2545] text-white border-[#0B2545]',
};

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [roleDrafts, setRoleDrafts] = useState({});
  const [pendingChange, setPendingChange] = useState(null); // { targetUser, nextRole }
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getAllUsers();
      setUsers(list);
      const map = {};
      list.forEach((u) => {
        map[u.id] = u.role;
      });
      setRoleDrafts(map);
    } catch (err) {
      setError(err.message || t('errors.loadUsersFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (q) {
        const hay = `${u.full_name} ${u.email || ''} ${u.locality || ''} ${u.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, searchQuery, roleFilter]);

  const handleConfirmRoleChange = async () => {
    if (!pendingChange || !user) return;
    setSaving(true);
    try {
      await dataService.updateUserRole(
        user.id,
        pendingChange.targetUser.id,
        pendingChange.nextRole
      );
      showToast(
        t('admin.toastRoleUpdated', {
          name: pendingChange.targetUser.full_name,
          role: getRoleMeta(pendingChange.nextRole).label,
        }),
        'success'
      );
      setPendingChange(null);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.updateUserRoleFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('admin.usersEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('admin.usersHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('admin.usersSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode ? <DemoDataBadge compact /> : null}
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-slate-200 bg-[#F4F6F8] px-3.5 py-2.5 text-xs text-slate-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" />
          <span>{t('admin.usersRbacNotice')}</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.searchUsersPlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#13A89E] focus:outline-none"
            />
          </div>
          <select
            aria-label={t('admin.filterUsersByRole')}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">
              {t('admin.allRolesCount', { count: formatNumber(users.length) })}
            </option>
            <option value={ROLES.CITIZEN}>{t('nav.roles.citizen')}</option>
            <option value={ROLES.VOLUNTEER}>{t('nav.roles.volunteer')}</option>
            <option value={ROLES.RESCUE_TEAM}>{t('nav.roles.rescue_team')}</option>
            <option value={ROLES.ADMIN}>{t('nav.roles.admin')}</option>
          </select>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('admin.loadingUsers')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('admin.emptyUsersTitle')}
          description={t('admin.emptyUsersDesc')}
          actionLabel={t('admin.showAllUsersBtn')}
          onAction={() => {
            setSearchQuery('');
            setRoleFilter('all');
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-[#F4F6F8] text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('admin.tableUser')}</th>
                <th className="px-4 py-3">{t('incident.localityLabel')}</th>
                <th className="px-4 py-3">{t('admin.tableCurrentRole')}</th>
                <th className="px-4 py-3">{t('admin.tableJoined')}</th>
                <th className="px-4 py-3 text-right">{t('admin.tableAssignRole')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((u) => {
                const isSelf = user?.id === u.id;
                const draftRole = roleDrafts[u.id] || u.role;
                const hasChanged = draftRole !== u.role;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0B2545]">
                        {u.full_name}{' '}
                        {isSelf ? (
                          <span className="text-xs text-[#0E857D]">({t('common.you')})</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {u.email || u.phone || t('admin.verifiedAccountFallback')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {u.locality || 'East Godavari'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${
                          ROLE_BADGE_STYLES[u.role] || ROLE_BADGE_STYLES.citizen
                        }`}
                      >
                        {getRoleMeta(u.role).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                      {formatTimestamp(u.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          aria-label={t('admin.selectRoleForUser', { name: u.full_name })}
                          disabled={isSelf}
                          value={draftRole}
                          onChange={(e) =>
                            setRoleDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value={ROLES.CITIZEN}>{t('nav.roles.citizen')}</option>
                          <option value={ROLES.VOLUNTEER}>{t('nav.roles.volunteer')}</option>
                          <option value={ROLES.RESCUE_TEAM}>{t('nav.roles.rescue_team')}</option>
                          <option value={ROLES.ADMIN}>{t('nav.roles.admin')}</option>
                        </select>
                        <button
                          type="button"
                          disabled={isSelf || !hasChanged}
                          onClick={() =>
                            setPendingChange({ targetUser: u, nextRole: draftRole })
                          }
                          className="rounded-md bg-[#0B2545] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-40"
                        >
                          {t('common.update')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingChange)}
        title={t('admin.confirmRoleChangeTitle', {
          name: pendingChange?.targetUser?.full_name || '',
        })}
        description={t('admin.confirmRoleChangeDesc', {
          fromRole: pendingChange?.targetUser?.role
            ? getRoleMeta(pendingChange.targetUser.role).label
            : '',
          toRole: pendingChange?.nextRole ? getRoleMeta(pendingChange.nextRole).label : '',
        })}
        confirmLabel={t('admin.confirmRoleChangeBtn')}
        tone={pendingChange?.nextRole === ROLES.ADMIN ? 'danger' : 'primary'}
        busy={saving}
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setPendingChange(null)}
      />
    </div>
  );
}
