import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAds, useDeleteAd, useSubmitAd } from '../hooks';
import { AdStatus } from '@shared/types';
import { StatusBadge, Spinner, EmptyState } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { FileText, PlusCircle, Trash2, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getErrorMessage } from '../lib/api';

const STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: AdStatus.DRAFT },
  { label: 'Pending', value: AdStatus.PENDING },
  { label: 'Published', value: AdStatus.PUBLISHED },
  { label: 'Rejected', value: AdStatus.REJECTED },
];

export function MyAdsPage() {
  const [statusFilter, setStatusFilter] = useState<AdStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const { data, isLoading, refetch } = useAds({ status: statusFilter, page, limit: 15 });
  const deleteAd = useDeleteAd();
  const submitAd = useSubmitAd();

  const handleDelete = async (id: string, headline: string) => {
    if (!confirm(`Delete "${headline || 'this ad'}"?`)) return;
    try {
      await deleteAd.mutateAsync(id);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const handleSubmit = async (id: string) => {
    setError('');
    try {
      await submitAd.mutateAsync(id);
      refetch();
    } catch (e) { setError(getErrorMessage(e)); }
  };

  return (
    <div>
      <PageHeader
        title="My ads"
        description={`${data?.total ?? 0} ads total`}
        action={
          <Link to="/ads/create" className="btn btn-primary">
            <PlusCircle className="w-4 h-4" /> New ad
          </Link>
        }
      />

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => { setStatusFilter(value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : !data?.data.length ? (
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="No ads here"
              description={statusFilter ? `No ${statusFilter.toLowerCase()} ads` : "Create your first ad to get started"}
              action={<Link to="/ads/create" className="btn btn-primary btn-sm">Create ad</Link>}
            />
          ) : (
            <>
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    {['Ad', 'Status', 'Objective', 'Budget', 'Created', ''].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ad) => (
                    <tr key={ad.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                            {ad.creativeUrl ? (
                              <img src={ad.creativeUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileText className="w-4 h-4 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link to={`/ads/${ad.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block max-w-[220px]">
                              {ad.headline || 'Untitled ad'}
                            </Link>
                            <p className="text-xs text-gray-400 truncate max-w-[220px]">{ad.websiteUrl}</p>
                            {ad.status === AdStatus.REJECTED && ad.rejectionReason && (
                              <p className="text-xs text-red-500 mt-0.5 max-w-[280px] truncate">
                                Rejected: {ad.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={ad.status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ad.objective.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">${ad.budgetAmount}/{ad.budgetType === 'DAILY' ? 'day' : 'total'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatDistanceToNow(new Date(ad.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {(ad.status === AdStatus.DRAFT || ad.status === AdStatus.REJECTED) && (
                            <>
                              <button
                                onClick={() => handleSubmit(ad.id)}
                                className="btn btn-sm gap-1"
                                title="Submit for approval"
                              >
                                <Send className="w-3 h-3" /> Submit
                              </button>
                              <button
                                onClick={() => handleDelete(ad.id, ad.headline)}
                                className="btn btn-sm text-red-500 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {ad.status === AdStatus.PUBLISHED && ad.latestPerformance && (
                            <span className="text-xs text-gray-400">
                              {ad.latestPerformance.impressions.toLocaleString()} impr
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {(data.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Page {page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>←</button>
                    <button className="btn btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= (data.totalPages ?? 1)}>→</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
