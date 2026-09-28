'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import InvestorSidebar from '@/components/InvestorSidebar';
import KycModal from '@/components/KycModal';
import { createClient } from '@/lib/supabase/client';
import { PLAN_MINIMUMS, PLAN_ORDER } from '@/lib/constants';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import dynamicImport from 'next/dynamic';

const DynamicAllocationRingChart = dynamicImport(() => import('@/components/AllocationRingChart'), {
  ssr: false,
  loading: () => (
    <div className="p-6 rounded-2xl bg-[#141C1F] border border-[#263437] h-56 motion-safe:animate-pulse" role="status" aria-label="Loading allocation chart" />
  ),
});
const DashboardAreaChart = dynamicImport(() => import('@/components/DashboardAreaChart'), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full rounded-xl border border-[#263437] bg-[#0A0F11] motion-safe:animate-pulse" role="status" aria-label="Loading portfolio chart" />
  ),
});

interface Profile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  balance: number;
  totalInvested: number;
  totalProfit: number;
  dailyRoiPercent: number;
  allTimeRoiPercent: number;
  plan: string;
  kycStatus: string;
  onboardingCompleted: boolean;
  tourCompleted: boolean;
  accountStatus?: string | null;
}

interface DepositRow {
  id: string;
  investorId: string;
  amountCents: number;
  method: string;
  proofPath: string | null;
  planId: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface WithdrawalRow {
  id: number;
  investorId: string;
  amountCents: number;
  destinationType: string;
  destination: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface KycRow {
  id: number;
  investorId: string;
  documentPath: string;
  status: string;
  createdAt: string;
}

interface LedgerRow {
  id: number;
  type: string;
  amountCents: number;
  createdAt: string;
}

interface ChartPoint {
  date: string;
  value: number;
}

interface ActivityLog {
  id: string;
  kind: 'deposit' | 'withdrawal';
  date: string;
  timestamp: number;
  percentage: number;
  marketNote: string;
}

function formatMoneyTwoDecimals(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LoadingSkeleton() {
  return (
    <div className="dashboard-shell min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <div className="hidden md:flex flex-col w-64 bg-[#0D1214] border-r border-[#202A2D] h-screen sticky top-0 animate-pulse">
        <div className="p-6 border-b border-[#202A2D]">
          <div className="w-32 h-4 bg-[#263437] rounded" />
        </div>
        <div className="m-4 p-4 bg-[#151D20] border border-[#263437] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#263437]" />
            <div className="space-y-2 flex-1">
              <div className="w-24 h-3 bg-[#263437] rounded" />
              <div className="w-32 h-2 bg-[#263437] rounded" />
            </div>
          </div>
        </div>
      </div>
      <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto">
        <div className="flex items-center gap-3 pb-6 border-b border-[#263437]">
          <div className="w-12 h-12 rounded-full bg-[#263437] animate-pulse" />
          <div className="space-y-2">
            <div className="w-48 h-6 bg-[#263437] rounded animate-pulse" />
            <div className="w-32 h-3 bg-[#263437] rounded animate-pulse" />
          </div>
        </div>
        <div className="p-6 sm:p-8 rounded-2xl bg-[#141C1F] border border-[#263437] space-y-6 animate-pulse">
          <div className="w-40 h-3 bg-[#263437] rounded" />
          <div className="w-64 h-10 bg-[#263437] rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#263437]">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="w-20 h-2 bg-[#263437] rounded" />
                <div className="w-28 h-5 bg-[#263437] rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-[#141C1F] border border-[#263437] h-80 animate-pulse" />
        <div className="p-6 rounded-2xl bg-[#141C1F] border border-[#263437] space-y-4 animate-pulse">
          <div className="w-48 h-4 bg-[#263437] rounded" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[#0A0F11] border border-[#263437] rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dashboard-shell min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm" role="alert">
          <Icon icon="solar:server-bold" className="w-12 h-12 text-[#CF202F] mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[#F3F7F4]">Unable to Load Dashboard</h2>
          <p className="text-sm text-[#93A09A]">{message}</p>
          <button
            onClick={onRetry}
            className="min-h-11 px-6 py-2.5 rounded-full bg-[#22C55E] text-[#0A0F11] text-xs font-semibold hover:bg-[#16A34A] motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvestorDashboard() {
  const [profile, setProfile] = useState<Profile>({
    id: '', name: '', email: '', avatar: null, role: 'investor', balance: 0,
    totalInvested: 0, totalProfit: 0, dailyRoiPercent: 0, allTimeRoiPercent: 0,
    plan: 'Starter', kycStatus: 'pending', onboardingCompleted: false, tourCompleted: false,
    accountStatus: null,
  });
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [kycData, setKycData] = useState<KycRow[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [dailyLogs, setDailyLogs] = useState<ActivityLog[]>([]);

  const [isMasked, setIsMasked] = useState(false);
  const [isKycOpen, setIsKycOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const managerRedirected = useRef(false);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [profileRes, depositsRes, withdrawalsRes, kycRes, allocationsRes, historyRes] = await Promise.all([
        fetch('/api/investor-profile', { headers }),
        fetch('/api/deposits', { headers }),
        fetch('/api/withdrawals', { headers }),
        fetch('/api/kyc', { headers }),
        fetch('/api/traders/my', { headers }),
        fetch('/api/history', { headers }),
      ]);

      const [profileData, depositsData, withdrawalsData, kycDataRes, allocationsData, historyData] = await Promise.all([
        profileRes.ok ? profileRes.json() : Promise.resolve(null),
        depositsRes.ok ? depositsRes.json() : Promise.resolve([] as DepositRow[]),
        withdrawalsRes.ok ? withdrawalsRes.json() : Promise.resolve([] as WithdrawalRow[]),
        kycRes.ok ? kycRes.json() : Promise.resolve([] as KycRow[]),
        allocationsRes.ok ? allocationsRes.json() : Promise.resolve([] as Array<{ status?: string }>),
        historyRes.ok ? historyRes.json() : Promise.resolve([] as LedgerRow[]),
      ]) as [Profile | null, DepositRow[], WithdrawalRow[], KycRow[], Array<{ status?: string }>, LedgerRow[]];

      if (profileData) {
        setProfileLoaded(true);
        if (profileData.role === 'admin') {
          window.location.href = '/admin';
          return;
        }
        setProfile(profileData);
      }
      setDeposits(depositsData);
      setWithdrawals(withdrawalsData);
      setKycData(kycDataRes);

      const approvedDeposits = depositsData.filter(d => d.status === 'approved' || d.status === 'completed');
      const approvedWithdrawals = withdrawalsData.filter(w => w.status === 'approved');
      const hasActiveManager = allocationsData.some(allocation => allocation.status === 'active');

      if (
        profileData &&
        profileData.kycStatus === 'approved' &&
        approvedDeposits.length > 0 &&
        !hasActiveManager &&
        !managerRedirected.current &&
        window.location.pathname === '/dashboard'
      ) {
        managerRedirected.current = true;
        window.location.replace('/dashboard/traders?funded=1');
        return;
      }

      // Equity curve: replay the signed portfolio ledger chronologically so every
      // balance event (deposit, profit credit, withdrawal) moves the chart and all
      // three modes (area/line/bar) render the same movement.
      const ledgerEvents = (Array.isArray(historyData) ? historyData : [])
        .filter((e) => e && Number.isFinite(e.amountCents) && e.createdAt)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (profileData && ledgerEvents.length > 0) {
        const totalDelta = ledgerEvents.reduce((sum, e) => sum + e.amountCents / 100, 0);
        let running = profileData.balance >= totalDelta ? profileData.balance - totalDelta : 0;
        const points: ChartPoint[] = ledgerEvents.map((e) => {
          running = Math.round((running + e.amountCents / 100) * 100) / 100;
          return {
            date: new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
            value: running,
          };
        });
        const last = points[points.length - 1];
        if (last && Math.abs(last.value - profileData.balance) > 0.005) {
          points.push({
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
            value: profileData.balance,
          });
        }
        setChartData(points);
      } else if (profileData && approvedDeposits.length > 0) {
        let cumulative = 0;
        const points: ChartPoint[] = approvedDeposits.map((d) => {
          cumulative += d.amountCents / 100;
          const date = new Date(d.createdAt);
          return {
            date: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
            value: cumulative,
          };
        });
        if (profileData.balance > cumulative) {
          points.push({
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
            value: profileData.balance,
          });
        }
        setChartData(points);
      } else if (profileData) {
        setChartData([
          { date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), value: profileData.balance },
        ]);
      }

      const logs: ActivityLog[] = [
        ...approvedDeposits.map((d) => {
          const created = new Date(d.createdAt);
          const time = Number.isNaN(created.getTime()) ? 0 : created.getTime();
          return {
            id: d.id,
            kind: 'deposit' as const,
            date: created.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            timestamp: time,
            percentage: 0,
            marketNote: `Deposit of $${formatMoneyTwoDecimals(d.amountCents / 100)} via ${d.method}`,
          };
        }),
        ...approvedWithdrawals.map((w) => {
          const created = new Date(w.createdAt);
          const time = Number.isNaN(created.getTime()) ? 0 : created.getTime();
          return {
            id: String(w.id),
            kind: 'withdrawal' as const,
            date: created.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            timestamp: time,
            percentage: 0,
            marketNote: `Withdrawal of $${formatMoneyTwoDecimals(w.amountCents / 100)} to ${w.destination}`,
          };
        }),
      ].sort((a, b) => b.timestamp - a.timestamp);

      setDailyLogs(logs);
    } catch {
      setLoadError('We could not load your dashboard. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const kycStatus = kycData.length > 0 ? kycData[0].status : profile.kycStatus;
  const avatarSeed = encodeURIComponent(profile.name || profile.email || 'investor');
  const avatarSrc = profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`;
  const allTimePositive = profile.allTimeRoiPercent >= 0;

  if (isLoading && !profileLoaded) {
    return <LoadingSkeleton />;
  }

  if (loadError && !profileLoaded) {
    return <ErrorState message={loadError} onRetry={() => void fetchAllData()} />;
  }

  return (
    <div className="dashboard-shell min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <InvestorSidebar
        onOpenDeposit={() => {}}
        onOpenWithdraw={() => {}}
      />

      <main className="dashboard-main flex-1 min-w-0 p-3 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto pb-24 md:pb-8">
        {/* Top Header Bar */}
        <div className="dashboard-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#263437] pb-5 sm:pb-6">
          <div className="flex items-center gap-3 min-w-0">
            <img src={avatarSrc} alt={profile.name || 'Investor avatar'} width={48} height={48} onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`; }} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#22C55E]/40 object-cover shadow-md shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-normal text-[#F3F7F4] truncate">Hello, {profile.name}</h1>
              <p className="text-xs text-[#93A09A] flex flex-wrap items-center gap-x-2 gap-y-1">
                {profile.plan && (
                  <>
                    Plan: <span className="text-[#22C55E] font-semibold font-mono">{profile.plan}</span>
                    <span>•</span>
                  </>
                )}
                KYC:{' '}
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    kycStatus === 'approved' ? 'text-[#22C55E]' : 'text-amber-400'
                  }`}
                >
                  {kycStatus === 'approved' ? 'VERIFIED' : kycStatus.toUpperCase()}
                </span>
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            {kycStatus !== 'approved' && (
              <button
                onClick={() => setIsKycOpen(true)}
                className="min-h-11 w-full justify-center px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
              >
                <Icon icon="solar:shield-warning-bold" className="w-4 h-4" />
                <span>Complete Verification</span>
              </button>
            )}
            <button
              onClick={() => setIsUpgradeOpen(true)}
              className="min-h-11 w-full justify-center px-4 py-2 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs font-medium hover:bg-[#22C55E]/20 transition-colors flex items-center gap-1.5"
            >
              <Icon icon="solar:arrow-up-line-bold" className="w-4 h-4" />
              <span>Upgrade Plan</span>
            </button>
          </div>
        </div>

        {/* KYC Floating Banner Alert */}
        {kycStatus !== 'approved' && (
          <div className="dashboard-kyc-alert p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Icon icon="solar:shield-warning-bold" className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] sm:text-xs text-amber-200">
                <strong>Identity Verification Pending:</strong> Complete minimal 2-document upload (Government ID + Proof of Address) to enable instant copytrade processing.
              </p>
            </div>
            <button
              onClick={() => setIsKycOpen(true)}
              className="w-full sm:w-auto px-5 py-2 rounded-full bg-amber-400 text-[#F3F7F4] text-xs font-semibold hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Upload Documents Now
            </button>
          </div>
        )}

        {/* Account Closure Banner */}
        {profile.accountStatus === 'closing' && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Icon icon="solar:info-circle-bold" className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[10px] sm:text-xs text-rose-200">
                <strong>Account closure requested:</strong> your close-account withdrawal is pending admin review. Deposits, swaps and new withdrawals are paused until it is resolved.
              </p>
            </div>
            <Link
              href="/dashboard/withdraw"
              className="w-full sm:w-auto px-5 py-2 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 transition-colors whitespace-nowrap shrink-0 text-center"
            >
              View Request
            </Link>
          </div>
        )}

        {/* Physical Metallic Balance Card */}
        <div className="dashboard-balance-card relative overflow-hidden p-4 sm:p-8 rounded-2xl bg-[#141C1F] border border-[#263437] shadow-2xl space-y-5 sm:space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-mono tracking-wider text-[#93A09A]">Total Portfolio Balance</p>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-2xl sm:text-5xl font-mono font-semibold text-[#F3F7F4] break-all">
                  {isMasked ? '••••••••' : `$${formatMoneyTwoDecimals(profile.balance)}`}
                </h2>
                <button
                  onClick={() => setIsMasked(!isMasked)}
                  aria-label={isMasked ? 'Show portfolio balance' : 'Hide portfolio balance'}
                  className="min-h-11 min-w-11 p-2 text-[#93A09A] hover:text-[#F3F7F4] transition-colors touch-manipulation"
                >
                  <Icon icon={isMasked ? 'solar:eye-bold' : 'solar:eye-closed-bold'} className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chip Graphic */}
            <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-amber-300 via-amber-500 to-amber-600 p-1 flex items-center justify-center opacity-90 shadow-inner">
              <div className="w-full h-full border border-amber-800/40 rounded flex items-center justify-center text-[10px] font-mono text-amber-950 font-bold">
                QC
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#263437]">
            <div>
              <p className="text-[10px] uppercase font-mono text-[#93A09A]">Total Invested</p>
              <p className="text-base font-mono font-semibold text-[#F3F7F4]">${formatMoneyTwoDecimals(profile.totalInvested)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono text-[#93A09A]">Total ROI Profit</p>
              <p className="text-base font-mono font-semibold text-[#22C55E]">+${formatMoneyTwoDecimals(profile.totalProfit)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono text-[#93A09A]">Cycle ROI (7-day)</p>
              <p className={`text-base font-mono font-semibold ${profile.dailyRoiPercent >= 0 ? 'text-[#22C55E]' : 'text-[#CF202F]'}`}>
                {profile.dailyRoiPercent >= 0 ? '+' : ''}{profile.dailyRoiPercent}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono text-[#93A09A]">All-Time Return</p>
              <p className={`text-base font-mono font-semibold ${allTimePositive ? 'text-[#22C55E]' : 'text-[#CF202F]'}`}>{allTimePositive ? '+' : ''}{profile.allTimeRoiPercent}%</p>
            </div>
          </div>
        </div>

        {/* Interactive Performance & Calculator Graph */}
        <div className="dashboard-chart-card p-4 sm:p-6 rounded-2xl bg-[#141C1F] border border-[#263437] space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-normal text-[#F3F7F4] flex items-center gap-2">
                Portfolio Performance
                <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
              </h3>
              <p className="text-xs text-[#93A09A]">Account value over time based on recorded strategy performance updates</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-3 py-1 rounded-full">
                Performance history
              </span>
            </div>
          </div>

          <DashboardAreaChart chartData={chartData} />
        </div>

        {/* Portfolio Allocation Ring Chart */}
        <DynamicAllocationRingChart plan={profile.plan} />

        {/* Daily Strategy Activity Log */}
        <div className="dashboard-activity-card p-4 sm:p-6 rounded-2xl bg-[#141C1F] border border-[#263437] space-y-4">
          <h3 className="text-base font-normal text-[#F3F7F4]">Strategy Performance Activity</h3>
          <div className="space-y-3">
            {dailyLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Icon icon="solar:document-text-bold" className="w-10 h-10 text-[#263437] mx-auto mb-3" />
                <p className="text-xs text-[#93A09A]">No activity recorded yet</p>
              </div>
            ) : (
              dailyLogs.map((log) => (
                <div key={`${log.kind}-${log.id}`} className="p-4 bg-[#0A0F11] border border-[#263437] rounded-xl flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${log.percentage >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#CF202F]/10 text-[#CF202F]'}`}>
                      <Icon icon={log.percentage >= 0 ? 'solar:graph-up-bold' : 'solar:graph-down-bold'} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F3F7F4] leading-relaxed break-words">{log.marketNote}</p>
                      <p className="text-[10px] text-[#93A09A] font-mono">{log.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-mono font-semibold ${log.percentage >= 0 ? 'text-[#22C55E]' : 'text-[#CF202F]'}`}>
                      {log.percentage !== 0 ? `${log.percentage >= 0 ? '+' : ''}${log.percentage}%` : '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <KycModal isOpen={isKycOpen} onClose={() => setIsKycOpen(false)} />

      {/* Upgrade Plan Modal */}
      {isUpgradeOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141C1F] border border-[#263437] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Upgrade Your Plan</h3>
              <button onClick={() => setIsUpgradeOpen(false)} className="text-[#93A09A] hover:text-white">
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-[#93A09A]">Your current plan is <span className="text-[#22C55E] font-semibold">{profile.plan}</span>. Upgrade to unlock higher ROI tiers.</p>
            <div className="space-y-3">
              {(['Starter', 'Growth', 'Elite'] as const).map((planName) => {
                const min = PLAN_MINIMUMS[planName];
                const currentIdx = PLAN_ORDER.indexOf(profile.plan as any);
                const targetIdx = PLAN_ORDER.indexOf(planName);
                const isCurrent = profile.plan === planName;
                const isLower = targetIdx <= currentIdx;
                return (
                  <div key={planName} className={`p-4 rounded-xl border transition-colors ${
                    isCurrent ? 'border-[#22C55E]/40 bg-[#22C55E]/5' : 'border-[#263437] bg-[#0A0F11]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-[#F3F7F4]">{planName} Plan</p>
                        <p className="text-[10px] text-[#93A09A]">Min. deposit: ${min.toLocaleString()}</p>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E]">Current</span>
                      ) : isLower ? (
                        <span className="text-[10px] text-[#93A09A]">Lower plan</span>
                      ) : (
                        <button
                          disabled={upgradingPlan !== null}
                          onClick={async () => {
                            setUpgradeError(null);
                            setUpgradingPlan(planName);
                            try {
                              const res = await fetch('/api/investor/upgrade', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ planName })
                              });
                              const data = await res.json().catch(() => null);
                              if (res.ok && data?.success) {
                                setProfile(p => ({ ...p, plan: planName }));
                                setIsUpgradeOpen(false);
                              } else {
                                setUpgradeError(data?.error || 'Upgrade failed. Please try again.');
                              }
                            } catch {
                              setUpgradeError('Network error — please try again.');
                            } finally {
                              setUpgradingPlan(null);
                            }
                          }}
                          className="text-[10px] font-semibold px-4 py-1.5 rounded-full bg-[#22C55E] text-[#07110B] hover:bg-[#16A34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {upgradingPlan === planName ? 'Upgrading…' : 'Upgrade'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {upgradeError && (
              <p className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {upgradeError}
              </p>
            )}
            <Link href="/dashboard/deposit" onClick={() => setIsUpgradeOpen(false)} className="block text-center text-[10px] text-[#22C55E] hover:underline">
              Go to Deposit →
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
