import { useTranslation } from 'react-i18next';
import {
  AlertOctagon,
  CheckCircle2,
  Cpu,
  FlaskConical,
  Landmark,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  getInfoOriginMeta,
  getSeverityMeta,
  getStatusMeta,
} from '../../utils/constants';

const ORIGIN_STYLES = {
  citizen_submitted: {
    classes: 'bg-[#FEF5EC] text-[#9A4D09] border-[#F28C28]/40',
    Icon: User,
  },
  admin_verified: {
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
    Icon: ShieldCheck,
  },
  official_government: {
    classes: 'bg-[#0B2545] text-white border-[#0B2545]',
    Icon: Landmark,
  },
  ai_suggested: {
    classes: 'bg-[#ECFAF8] text-[#0A625C] border-[#13A89E]/40',
    Icon: Cpu,
  },
};

const TONE_CLASSES = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
  amber: 'bg-amber-50 text-amber-900 border-amber-500/40',
  orange: 'bg-[#FEF5EC] text-[#9A4D09] border-[#F28C28]/45',
  red: 'bg-red-50 text-red-800 border-red-600/35',
  teal: 'bg-[#ECFAF8] text-[#0A625C] border-[#13A89E]/40',
  navy: 'bg-slate-100 text-[#0B2545] border-[#0B2545]/25',
  slate: 'bg-slate-100 text-slate-700 border-slate-300',
};

/**
 * Distinct badge for the four required information types:
 * Citizen-submitted, Admin-verified, Official / Government, AI-suggested.
 */
export function OriginBadge({ origin, labelOverride = '' }) {
  useTranslation();
  const meta = getInfoOriginMeta(origin);
  const style = ORIGIN_STYLES[origin] || ORIGIN_STYLES.citizen_submitted;
  const IconComp = style.Icon;

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold shrink-0 ${style.classes}`}
    >
      <IconComp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{labelOverride || meta.label}</span>
    </span>
  );
}

export function StatusBadge({ status, kind = 'incident' }) {
  useTranslation();
  const meta = getStatusMeta(status, kind);
  const toneClass = TONE_CLASSES[meta.tone] || TONE_CLASSES.slate;
  const isVerifiedOrResolved = status === 'verified' || status === 'resolved';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold shrink-0 ${toneClass}`}
    >
      {isVerifiedOrResolved ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{meta.label}</span>
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const { t } = useTranslation();
  const meta = getSeverityMeta(severity || 'medium');
  const toneClass = TONE_CLASSES[meta.tone] || TONE_CLASSES.slate;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold shrink-0 ${toneClass}`}
    >
      {severity === 'critical' ? (
        <AlertOctagon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      <span>
        {t('common.severity')}: {meta.label}
      </span>
    </span>
  );
}

/**
 * Mandatory badge shown on every screen / data block displaying simulated East Godavari demo records.
 */
export function DemoDataBadge({ compact = false }) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-[#F28C28] bg-[#FEF5EC] font-semibold text-[#9A4D09] shrink-0 ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-[#C06310]" aria-hidden="true" />
      <span>{t('demo.badgeLabel')}</span>
    </span>
  );
}
