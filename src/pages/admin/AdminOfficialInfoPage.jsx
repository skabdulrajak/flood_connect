import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Edit3,
  Landmark,
  Plus,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { DemoDataBadge, OriginBadge } from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import {
  OFFICIAL_INFO_CATEGORIES,
  OfficialInformationSection,
} from '../../components/official/OfficialInformationSection';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { formatNumber, formatTimestamp } from '../../utils/constants';

const EMPTY_FORM = {
  category: 'river_level',
  title: '',
  metric_value: '',
  station_or_area: 'Dowleswaram Barrage (Sir Arthur Cotton Barrage)',
  summary: '',
  source_agency: 'Central Water Commission (CWC) / AP Irrigation Department',
  published_at: '',
  expires_at: '',
};

export function AdminOfficialInfoPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const getCategoryLabel = (key) => {
    const fallback = OFFICIAL_INFO_CATEGORIES.find((c) => c.key === key)?.label || key;
    return t(`alerts.officialCategories.${key}`, { defaultValue: fallback });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getOfficialInformation({ includeInactive: true });
      setEntries(list);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err?.message || t('errors.loadOfficialInfoFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingId(null);
    const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm({ ...EMPTY_FORM, published_at: nowLocal });
    setShowForm(true);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      category: entry.category || 'rainfall',
      title: entry.title || '',
      metric_value: entry.metric_value || '',
      station_or_area: entry.station_or_area || '',
      summary: entry.summary || '',
      source_agency: entry.source_agency || '',
      published_at: entry.published_at ? entry.published_at.slice(0, 16) : '',
      expires_at: entry.expires_at ? entry.expires_at.slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (
      !form.title.trim() ||
      !form.summary.trim() ||
      !form.source_agency.trim() ||
      !form.station_or_area.trim()
    ) {
      showToast(t('alerts.validationOfficialInfoFields'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        published_at: form.published_at
          ? new Date(form.published_at).toISOString()
          : new Date().toISOString(),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      if (editingId) {
        await dataService.updateOfficialInfo(editingId, payload);
        showToast(t('alerts.toastOfficialEntryUpdated'), 'success');
      } else {
        await dataService.createOfficialInfo(user.id, payload);
        showToast(t('alerts.toastOfficialEntryPublished'), 'success');
      }
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      showToast(err?.message || t('errors.publishOfficialInfoFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (entry) => {
    try {
      await dataService.updateOfficialInfo(entry.id, {
        is_active: !entry.is_active,
      });
      showToast(
        entry.is_active
          ? t('alerts.toastOfficialEntryDeactivated')
          : t('alerts.toastOfficialEntryReactivated'),
        'info'
      );
      await loadData();
    } catch (err) {
      showToast(err?.message || t('errors.toggleEntryFailed'), 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await dataService.deleteOfficialInfo(confirmDelete.id);
      showToast(t('alerts.toastOfficialEntryDeleted'), 'info');
      setConfirmDelete(null);
      await loadData();
    } catch (err) {
      showToast(err?.message || t('errors.deleteEntryFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('alerts.officialInfoEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
              {t('alerts.officialInfoHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('alerts.officialInfoSubtitle', {
                unavailableNotice: t('alerts.liveOfficialUnavailable'),
              })}
            </p>
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
              <span>{t('alerts.publishOfficialEntryBtn')}</span>
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
                {editingId
                  ? t('alerts.editOfficialEntryFormTitle')
                  : t('alerts.publishOfficialEntryBtn')}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label={t('common.closeForm')}
                className="rounded p-1 text-slate-500 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('common.category')} *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {OFFICIAL_INFO_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {getCategoryLabel(c.key)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.bulletinTitleLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder={t('alerts.bulletinTitlePlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.officialReadingLabel')}
                </label>
                <input
                  type="text"
                  value={form.metric_value}
                  onChange={(e) => setForm((p) => ({ ...p, metric_value: e.target.value }))}
                  placeholder={t('alerts.officialReadingPlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.gaugeStationAreaLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.station_or_area}
                  onChange={(e) => setForm((p) => ({ ...p, station_or_area: e.target.value }))}
                  placeholder={t('alerts.gaugeStationAreaPlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.sourceAgencyShortLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.source_agency}
                  onChange={(e) => setForm((p) => ({ ...p, source_agency: e.target.value }))}
                  placeholder={t('alerts.sourceAgencyOfficialPlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('alerts.officialPubTimeLabel')} *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={form.published_at}
                  onChange={(e) => setForm((p) => ({ ...p, published_at: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
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
                  {t('alerts.verifiedSummaryGuidanceLabel')} *
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  placeholder={t('alerts.verifiedSummaryPlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
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
                  ? t('common.saving')
                  : editingId
                  ? t('common.saveChanges')
                  : t('alerts.publishOfficialEntryBtn')}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/* Public View Preview */}
      <OfficialInformationSection key={previewKey} />

      {/* Manage Published Entries */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[#0B2545]">
          {t('alerts.publishedOfficialEntriesHeading', { count: formatNumber(entries.length) })}
        </h3>
        {loading ? (
          <LoadingState message={t('alerts.loadingPublishedEntries')} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={t('alerts.emptyOfficialEntriesTitle')}
            description={t('alerts.emptyOfficialEntriesDesc', {
              unavailableNotice: t('alerts.liveOfficialUnavailable'),
            })}
            actionLabel={t('alerts.publishFirstEntryBtn')}
            onAction={openCreate}
          />
        ) : (
          <div className="space-y-3">
            {entries.map((item) => {
              const catLabel = getCategoryLabel(item.category);
              return (
                <article
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-start justify-between gap-4"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <OriginBadge origin="official_government" />
                      <span className="rounded border border-slate-200 bg-[#F4F6F8] px-2 py-0.5 text-xs font-semibold text-[#0B2545]">
                        {catLabel}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                          item.is_active
                            ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.is_active ? t('common.active') : t('common.inactive')}
                      </span>
                      {item.metric_value ? (
                        <span className="font-mono text-xs font-bold text-[#0B2545] tabular-nums">
                          {item.metric_value}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="text-sm font-bold text-[#0B2545]">{item.title}</h4>
                    <p className="text-xs text-slate-700">{item.summary}</p>
                    <p className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>
                        <strong>{t('alerts.stationPrefix')}:</strong> {item.station_or_area}
                      </span>
                      <span>·</span>
                      <span>
                        <strong>{t('alerts.sourcePrefix')}:</strong> {item.source_agency}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(item.published_at)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t('common.edit')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {item.is_active ? (
                        <>
                          <PowerOff className="h-3.5 w-3.5" />
                          <span>{t('alerts.deactivateBtn')}</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{t('alerts.activateBtn')}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('common.delete')}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={t('alerts.confirmDeleteOfficialTitle', { title: confirmDelete?.title || '' })}
        description={t('alerts.confirmDeleteOfficialDesc', {
          unavailableNotice: t('alerts.liveOfficialUnavailable'),
        })}
        confirmLabel={t('alerts.deleteEntryBtn')}
        tone="danger"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
