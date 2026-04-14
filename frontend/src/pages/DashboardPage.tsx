import { Link } from 'react-router-dom';
import { useAds, useAdminStats } from '../hooks';
import { useAuthStore } from '../store/auth.store';
import { UserRole, AdStatus } from '@shared/types';
import { MetricCard, StatusBadge, Spinner, EmptyState } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { PlusCircle, FileText } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';
import { format, subDays } from 'date-fns';

// Fake chart data for demo
function generateChartData() {
  return Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    return {
      date: format(date, 'MMM d'),
      impressions: Math.floor(Math.random() * 2000) + 800,
      clicks: Math.floor(Math.random() * 120) + 30,
      spend: parseFloat((Math.random() * 30 + 15).toFixed(2)),
    };
  });
}

const chartData = generateChartData();

export function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === UserRole.ADMIN;

  const { data: adsData, isLoading } = useAds({ limit: 5 });
  const { data: stats } = useAdminStats();

  const pending = adsData?.data.filter((a) => a.status === AdStatus.PENDING).length ?? 0;
  const published = adsData?.data.filter((a) => a.status === AdStatus.PUBLISHED).length ?? 0;

  return (
    <div>
      <PageHeader
        title={`Good morning, ${user?.name.split(' ')[0]} 👋`}
        description="Here's what's happening with your campaigns"
        action={
          <Link to="/ads/create" className="btn btn-primary">
            <PlusCircle className="w-4 h-4" /> New ad
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Total ads" value={adsData?.total ?? '—'} />
          <MetricCard
            label="Published"
            value={published}
            sub="Active now"
            trend="neutral"
          />
          <MetricCard
            label="Pending review"
            value={pending}
            sub={pending > 0 ? 'Needs attention' : 'All clear'}
            trend={pending > 0 ? 'down' : 'up'}
          />
          {isAdmin && stats ? (
            <MetricCard
              label="Total spend"
              value={`$${stats.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              sub="All campaigns"
            />
          ) : (
            <MetricCard label="Avg CTR" value="5.0%" sub="+0.3pp this week" trend="up" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Recent ads */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Recent ads</h3>
              <Link to="/ads" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : !adsData?.data.length ? (
              <EmptyState
                icon={<FileText className="w-10 h-10" />}
                title="No ads yet"
                description="Create your first ad to get started"
                action={<Link to="/ads/create" className="btn btn-primary btn-sm">Create ad</Link>}
              />
            ) : (
              <div className="space-y-3">
                {adsData.data.map((ad) => (
                  <Link
                    key={ad.id}
                    to={`/ads/${ad.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                      {ad.creativeUrl ? (
                        <img src={ad.creativeUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ad.headline || 'Untitled ad'}</p>
                      <p className="text-xs text-gray-400 truncate">{ad.objective} · ${ad.budgetAmount}/day</p>
                    </div>
                    <StatusBadge status={ad.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Performance chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Impressions (14 days)</h3>
              <span className="text-xs text-gray-400">All campaigns</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="stat-card">
                <p className="text-xs text-gray-500">Impressions</p>
                <p className="text-lg font-semibold">24.1K</p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-gray-500">Clicks</p>
                <p className="text-lg font-semibold">1,204</p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-gray-500">CTR</p>
                <p className="text-lg font-semibold">5.0%</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v: number) => [v.toLocaleString(), 'Impressions']}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="url(#grad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
