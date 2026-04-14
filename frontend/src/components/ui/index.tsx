import { AdStatus } from '@shared/types';
import clsx from 'clsx';

// ─── Status badge ─────────────────────────────────────────────────────────────
const statusMap: Record<AdStatus, string> = {
  DRAFT:      'badge-draft',
  PENDING:    'badge-pending',
  APPROVED:   'badge-approved',
  REJECTED:   'badge-rejected',
  PUBLISHING: 'badge-publishing',
  PUBLISHED:  'badge-published',
  PAUSED:     'badge-paused',
  FAILED:     'badge-failed',
};

const statusLabel: Record<AdStatus, string> = {
  DRAFT:      'Draft',
  PENDING:    'Pending review',
  APPROVED:   'Approved',
  REJECTED:   'Rejected',
  PUBLISHING: 'Publishing…',
  PUBLISHED:  'Published',
  PAUSED:     'Paused',
  FAILED:     'Failed',
};

export function StatusBadge({ status }: { status: AdStatus }) {
  return (
    <span className={clsx('badge', statusMap[status])}>
      {statusLabel[status]}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin text-indigo-600', className ?? 'h-5 w-5')}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <p className="text-base font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="stat-card">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && (
        <p className={clsx('text-xs mt-1', {
          'text-emerald-600': trend === 'up',
          'text-red-500': trend === 'down',
          'text-gray-400': !trend || trend === 'neutral',
        })}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Ad preview (Facebook-style) ──────────────────────────────────────────────
export function AdPreview({
  primaryText,
  headline,
  description,
  cta,
  creativeUrl,
  websiteUrl,
}: {
  primaryText: string;
  headline: string;
  description?: string;
  cta: string;
  creativeUrl?: string | null;
  websiteUrl?: string;
}) {
  const domain = websiteUrl
    ? new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace('www.', '')
    : 'yourdomain.com';

  const ctaLabel = cta.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="w-full max-w-sm rounded-xl overflow-hidden border border-gray-200 bg-[#f0f2f5]">
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          YP
        </div>
        <div>
          <p className="text-[13px] font-semibold text-gray-900">Your Page</p>
          <p className="text-[11px] text-gray-500">Sponsored · <svg className="inline w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg></p>
        </div>
      </div>

      {/* Primary text */}
      {primaryText && (
        <p className="px-3 pb-2 text-[13px] text-gray-800 leading-relaxed line-clamp-3">
          {primaryText}
        </p>
      )}

      {/* Creative */}
      <div className="w-full h-44 bg-gray-200 overflow-hidden">
        {creativeUrl ? (
          <img src={creativeUrl} alt="Ad creative" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            Creative preview
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{domain}</p>
          <p className="text-[13px] font-semibold text-gray-900 truncate">{headline || 'Your headline'}</p>
          {description && <p className="text-[11px] text-gray-500 truncate">{description}</p>}
        </div>
        <button className="ml-3 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded flex-shrink-0">
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
