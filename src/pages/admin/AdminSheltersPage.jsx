import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Edit3,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { DemoDataBadge, OriginBadge } from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import {
  EAST_GODAVARI_COORDS,
  EAST_GODAVARI_LOCALITIES,
  formatNumber,
} from '../../utils/constants';

const AMENITY_PRESETS = [
  { value: 'Drinking Water', key: 'shelters.amenityDrinkingWater' },
  { value: 'Food Kitchen', key: 'shelters.amenityFoodKitchen' },
  { value: 'Medical First Aid', key: 'shelters.amenityMedicalFirstAid' },
  { value: 'Backup Power', key: 'shelters.amenityBackupPower' },
  { value: 'Separate Women & Family Wing', key: 'shelters.amenityWomenFamilyWing' },
  { value: 'Accessible Toilets', key: 'shelters.amenityAccessibleToilets' },
  { value: 'Infant Milk & Essentials', key: 'shelters.amenityInfantEssentials' },
];

const SHELTER_STATUS_STYLES = {
  open: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
  near_capacity: 'bg-amber-50 text-amber-900 border-amber-500/40',
  full: 'bg-red-50 text-red-800 border-red-600/35',
  closed: 'bg-slate-100 text-slate-600 border-slate-300',
};

const EMPTY_SHELTER = {
  name: '',
  address: '',
  locality: EAST_GODAVARI_LOCALITIES[0],
  latitude: EAST_GODAVARI_COORDS['Rajahmundry Urban'].lat,
  longitude: EAST_GODAVARI_COORDS['Rajahmundry Urban'].lng,
  capacity: 250,
  current_occupancy: 0,
  status: 'open',
  amenities: ['Drinking Water', 'Medical First Aid'],
  contact_officer_name: '',
  info_origin: 'admin_verified',
};

