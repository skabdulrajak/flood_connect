import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Edit3,
  Megaphone,
  Plus,
  PowerOff,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { DemoDataBadge, OriginBadge, SeverityBadge } from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { EAST_GODAVARI_LOCALITIES, formatNumber, formatTimestamp } from '../../utils/constants';

const EMPTY_FORM = {
  title: '',
  message: '',
  severity: 'high',
  info_origin: 'admin_verified',
  source_agency: 'East Godavari District Collectorate Control Room',
  affected_localities: ['Rajahmundry Urban', 'Dowleswaram'],
  expires_at: '',
};

export function AdminAlertsPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [confirmToggle, setConfirmToggle] = useState(null); // { alert, nextActive }
  const [toggling, setToggling] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getAllAlerts();
      setAlerts(list);
    } catch (err) {
      setError(err.message || t('errors.loadAlertsFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleLocality = (loc) => {
    setForm((prev) => {
      const exists = prev.affected_localities.includes(loc);
      return {
        ...prev,
        affected_localities: exists
          ? prev.affected_localities.filter((l) => l !== loc)
          : [...prev.affected_localities, loc],
      };
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (alert) => {
    setEditingId(alert.id);
    setForm({
      title: alert.title || '',
      message: alert.message || '',
      severity: alert.severity || 'high',
      info_origin: alert.info_origin || 'admin_verified',
      source_agency: alert.source_agency || '',
      affected_localities: Array.isArray(alert.affected_localities)
        ? alert.affected_localities
        : [],
      expires_at: alert.expires_at ? alert.expires_at.slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim() || !form.message.trim() || !form.source_agency.trim()) {
      showToast(t('alerts.validationRequiredFields'), 'error');
      return;
    }
    if (form.affected_localities.length === 0) {
      showToast(t('alerts.validationSelectLocality'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      if (editingId) {
        await dataService.updateAlert(editingId, payload);
        showToast(t('alerts.toastUpdated'), 'success');
      } else {
        await dataService.createAlert(user.id, payload);
        showToast(t('alerts.toastPublished'), 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.saveAlertFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!confirmToggle) return;
    setToggling(true);
    try {
      await dataService.updateAlert(confirmToggle.alert.id, {
        is_active: confirmToggle.nextActive,
        expires_at: confirmToggle.nextActive ? null : new Date().toISOString(),
      });
      showToast(
        confirmToggle.nextActive ? t('alerts.toastReactivated') : t('alerts.toastExpired'),
        'info'
      );
      setConfirmToggle(null);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.updateAlertStatusFailed'), 'error');
    } finally {
      setToggling(false);
    }
  };

  const isAlertCurrentlyActive = (alert) => {
    if (alert.is_active === false) return false;
    if (alert.expires_at && new Date(alert.expires_at).getTime() < Date.now()) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('alerts.adminEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('alerts.adminHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('alerts.adminSubtitle')}</p>
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
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('alerts.publishAlertBtn')}</span>
            </button>
          </div>
        </div>

        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="mt-5 rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B2545]">
                {editingId ? t('alerts.editAlertFormTitle') : t('alerts.publishNewAlertFormTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-slate-500 hover:bg-white"
                aria-label={t('common.closeForm')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.headlineLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder={t('alerts.headlinePlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('common.severity')}
                </label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="low">{t('alerts.severityLowOption')}</option>
                  <option value="medium">{t('alerts.severityMediumOption')}</option>
                  <option value="high">{t('alerts.severityHighOption')}</option>
                  <option value="critical">{t('alerts.severityCriticalOption')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.originLabelField')} *
                </label>
                <select
                  value={form.info_origin}
                  onChange={(e) => setForm((p) => ({ ...p, info_origin: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="admin_verified">{t('alerts.originOptionAdminIssued')}</option>
                  <option value="official_government">{t('alerts.originOptionOfficialGov')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.sourceAgencyLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.source_agency}
                  onChange={(e) => setForm((p) => ({ ...p, source_agency: e.target.value }))}
                  placeholder={t('alerts.sourceAgencyPlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.optionalExpiryLabel')}
                </label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.advisoryMessageLabel')} *
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder={t('alerts.advisoryMessagePlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  {t('alerts.affectedLocalitiesSelected', {
                    count: formatNumber(form.affected_localities.length),
                  })}{' '}
                  *
                </label>
                <div className="flex flex-wrap gap-2">
                  {EAST_GODAVARI_LOCALITIES.map((loc) => {
                    const checked = form.affected_localities.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => toggleLocality(loc)}
                        className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                          checked
                            ? 'border-[#0B2545] bg-[#0B2545] text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60"
              >
                {submitting
                  ? t('alerts.publishing')
                  : editingId
                  ? t('common.saveChanges')
                  : t('alerts.publishAlertBtn')}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {loading ? (
        <LoadingState message={t('alerts.loadingAdminAlerts')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t('alerts.liveOfficialUnavailable')}
          description={t('alerts.adminEmptyDesc')}
          actionLabel={t('alerts.publishVerifiedAlertBtn')}
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const active = isAlertCurrentlyActive(alert);
            return (
              <article
                key={alert.id}
                className={`rounded-lg border p-5 space-y-3 ${
                  active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <OriginBadge
                        origin={alert.info_origin}
                        labelOverride={
                          alert.info_origin === 'admin_verified'
                            ? t('alerts.originAdminIssued')
                            : t('alerts.originOfficial')
                        }
                      />
                      <SeverityBadge severity={alert.severity} />
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {active ? t('common.active') : t('alerts.expiredInactive')}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#0B2545]">{alert.title}</h3>
                    <p className="text-xs text-slate-600">
                      <strong>{t('alerts.sourcePrefix')}:</strong> {alert.source_agency} ·{' '}
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" />
                        {t('alerts.publishedPrefix')} {formatTimestamp(alert.published_at)}
                      </span>
                      {alert.expires_at
                        ? ` · ${t('alerts.expiresPrefix')} ${formatTimestamp(alert.expires_at)}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(alert)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t('common.edit')}</span>
                    </button>
                    {active ? (
                      <button
                        type="button"
                        onClick={() => setConfirmToggle({ alert, nextActive: false })}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                        <span>{t('alerts.expireAlertBtn')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmToggle({ alert, nextActive: true })}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/40 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{t('alerts.reactivateBtn')}</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-700">{alert.message}</p>

                {Array.isArray(alert.affected_localities) && alert.affected_localities.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs font-semibold text-slate-600">
                      {t('alerts.affectedAreasLabel')}:
                    </span>
                    {alert.affected_localities.map((loc) => (
                      <span
                        key={loc}
                        className="rounded border border-slate-200 bg-[#F4F6F8] px-2 py-0.5 text-xs font-medium text-slate-700"
                      >
                        {loc}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmToggle)}
        title={
          confirmToggle?.nextActive
            ? t('alerts.confirmReactivateTitle')
            : t('alerts.confirmExpireTitle')
        }
        description={
          confirmToggle?.nextActive
            ? t('alerts.confirmReactivateDesc')
            : t('alerts.confirmExpireDesc')
        }
        confirmLabel={
          confirmToggle?.nextActive
            ? t('alerts.reactivateAlertBtn')
            : t('alerts.expireAlertBtn')
        }
        tone={confirmToggle?.nextActive ? 'primary' : 'danger'}
        busy={toggling}
        onConfirm={handleConfirmToggle}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  );
}
