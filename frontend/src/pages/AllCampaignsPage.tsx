import { useState } from 'react';
import { useAdminAds, useAdminStats } from '../hooks';
import { AdStatus } from '@shared/types';
import { StatusBadge, Spinner, EmptyState, MetricCard } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { List, Search, RefreshCw, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

export function AllCampaignsPage() {
  const [status, setStatus] = useState<AdStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading, isFetching, dataUpdatedAt } = useAdminAds({ status, search: search || undefined, page });
  const { data: stats } = useAdminStats();

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['adminAds'] });
    qc.invalidateQueries({ queryKey: ['adminStats'] });
  };

  // Format campaign name from metaCampaignId or headline
  const getCampaignName = (ad: any) => {
    if (ad.metaCampaignId) {
      return `Campaign ${ad.metaCampaignId.slice(-6)}`;
    }
    return ad.headline || '—';
  };

  // Get last performance update time
  const getLastUpdated = (ad: any) => {
    if (!ad.performance?.length) return null;
    const dates = ad.performance.map((p: any) => new Date(p.createdAt || p.date));
    return new Date(Math.max(...dates.map((d: Date) => d.getTime())));
  };

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

            {/* Last updated + refresh button */}
            <div className="ml-auto flex items-center gap-3">
              {dataUpdatedAt > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  Updated {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
                </div>
              )}
              <button
                onClick={handleRefresh}
                className="btn btn-sm gap-1.5"
                disabled={isFetching}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
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
                    {['Campaign', 'Client', 'Status', 'Objective', 'Budget', 'Spend', 'Impressions', 'Data Updated', 'Created'].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ad) => {
                    const totalSpend = ad.performance?.reduce((s: number, p: any) => s + p.spend, 0) ?? 0;
                    const totalImpr = ad.performance?.reduce((s: number, p: any) => s + p.impressions, 0) ?? 0;
                    const lastUpdated = getLastUpdated(ad);
                    return (
                      <tr key={ad.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getCampaignName(ad)}
                          </p>
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
                          {lastUpdated ? (
                            <div>
                              <p>{format(lastUpdated, 'MMM d, HH:mm')}</p>
                              <p className="text-gray-300">{formatDistanceToNow(lastUpdated, { addSuffix: true })}</p>
                            </div>
                          ) : (
                            <span className="text-gray-300">No data yet</span>
                          )}
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
