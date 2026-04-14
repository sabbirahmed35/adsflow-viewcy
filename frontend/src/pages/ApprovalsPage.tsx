import { useState } from 'react';
import { useAdminPending, useApproveAd, useRejectAd } from '../hooks';
import { AdPreview, StatusBadge, Spinner, EmptyState } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { CheckCircle, XCircle, CheckSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getErrorMessage } from '../lib/api';
import { Ad } from '@shared/types';
import clsx from 'clsx';

function ApprovalCard({ ad }: { ad: Ad }) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const approveAd = useApproveAd();
  const rejectAd = useRejectAd();

  const handleApprove = async () => {
    setError('');
    try {
      await approveAd.mutateAsync(ad.id);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const handleReject = async () => {
    if (!reason.trim() || reason.length < 10) {
      setError('Please provide a more detailed rejection reason (min 10 chars)');
      return;
    }
    setError('');
    try {
      await rejectAd.mutateAsync({ id: ad.id, reason });
    } catch (e) { setError(getErrorMessage(e)); }
  };

  return (
    <div className="card p-5">
      <div className="grid grid-cols-2 gap-6">
        {/* Left: details */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-gray-900">{ad.headline || 'Untitled ad'}</h3>
            <StatusBadge status={ad.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Primary text</p>
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{ad.primaryText}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Submitted by</span>
                <span className="text-gray-700">{ad.user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Objective</span>
                <span className="text-gray-700">{ad.objective.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Budget</span>
                <span className="text-gray-700">${ad.budgetAmount}/{ad.budgetType === 'DAILY' ? 'day' : 'total'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Audience</span>
                <span className="text-gray-700">{ad.ageMin}–{ad.ageMax} · {ad.locations.slice(0, 2).join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Placements</span>
                <span className="text-gray-700">{ad.placements.join(', ').replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Submitted</span>
                <span className="text-gray-700">{formatDistanceToNow(new Date(ad.updatedAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          {ad.interests.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">Interests</p>
              <div className="flex flex-wrap gap-1">
                {ad.interests.map((i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{i}</span>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {showRejectForm ? (
            <div className="space-y-2">
              <label className="label">Rejection reason (shown to client)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input min-h-[80px]"
                placeholder="Explain clearly what needs to be fixed…"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleReject}
                  disabled={rejectAd.isPending}
                >
                  {rejectAd.isPending ? <Spinner className="w-3 h-3" /> : <><XCircle className="w-3 h-3" /> Confirm rejection</>}
                </button>
                <button className="btn btn-sm" onClick={() => { setShowRejectForm(false); setReason(''); setError(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                className="btn btn-success"
                onClick={handleApprove}
                disabled={approveAd.isPending}
              >
                {approveAd.isPending ? <Spinner className="w-4 h-4" /> : <><CheckCircle className="w-4 h-4" /> Approve & publish</>}
              </button>
              <button
                className="btn text-red-600 hover:bg-red-50"
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle className="w-4 h-4" /> Reject…
              </button>
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Ad preview</p>
          <AdPreview
            primaryText={ad.primaryText}
            headline={ad.headline}
            description={ad.description}
            cta={ad.cta}
            creativeUrl={ad.creativeUrl}
            websiteUrl={ad.websiteUrl}
          />
          {ad.websiteUrl && (
            <a
              href={ad.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline mt-2 block"
            >
              Visit landing page →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function ApprovalsPage() {
  const { data: ads, isLoading } = useAdminPending();

  return (
    <div>
      <PageHeader
        title="Ad approvals"
        description={ads?.length ? `${ads.length} ads waiting for review` : 'Review and approve submitted ads'}
      />
      <div className="p-6 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !ads?.length ? (
          <div className="card">
            <EmptyState
              icon={<CheckSquare className="w-12 h-12" />}
              title="All caught up!"
              description="No ads are currently pending review"
            />
          </div>
        ) : (
          ads.map((ad) => <ApprovalCard key={ad.id} ad={ad} />)
        )}
      </div>
    </div>
  );
}
