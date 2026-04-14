import { useState } from 'react';
import { useAdminAds, useAdminStats } from '../hooks';
import { AdStatus } from '@shared/types';
import { StatusBadge, Spinner, EmptyState, MetricCard } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { List, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function AllCampaignsPage() {
  const [status, setStatus] = useState<AdStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminAds({ status, search: search || undefined, page });
  const { data: stats } = useAdminStats();

  return (
    <div>
      <PageHeader
        title="All campaigns"
        description="Platform-wide view of every ad"
      />
      <div className="p-6 space-y-6">

        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Total ads" value={stats.totalAds} />
            <MetricCard
              label="Total impressions"
              value={(stats.totalImpressions / 1000).toFixed(1) + 'K'}
            />
            <MetricCard
              label="Total spend"
              value={`$${stats.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
            <MetricCard
              label="Avg CTR"
              value={`${(stats.avgCtr * 100).toFixed(2)}%`}
            />
          </div>
        )}

        <div className="card overflow-hidden">
          {/* Filters */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by headline, URL, or client…"
                className="input pl-9"
              />
            </div>
            <select
              value={status ?? ''}
              onChange={(e) => { setStatus((e.target.value as AdStatus) || undefined); setPage(1); }}
              className="input w-40"
            >
              <option value="">All statuses</option>
              {Object.values(AdStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : !data?.data.length ? (
            <EmptyState
              icon={<List className="w-12 h-12" />}
              title="No campaigns found"
              description="Try adjusting your filters"
            />
          ) : (
            <>
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    {['Ad', 'Client', 'Status', 'Objective', 'Budget', 'Spend', 'Impressions', 'Created'].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ad) => {
                    const totalSpend = ad.performance?.reduce((s, p) => s + p.spend, 0) ?? 0;
                    const totalImpr = ad.performance?.reduce((s, p) => s + p.impressions, 0) ?? 0;
                    return (
                      <tr key={ad.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-sm font-medium text-gray-900 truncate">{ad.headline || '—'}</p>
                          <p className="text-xs text-gray-400 truncate">{ad.websiteUrl}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ad.user?.name}</td>
                        <td className="px-4 py-3"><StatusBadge status={ad.status} /></td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ad.objective.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">${ad.budgetAmount}/{ad.budgetType === 'DAILY' ? 'd' : 'lt'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {totalSpend > 0 ? `$${totalSpend.toFixed(0)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {totalImpr > 0 ? totalImpr.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {formatDistanceToNow(new Date(ad.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {(data.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    {data.total} campaigns · Page {page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>← Prev</button>
                    <button className="btn btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= (data.totalPages ?? 1)}>Next →</button>
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
