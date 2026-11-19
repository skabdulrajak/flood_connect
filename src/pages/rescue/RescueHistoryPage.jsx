import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RefreshCw } from 'lucide-react';
import { DemoDataBadge } from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { formatTimestamp, getStatusMeta } from '../../utils/constants';

export function RescueHistoryPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getMyRescueHistory(user.id);
      setHistory(list);
    } catch (err) {
      setError(err.message || t('errors.loadRescueHistoryFailed'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0E857D]">{t('rescue.historyEyebrow')}</p>
          <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('rescue.historyHeading')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('rescue.historySubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDemoMode ? <DemoDataBadge compact /> : null}
          <button
            type="button"
            onClick={loadHistory}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('common.refresh')}</span>
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('rescue.loadingHistory')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadHistory} />
      ) : history.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('rescue.emptyHistoryTitle')}
          description={t('rescue.emptyHistoryDesc')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-[#F4F6F8] font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('common.timestamp')}</th>
                <th className="px-4 py-3">{t('rescue.tableRequestId')}</th>
                <th className="px-4 py-3">{t('rescue.tableStatusTransition')}</th>
                <th className="px-4 py-3">{t('rescue.tableResponderNotes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                    {formatTimestamp(item.created_at)}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#0B2545] whitespace-nowrap">
                    {item.request_code || item.emergency_request_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-slate-600">
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
