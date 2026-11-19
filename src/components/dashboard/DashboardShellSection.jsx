import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Info } from 'lucide-react';
import { EmptyState } from '../common/StateFeedback';

export function DashboardShellSection({
  title,
  description,
  icon,
  overviewPath,
  plannedStageNote,
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      {plannedStageNote ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#13A89E]" aria-hidden="true" />
          <span>{plannedStageNote}</span>
        </div>
      ) : null}

      <EmptyState title={title} description={description} icon={icon} />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={overviewPath}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#0B2545] hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('nav.overview')}</span>
        </Link>
        <Link
          to="/profile"
          className="rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
        >
          {t('nav.profile')}
        </Link>
      </div>
    </div>
  );
}
