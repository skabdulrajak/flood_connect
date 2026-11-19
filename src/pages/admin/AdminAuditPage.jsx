import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, History, LifeBuoy, RefreshCw } from 'lucide-react';
import { DemoDataBadge } from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import {
  formatNumber,
  formatTimestamp,
  getSeverityMeta,
  getStatusMeta,
} from '../../utils/constants';

export function AdminAuditPage() {
  const { t } = useTranslation();
  const { isDemoMode } = useAuth();
  const [tab, setTab] = useState('incidents'); // 'incidents' | 'rescues'
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [rescueHistory, setRescueHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [incHist, resHist] = await Promise.all([
        dataService.getIncidentVerificationHistory(),
        dataService.getRescueStatusHistory(),
      ]);
      setIncidentHistory(incHist);
      setRescueHistory(resHist);
    } catch (err) {
      setError(err.message || t('errors.loadAuditLogsFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('admin.auditEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('admin.auditHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('admin.auditSubtitle')}</p>
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

        <div className="mt-4 inline-flex flex-wrap rounded-md border border-slate-200 bg-[#F4F6F8] p-1">
          <button
            type="button"
            onClick={() => setTab('incidents')}
            className={`inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'incidents' ? 'bg-[#0B2545] text-white' : 'text-slate-700 hover:bg-white'
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span>
              {t('admin.tabIncidentHistoryCount', { count: formatNumber(incidentHistory.length) })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('rescues')}
            className={`inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'rescues' ? 'bg-[#0B2545] text-white' : 'text-slate-700 hover:bg-white'
            }`}
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            <span>
              {t('admin.tabRescueHistoryCount', { count: formatNumber(rescueHistory.length) })}
            </span>
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('admin.loadingAuditHistory')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : tab === 'incidents' ? (
        incidentHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title={t('admin.emptyIncidentHistoryTitle')}
            description={t('admin.emptyIncidentHistoryDesc')}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-[#F4F6F8] font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t('common.timestamp')}</th>
                  <th className="px-4 py-3">{t('admin.tableIncidentId')}</th>
                  <th className="px-4 py-3">{t('admin.tableTransition')}</th>
                  <th className="px-4 py-3">{t('common.priority')}</th>
                  <th className="px-4 py-3">{t('admin.tableAuditNotes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {incidentHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                      {formatTimestamp(item.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#0B2545] whitespace-nowrap">
                      {item.incident_code || item.incident_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-slate-600">
                        {getStatusMeta(item.previous_status, 'incident').label}
                      </span>
                      {' → '}
                      <span className="font-semibold text-[#0B2545]">
                        {getStatusMeta(item.new_status, 'incident').label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {item.new_priority ? getSeverityMeta(item.new_priority).label : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : rescueHistory.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('admin.emptyRescueHistoryTitle')}
          description={t('admin.emptyRescueHistoryDesc')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-[#F4F6F8] font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('common.timestamp')}</th>
                <th className="px-4 py-3">{t('rescue.tableRequestId')}</th>
                <th className="px-4 py-3">{t('admin.tableStatusChange')}</th>
                <th className="px-4 py-3">{t('admin.tableOperationalNotes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rescueHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                    {formatTimestamp(item.created_at)}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#0B2545] whitespace-nowrap">
                    {item.request_code || item.emergency_request_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-slate-600">
                      {item.previous_status
                        ? getStatusMeta(item.previous_status, 'emergency').label
                        : t('common.new')}
                    </span>
                    {' → '}
                    <span className="font-semibold text-[#0B2545]">
                      {item.new_status ? getStatusMeta(item.new_status, 'emergency').label : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