export function AdminSheltersPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_SHELTER);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getShelters();
      setShelters(list);
    } catch (err) {
      setError(err.message || t('errors.loadSheltersFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_SHELTER);
    setShowForm(true);
  };

  const openEdit = (shelter) => {
    setEditingId(shelter.id);
    setForm({
      name: shelter.name || '',
      address: shelter.address || '',
      locality: shelter.locality || EAST_GODAVARI_LOCALITIES[0],
      latitude: Number(shelter.latitude) || EAST_GODAVARI_COORDS['Rajahmundry Urban'].lat,
      longitude: Number(shelter.longitude) || EAST_GODAVARI_COORDS['Rajahmundry Urban'].lng,
      capacity: Number(shelter.capacity || 0),
      current_occupancy: Number(shelter.current_occupancy || 0),
      status: shelter.status || 'open',
      amenities: Array.isArray(shelter.amenities) ? shelter.amenities : [],
      contact_officer_name: shelter.contact_officer_name || '',
      info_origin: shelter.info_origin || 'admin_verified',
    });
    setShowForm(true);
  };

  const handleLocalityChange = (loc) => {
    const coords = EAST_GODAVARI_COORDS[loc];
    setForm((prev) => ({
      ...prev,
      locality: loc,
      ...(coords && !editingId ? { latitude: coords.lat, longitude: coords.lng } : {}),
    }));
  };

  const toggleAmenity = (amenity) => {
    setForm((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  const translateAmenity = (value) => {
    const match = AMENITY_PRESETS.find((p) => p.value === value);
    return match ? t(match.key, { defaultValue: value }) : value;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim() || !form.address.trim()) {
      showToast(t('shelters.validationNameAddress'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await dataService.updateShelter(user.id, editingId, form);
        showToast(t('shelters.toastUpdated', { name: form.name.trim() }), 'success');
      } else {
        await dataService.createShelter(user.id, form);
        showToast(t('shelters.toastCreated', { name: form.name.trim() }), 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_SHELTER);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.saveShelterFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await dataService.deleteShelter(confirmDelete.id);
      showToast(t('shelters.toastDeleted', { name: confirmDelete.name }), 'info');
      setConfirmDelete(null);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.deleteShelterFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('shelters.adminEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('shelters.adminHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('shelters.adminSubtitle')}</p>
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
              <span>{t('shelters.addShelterBtn')}</span>
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
                {editingId ? t('shelters.editFormTitle') : t('shelters.addFormTitle')}
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
                  {t('shelters.shelterNameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t('shelters.shelterNamePlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('incident.localityLabel')}
                </label>
                <select
                  value={form.locality}
                  onChange={(e) => handleLocalityChange(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {EAST_GODAVARI_LOCALITIES.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  {t('shelters.fullAddressLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder={t('shelters.fullAddressPlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('shelters.availabilityStatusLabel')}
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="open">{t('status.shelter.open')}</option>
                  <option value="near_capacity">{t('status.shelter.near_capacity')}</option>
                  <option value="full">{t('status.shelter.full')}</option>
                  <option value="closed">{t('status.shelter.closed')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('shelters.totalCapacityLabel')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={(e) => setForm((p) => ({ ...p, capacity: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('shelters.currentOccupancyLabel')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.current_occupancy}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, current_occupancy: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('shelters.officerDeskLabel')}
                </label>
                <input
                  type="text"
                  value={form.contact_officer_name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, contact_officer_name: e.target.value }))
                  }
                  placeholder={t('shelters.officerDeskPlaceholder')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('incident.latitudeLabel')}
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.latitude}
                  onChange={(e) => setForm((p) => ({ ...p, latitude: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('incident.longitudeLabel')}
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.longitude}
                  onChange={(e) => setForm((p) => ({ ...p, longitude: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('shelters.sourceLabelField')}
                </label>
                <select
                  value={form.info_origin}
                  onChange={(e) => setForm((p) => ({ ...p, info_origin: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="admin_verified">{t('alerts.originAdminVerified')}</option>
                  <option value="official_government">{t('alerts.originOfficial')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                {t('shelters.pinGpsLabel')}
              </label>
              <LocationPickerMap
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={({ lat, lng }) =>
                  setForm((p) => ({ ...p, latitude: lat, longitude: lng }))
                }
                heightClass="h-52"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                {t('shelters.availableFacilitiesLabel')}
              </label>
              <div className="flex flex-wrap gap-2">
                {AMENITY_PRESETS.map((item) => {
                  const selected = form.amenities.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleAmenity(item.value)}
                      className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-[#13A89E] bg-[#ECFAF8] text-[#0A625C]'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {t(item.key, { defaultValue: item.value })}
                    </button>
                  );
                })}
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
                  ? t('shelters.updateShelterBtn')
                  : t('shelters.createShelterBtn')}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {loading ? (
        <LoadingState message={t('shelters.loadingShelters')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : shelters.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('shelters.emptyAdminTitle')}
          description={t('shelters.emptyAdminDesc')}
          actionLabel={t('shelters.addShelterBtn')}
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shelters.map((shelter) => {
            const pct =
              shelter.capacity > 0
                ? Math.min(100, Math.round((shelter.current_occupancy / shelter.capacity) * 100))
                : 0;
            const availableBeds = Math.max(0, shelter.capacity - shelter.current_occupancy);
            return (
              <article
                key={shelter.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                          SHELTER_STATUS_STYLES[shelter.status] || SHELTER_STATUS_STYLES.open
                        }`}
                      >
                        {t(`status.shelter.${shelter.status}`, {
                          defaultValue: shelter.status.replace('_', ' '),
                        })}
                      </span>
                      <OriginBadge origin={shelter.info_origin} />
                    </div>
                    <h3 className="text-base font-bold text-[#0B2545]">{shelter.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {shelter.address} · {shelter.locality}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(shelter)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t('common.edit')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(shelter)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('common.delete')}</span>
                    </button>
                  </div>
                </div>

                {/* Occupancy bar */}
                <div className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#0B2545] tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {t('shelters.occupancyLine', {
                        occupied: formatNumber(shelter.current_occupancy),
                        capacity: formatNumber(shelter.capacity),
                        pct: formatNumber(pct),
                      })}
                    </span>
                    <span className="text-emerald-700">
                      {t('shelters.openSpotsCount', { count: formatNumber(availableBeds) })}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 90
                          ? 'bg-red-600'
                          : pct >= 70
                          ? 'bg-[#F28C28]'
                          : 'bg-[#13A89E]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="font-mono text-[11px] tabular-nums">
                    {t('shelters.gpsPrefix')}: {Number(shelter.latitude).toFixed(4)},{' '}
                    {Number(shelter.longitude).toFixed(4)}
                  </span>
                  {shelter.contact_officer_name ? (
                    <span>
                      {t('shelters.deskPrefix')}: {shelter.contact_officer_name}
                    </span>
                  ) : null}
                </div>

                {Array.isArray(shelter.amenities) && shelter.amenities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {shelter.amenities.map((a) => (
                      <span
                        key={a}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {translateAmenity(a)}
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
        open={Boolean(confirmDelete)}
        title={t('shelters.confirmDeleteTitle', { name: confirmDelete?.name || '' })}
        description={t('shelters.confirmDeleteDesc')}
        confirmLabel={t('shelters.deleteShelterBtn')}
        tone="danger"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
