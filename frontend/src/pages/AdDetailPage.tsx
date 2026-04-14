import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAd, useAdPerformance, useSubmitAd, useDeleteAd } from '../hooks';
import { AdStatus, UserRole } from '@shared/types';
import { StatusBadge, Spinner, AdPreview, MetricCard, EmptyState } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuthStore } from '../store/auth.store';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { getErrorMessage } from '../lib/api';
import {
  ArrowLeft, Send, Trash2, ExternalLink, BarChart2,
  CheckCircle, Clock, XCircle, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';

// Status timeline component
function StatusTimeline({ status, rejectionReason, reviewedAt, createdAt, updatedAt }: {
  status: AdStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  const steps = [
    { key: 'DRAFT',     label: 'Created',          icon: Clock },
    { key: 'PENDING',   label: 'Submitted',         icon: Clock },
    { key: 'APPROVED',  label: 'Approved',          icon: CheckCircle },
    { key: 'PUBLISHED', label: 'Published on Meta', icon: Zap },
  ];

  const order = ['DRAFT', 'PENDING', 'APPROVED', 'PUBLISHING', 'PUBLISHED'];
  const currentIdx = order.indexOf(status);

  const isRejected = status === AdStatus.REJECTED;
  const isFailed = status === AdStatus.FAILED;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Status timeline</h3>

      {isRejected && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Rejected</span>
            {reviewedAt && (
              <span className="text-xs text-red-400 ml-auto">
                {format(new Date(reviewedAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          {rejectionReason && (
            <p className="text-sm text-red-600 leading-relaxed">{rejectionReason}</p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {steps.map((step, i) => {
          const stepIdx = order.indexOf(step.key);
          const done = currentIdx > stepIdx || (currentIdx === stepIdx && !isRejected && !isFailed);
          const current = currentIdx === stepIdx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                done
                  ? 'bg-emerald-500 text-white'
                  : current
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-400'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1">
                <p className={`text-sm ${done || current ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {i === 0 && (
                  <p className="text-xs text-gray-400">{format(new Date(createdAt), 'MMM d, yyyy h:mm a')}</p>
                )}
              </div>
              {done && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();
  const isAdmin = user?.role === UserRole.ADMIN;

  const { data: ad, isLoading } = useAd(id!);
  const { data: performance } = useAdPerformance(id!);
  const submitAd = useSubmitAd();
  const deleteAd = useDeleteAd();

  const handleSubmit = async () => {
    try {
      await submitAd.mutateAsync(id!);
      toast.success('Submitted for review', 'An admin will review your ad shortly');
    } catch (e) {
      toast.error('Submission failed', getErrorMessage(e));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this ad? This cannot be undone.')) return;
    try {
      await deleteAd.mutateAsync(id!);
      toast.success('Ad deleted');
      navigate('/ads');
    } catch (e) {
      toast.error('Delete failed', getErrorMessage(e));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="p-6">
        <EmptyState title="Ad not found" description="This ad may have been deleted or you don't have access" />
      </div>
    );
  }

  const chartData = (performance ?? []).slice(-14).map((p) => ({
    date: format(new Date(p.date), 'MMM d'),
    impressions: p.impressions,
    clicks: p.clicks,
    spend: parseFloat(p.spend.toFixed(2)),
  }));

  const totals = (performance ?? []).reduce(
    (acc, p) => ({
      impressions: acc.impressions + p.impressions,
      clicks: acc.clicks + p.clicks,
      spend: acc.spend + p.spend,
    }),
    { impressions: 0, clicks: 0, spend: 0 }
  );

  const canEdit = ad.status === AdStatus.DRAFT || ad.status === AdStatus.REJECTED;
  const canSubmit = canEdit;
  const canDelete = ad.status === AdStatus.DRAFT;

  return (
    <div>
      <PageHeader
        title={ad.headline || 'Ad detail'}
        description={ad.websiteUrl}
        action={
          <div className="flex items-center gap-2">
            <Link to="/ads" className="btn btn-sm gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            {canSubmit && (
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitAd.isPending}>
                {submitAd.isPending ? <Spinner className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                Submit for review
              </button>
            )}
            {canDelete && (
              <button className="btn btn-sm text-red-500 hover:bg-red-50" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        }
      />

      <div className="p-6 grid grid-cols-3 gap-6">
        {/* Left column - 2 wide */}
        <div className="col-span-2 space-y-6">
          {/* Ad copy card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Ad copy</h3>
              <StatusBadge status={ad.status} />
            </div>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 mb-1">Primary text</dt>
                <dd className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-lg p-3">{ad.primaryText || '—'}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-gray-400 mb-1">Headline</dt>
                  <dd className="text-sm font-medium text-gray-900">{ad.headline || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 mb-1">Description</dt>
                  <dd className="text-sm text-gray-700">{ad.description || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 mb-1">Call to action</dt>
                  <dd className="text-sm text-gray-700">{ad.cta.replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 mb-1">Destination URL</dt>
                  <dd>
                    <a href={ad.websiteUrl} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                      {ad.websiteUrl.replace('https://', '').substring(0, 40)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          {/* Campaign settings card */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign settings</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {[
                ['Objective', ad.objective.replace(/_/g, ' ')],
                ['Budget', `$${ad.budgetAmount} ${ad.budgetType.toLowerCase()}`],
                ['Audience age', `${ad.ageMin}–${ad.ageMax}`],
                ['Locations', ad.locations.join(', ')],
                ['Placements', ad.placements.join(', ').replace(/_/g, ' ')],
                ['Interests', ad.interests.length ? ad.interests.join(', ') : 'None specified'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-gray-800 font-medium">{value}</p>
                </div>
              ))}
            </div>

            {(ad.metaCampaignId || ad.metaAdId) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Meta API IDs</p>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono text-gray-500">
                  {ad.metaCampaignId && <span>Campaign: {ad.metaCampaignId}</span>}
                  {ad.metaAdSetId && <span>Ad set: {ad.metaAdSetId}</span>}
                  {ad.metaAdId && <span>Ad: {ad.metaAdId}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Performance */}
          {ad.status === AdStatus.PUBLISHED && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance (last 14 days)</h3>
              {chartData.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <BarChart2 className="w-4 h-4" />
                  Performance data syncs every 2 hours
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <MetricCard label="Impressions" value={totals.impressions.toLocaleString()} />
                    <MetricCard label="Clicks" value={totals.clicks.toLocaleString()} />
                    <MetricCard
                      label="Spend"
                      value={`$${totals.spend.toFixed(2)}`}
                    />
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="impressions" stroke="#6366F1" strokeWidth={1.5}
                            fill="url(#grad2)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Ad preview */}
          <div className="card p-4">
            <p className="text-xs text-gray-400 mb-3">Ad preview</p>
            <AdPreview
              primaryText={ad.primaryText}
              headline={ad.headline}
              description={ad.description}
              cta={ad.cta}
              creativeUrl={ad.creativeUrl}
              websiteUrl={ad.websiteUrl}
            />
          </div>

          {/* Status timeline */}
          <StatusTimeline
            status={ad.status}
            rejectionReason={ad.rejectionReason}
            reviewedAt={ad.reviewedAt}
            createdAt={ad.createdAt}
            updatedAt={ad.updatedAt}
          />

          {/* Admin info */}
          {isAdmin && ad.user && (
            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-2">Submitted by</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold">
                  {ad.user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{ad.user.name}</p>
                  <p className="text-xs text-gray-400">{ad.user.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
