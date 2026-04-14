import { useState } from 'react';
import { useAds, useAdPerformance } from '../hooks';
import { AdStatus } from '@shared/types';
import { MetricCard, Spinner, EmptyState } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { BarChart2 } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { format } from 'date-fns';

function AdPerformanceChart({ adId }: { adId: string }) {
  const { data, isLoading } = useAdPerformance(adId);

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (!data?.length) return <p className="text-sm text-gray-400 text-center py-6">No performance data yet</p>;

  const chartData = data.slice(-14).map((p) => ({
    date: format(new Date(p.date), 'MMM d'),
    impressions: p.impressions,
    clicks: p.clicks,
    spend: parseFloat(p.spend.toFixed(2)),
    ctr: parseFloat(p.ctr.toFixed(2)),
  }));

  const totals = data.reduce(
    (acc, p) => ({
      impressions: acc.impressions + p.impressions,
      clicks: acc.clicks + p.clicks,
      spend: acc.spend + p.spend,
      conversions: acc.conversions + p.conversions,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
  );

  const avgCtr = totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : '0';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Impressions" value={totals.impressions.toLocaleString()} />
        <MetricCard label="Clicks" value={totals.clicks.toLocaleString()} />
        <MetricCard label="CTR" value={`${avgCtr}%`} />
        <MetricCard label="Spend" value={`$${totals.spend.toFixed(2)}`} />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">Impressions & clicks (14 days)</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="impressions" stroke="#6366F1" strokeWidth={1.5} fill="url(#gi)" dot={false} />
            <Bar dataKey="clicks" fill="#10B981" opacity={0.8} radius={[2, 2, 0, 0]} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PerformancePage() {
  const { data: adsData, isLoading } = useAds({ status: AdStatus.PUBLISHED, limit: 20 });
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);

  const publishedAds = adsData?.data ?? [];
  const activeAd = selectedAdId
    ? publishedAds.find((a) => a.id === selectedAdId)
    : publishedAds[0];

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Real-time metrics from Meta Insights API"
      />

      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !publishedAds.length ? (
          <div className="card">
            <EmptyState
              icon={<BarChart2 className="w-12 h-12" />}
              title="No published campaigns"
              description="Performance data will appear here once your ads are published"
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Ad selector */}
            <div className="card p-4 h-fit">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Published ads</p>
              <div className="space-y-1">
                {publishedAds.map((ad) => (
                  <button
                    key={ad.id}
                    onClick={() => setSelectedAdId(ad.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      (activeAd?.id === ad.id)
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{ad.headline || 'Untitled'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ${ad.budgetAmount}/{ad.budgetType === 'DAILY' ? 'day' : 'total'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div className="col-span-2 card p-5">
              {activeAd ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{activeAd.headline}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{activeAd.websiteUrl}</p>
                    </div>
                    {activeAd.metaAdId && (
                      <span className="text-xs text-gray-400 font-mono">ID: {activeAd.metaAdId}</span>
                    )}
                  </div>
                  <AdPerformanceChart adId={activeAd.id} />
                </>
              ) : (
                <EmptyState title="Select an ad" description="Choose an ad from the left to view its performance" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
