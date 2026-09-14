'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminSidebar from '@/components/AdminSidebar';
import EmptyState from '@/components/admin/EmptyState';
import { Icon } from '@iconify/react';

interface InvestorRow {
  id: string;
  name: string | null;
  email: string;
  accountId: string | null;
  accountStatus: string | null;
  planId: string | null;
  balanceCents: number;
  principalCents: number;
  planName: string | null;
  minRoiBps: number | null;
  maxRoiBps: number | null;
}

interface KycRow {
  id: number;
  investorId: string;
  status: string;
  createdAt: string;
}

interface WithdrawalRow {
  id: number;
  investorId: string;
  amountCents: number;
  status: string;
  destinationType: string;
  createdAt: string;
  updatedAt?: string;
  reviewNote?: string | null;
}

interface DepositRow {
  id: string;
  investorId: string;
  amountCents: number;
  method: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  reviewNote?: string | null;
}

interface PerformanceRow {
  id: number;
  investorId: string;
  percentageBps: number;
  profitCents: number;
  marketNote: string;
  entryDate: string;
  publishedBy: string;
  planName: string | null;
}

interface PlanRow {
  id: number;
  name: string;
  minimumDepositCents: number;
  maximumDepositCents: number | null;
  minRoiBps: number;
  maxRoiBps: number;
}

function formatCents(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US');
}

const PAGE_SIZE = 10;

export default function AdminInvestorsPage() {
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [kycApps, setKycApps] = useState<KycRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceInvestorId, setBalanceInvestorId] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceSuccess, setBalanceSuccess] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planInvestorId, setPlanInvestorId] = useState('');
  const [planName, setPlanName] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [planSuccess, setPlanSuccess] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const loadInvestors = useCallback(async () => {
    try {
      const invRes = await fetch('/api/admin/investors', { credentials: 'include' as const });
      if (invRes.ok) setInvestors(await invRes.json());
    } catch {
      setErrorMsg('Failed to refresh investor list.');
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const opts = { credentials: 'include' as const };
        const [invRes, kycRes, wdRes, depRes, perfRes, plansRes] = await Promise.all([
          fetch('/api/admin/investors', opts),
          fetch('/api/admin/kyc?status=all', opts),
          fetch('/api/admin/withdrawals', opts),
          fetch('/api/admin/deposits?status=all', opts),
          fetch('/api/admin/roi', opts),
          fetch('/api/admin/plans', opts),
        ]);
        if (invRes.ok) {
          setInvestors(await invRes.json());
        } else {
          const body = await invRes.json().catch(() => null);
          const msg = body?.error || `Failed to load investors (HTTP ${invRes.status}).`;
          const detail = body?.detail ? ` — ${body.detail}` : '';
          setErrorMsg(`${msg}${detail}`);
        }
        if (kycRes.ok) setKycApps(await kycRes.json());
        if (wdRes.ok) setWithdrawals(await wdRes.json());
        if (depRes.ok) setDeposits(await depRes.json());
        if (perfRes.ok) setPerformance(await perfRes.json());
        if (plansRes.ok) setPlans(await plansRes.json());
      } catch {
        setErrorMsg('Failed to connect to the server.');
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  const filtered = investors.filter(inv => {
    const q = searchQuery.toLowerCase();
    return (inv.name?.toLowerCase().includes(q) || inv.email?.toLowerCase().includes(q));
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  function getKycForInvestor(investorId: string): KycRow[] {
    return kycApps.filter(k => k.investorId === investorId);
  }

  function getWithdrawalsForInvestor(investorId: string): WithdrawalRow[] {
    return withdrawals.filter(w => w.investorId === investorId);
  }

  function getDepositsForInvestor(investorId: string): DepositRow[] {
    return deposits.filter(d => d.investorId === investorId);
  }

  function getPerformanceForInvestor(investorId: string): PerformanceRow[] {
    return performance.filter(p => p.investorId === investorId);
  }

  function getLatestKycStatus(investorId: string): string | null {
    const apps = getKycForInvestor(investorId);
    if (apps.length === 0) return null;
    return apps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].status;
  }

  return (
    <div className="min-h-screen bg-[#0D1215] text-[#E8EFEB] flex flex-col md:flex-row font-sans">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto pb-24 md:pb-8">
        <div className="border-b border-[#2B393F] pb-6 space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#22C55E] font-mono">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            INVESTOR MANAGEMENT
          </div>
          <h1 className="text-2xl font-normal text-[#E8EFEB]">Investor Accounts</h1>
          <p className="text-xs text-[#93A09A]">Search, view, and manage investor accounts and activity.</p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-300">{errorMsg}</div>
        )}

        {/* Search */}
        <div className="max-w-md">
          <div className="relative">
            <Icon icon="solar:magnifer-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7F8C86]" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-[#2B393F] bg-[#151E23] pl-10 pr-4 py-3 text-sm text-white placeholder-[#7F8C86]"
            />
          </div>
        </div>

        {/* Investor Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse rounded-2xl bg-[#1A252C] border border-[#2B393F] h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={investors.length === 0 ? 'No investors yet' : 'No matching investors'}
            hint={investors.length === 0 ? 'New investor accounts will appear here.' : 'Try a different name or email search.'}
            icon="solar:user-bold"
          />
        ) : (
          <div className="rounded-2xl border border-[#2B393F] bg-[#151E23] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-[#2B393F] text-[10px] uppercase font-mono text-[#7F8C86]">
                    <th className="px-4 py-3 font-medium">Investor</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium text-right">Balance</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
            {paged.map(inv => {
              const isExpanded = expandedId === inv.id;
              const kycStatus = getLatestKycStatus(inv.id);
              const investorWithdrawals = getWithdrawalsForInvestor(inv.id);
              const investorDeposits = getDepositsForInvestor(inv.id);
              const investorPerformance = getPerformanceForInvestor(inv.id);
              const investorKyc = getKycForInvestor(inv.id);
              const timeline = [
                ...investorDeposits.map(row => ({ type: 'Deposit', status: row.status, amount: row.amountCents, date: row.createdAt, note: row.reviewNote })),
                ...investorPerformance.map(row => ({ type: 'Performance', status: 'credited', amount: row.profitCents, date: row.entryDate, note: row.marketNote })),
                ...investorKyc.map(row => ({ type: 'KYC', status: row.status, amount: null, date: row.createdAt, note: null })),
                ...investorWithdrawals.map(row => ({ type: 'Withdrawal', status: row.status, amount: -row.amountCents, date: row.createdAt, note: row.reviewNote })),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              return (
                <React.Fragment key={inv.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    className="border-b border-[#2B393F]/60 hover:bg-[#1A252C] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-[#E8EFEB] truncate max-w-[220px]">{inv.name ?? 'Unnamed'}</p>
                      <p className="text-[10px] text-[#7F8C86] font-mono truncate max-w-[220px]">{inv.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#E8EFEB]">{inv.planName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-[#22C55E] text-right whitespace-nowrap">{formatCents(inv.balanceCents)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {kycStatus && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                            kycStatus === 'approved'
                              ? 'bg-[#22C55E]/10 text-[#22C55E]'
                              : kycStatus === 'pending'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            KYC: {kycStatus}
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                          inv.accountStatus === 'active'
                            ? 'bg-[#22C55E]/10 text-[#22C55E]'
                            : inv.accountStatus
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-[#2B393F] text-[#7F8C86]'
                        }`}>
                          {inv.accountStatus ? String(inv.accountStatus).toUpperCase() : 'NO ACCOUNT'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Icon
                        icon="solar:alt-arrow-down-bold"
                        className={`w-4 h-4 text-[#93A09A] transition-transform inline-block ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="border-b border-[#2B393F] bg-[#0D1215]/60">
                      <td colSpan={5} className="px-4 py-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-[#0D1215] border border-[#2B393F] rounded-xl p-4">
                          <p className="text-[10px] uppercase font-mono text-[#93A09A] mb-1">Principal</p>
                          <p className="text-lg font-mono text-[#E8EFEB]">{formatCents(inv.principalCents)}</p>
                        </div>
                        <div className="bg-[#0D1215] border border-[#2B393F] rounded-xl p-4">
                          <p className="text-[10px] uppercase font-mono text-[#93A09A] mb-1">ROI Range</p>
                          <p className="text-lg font-mono text-[#E8EFEB]">
                            {inv.minRoiBps != null && inv.maxRoiBps != null
                              ? `${(inv.minRoiBps / 100).toFixed(2)}% – ${(inv.maxRoiBps / 100).toFixed(2)}%`
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-[#0D1215] border border-[#2B393F] rounded-xl p-4">
                          <p className="text-[10px] uppercase font-mono text-[#93A09A] mb-1">Account ID</p>
                          <p className="text-[10px] font-mono text-[#93A09A] break-all">{inv.accountId ?? 'No account'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setBalanceInvestorId(inv.id);
                            setBalanceAmount('');
                            setBalanceReason('');
                            setBalanceSuccess(null);
                            setBalanceError(null);
                            setBalanceModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 hover:bg-[#22C55E]/20 transition-colors"
                        >
                          <Icon icon="solar:wallet-bold" className="w-3.5 h-3.5" />
                          Add Balance
                        </button>
                        <Link
                          href="/admin/performance"
                          className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/20 transition-colors"
                        >
                          <Icon icon="solar:graph-up-bold" className="w-3.5 h-3.5" />
                          Add ROI via Daily ROI Entry
                        </Link>
                        <button
                          onClick={() => {
                            setPlanInvestorId(inv.id);
                            setPlanName('');
                            setPlanSuccess(null);
                            setPlanError(null);
                            setPlanModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-[#3B82F6]/20 transition-colors"
                        >
                          <Icon icon="solar:layer-bold" className="w-3.5 h-3.5" />
                          Assign Plan
                        </button>
                      </div>

                      {/* KYC History */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#E8EFEB] mb-2">KYC History</h4>
                        {investorKyc.length === 0 ? (
                          <p className="text-[10px] text-[#7F8C86] italic">No KYC submissions.</p>
                        ) : (
                          <div className="space-y-2">
                            {investorKyc.map(k => (
                              <div key={k.id} className="flex items-center gap-3 text-[10px] font-mono text-[#93A09A]">
                                <span className={`w-2 h-2 rounded-full ${
                                  k.status === 'approved' ? 'bg-[#22C55E]' : k.status === 'pending' ? 'bg-amber-400' : 'bg-rose-400'
                                }`} />
                                <span>ID: {k.id}</span>
                                <span className="capitalize">{k.status}</span>
                                <span>{new Date(k.createdAt).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Withdrawals */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#E8EFEB] mb-2">Recent Withdrawals</h4>
                        {investorWithdrawals.length === 0 ? (
                          <p className="text-[10px] text-[#7F8C86] italic">No withdrawal history.</p>
                        ) : (
                          <div className="space-y-2">
                            {investorWithdrawals.slice(0, 5).map(w => (
                              <div key={w.id} className="flex items-center gap-3 text-[10px] font-mono text-[#93A09A]">
                                <span className={`w-2 h-2 rounded-full ${
                                  w.status === 'approved' ? 'bg-[#22C55E]' : w.status === 'pending' ? 'bg-amber-400' : 'bg-rose-400'
                                }`} />
                                <span>{formatCents(w.amountCents)}</span>
                                <span className="capitalize">{w.destinationType}</span>
                                <span className="capitalize">{w.status}</span>
                                <span>{new Date(w.createdAt).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Unified Timeline */}
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2"><h4 className="text-xs font-semibold text-[#E8EFEB]">Account Timeline</h4><span className="text-[10px] font-mono text-[#7F8C86]">{timeline.length} events</span></div>
                        {timeline.length === 0 ? <p className="text-[10px] text-[#7F8C86]">No account activity recorded.</p> : <div className="space-y-2">{timeline.slice(0, 12).map((event, index) => <div key={`${event.type}-${event.date}-${index}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl bg-[#0D1215] border border-[#2B393F] p-3 text-[10px] font-mono"><span className="w-2 h-2 rounded-full bg-[#22C55E] shrink-0" /><span className="text-white font-semibold">{event.type}</span><span className="capitalize text-[#93A09A]">{event.status}</span>{event.amount !== null && <span className={event.amount >= 0 ? 'text-[#22C55E]' : 'text-rose-300'}>{event.amount >= 0 ? '+' : ''}{formatCents(event.amount)}</span>}<span className="text-[#7F8C86] sm:ml-auto">{new Date(event.date).toLocaleString()}</span>{event.note && <span className="text-[#7F8C86] truncate max-w-full sm:max-w-[240px]" title={event.note}>{event.note}</span>}</div>)}</div>}
                      </div>
                    </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#2B393F]">
              <p className="text-[10px] font-mono text-[#7F8C86]">Showing {rangeStart}–{rangeEnd} of {filtered.length} investors</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                  className="px-3 py-1.5 rounded-lg border border-[#2B393F] text-[10px] font-mono text-[#93A09A] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-[10px] font-mono text-[#7F8C86]">Page {safePage + 1} / {pageCount}</span>
                <button
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount - 1}
                  className="px-3 py-1.5 rounded-lg border border-[#2B393F] text-[10px] font-mono text-[#93A09A] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Balance Modal */}
      {balanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setBalanceModalOpen(false)}>
          <div className="bg-[#151E23] border border-[#2B393F] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[#E8EFEB] mb-4">Add Balance (Credit Account)</h3>

            {balanceSuccess && <div className="mb-3 p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[10px] font-mono text-[#22C55E]">{balanceSuccess}</div>}
            {balanceError && <div className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-300">{balanceError}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-mono text-[#93A09A] mb-1">Amount (USD)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={balanceAmount}
                  onChange={e => setBalanceAmount(e.target.value)}
                  placeholder="e.g. 150.00"
                  className="w-full rounded-xl border border-[#2B393F] bg-[#0D1215] px-4 py-2.5 text-sm text-white placeholder-[#7F8C86] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-[#93A09A] mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={balanceReason}
                  onChange={e => setBalanceReason(e.target.value)}
                  placeholder="e.g. VIP bonus"
                  className="w-full rounded-xl border border-[#2B393F] bg-[#0D1215] px-4 py-2.5 text-sm text-white placeholder-[#7F8C86]"
                />
              </div>
              <button
                disabled={balanceLoading || !balanceAmount || Number(balanceAmount) <= 0}
                onClick={async () => {
                  setBalanceLoading(true);
                  setBalanceError(null);
                  setBalanceSuccess(null);
                  try {
                    const res = await fetch('/api/admin/balance', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        investorId: balanceInvestorId,
                        amountCents: Math.round(Number(balanceAmount) * 100),
                        reason: balanceReason.trim() || undefined,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to add balance');
                    setBalanceSuccess(`$${Number(balanceAmount).toFixed(2)} credited to funding balance (principal + balance).`);
                    await loadInvestors();
                    setTimeout(() => setBalanceModalOpen(false), 1500);
                  } catch (err: any) {
                    setBalanceError(err.message);
                  } finally {
                    setBalanceLoading(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-[#22C55E] text-black text-sm font-semibold hover:bg-[#16A34A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {balanceLoading ? 'Processing...' : 'Add Balance'}
              </button>
            </div>

            <button onClick={() => setBalanceModalOpen(false)} className="mt-3 w-full py-2 rounded-xl border border-[#2B393F] text-[#93A09A] text-xs hover:bg-[#1A252C] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Assign Plan Modal */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPlanModalOpen(false)}>
          <div className="bg-[#151E23] border border-[#2B393F] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[#E8EFEB] mb-4">Assign Plan</h3>

            {planSuccess && <div className="mb-3 p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[10px] font-mono text-[#22C55E]">{planSuccess}</div>}
            {planError && <div className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-300">{planError}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-mono text-[#93A09A] mb-1">Select Plan</label>
                <div className="space-y-1.5">
                  {plans.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPlanName(p.name)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                        planName === p.name
                          ? 'bg-[#3B82F6]/10 border-[#3B82F6]/50 text-[#3B82F6]'
                          : 'border-[#2B393F] bg-[#0D1215] text-[#93A09A] hover:border-[#3B82F6]/30'
                      }`}
                    >
                      <span className="font-semibold">{p.name}</span>
                      <span className="ml-2 text-[10px] font-mono opacity-60">
                        Min ${(p.minimumDepositCents / 100).toLocaleString()} · ROI {(p.minRoiBps / 100).toFixed(1)}%–{(p.maxRoiBps / 100).toFixed(1)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                disabled={planLoading || !planName}
                onClick={async () => {
                  setPlanLoading(true);
                  setPlanError(null);
                  setPlanSuccess(null);
                  try {
                    const res = await fetch('/api/admin/assign-plan', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ investorId: planInvestorId, planName }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to assign plan');
                    setPlanSuccess(`Plan set to "${planName}".`);
                    setInvestors(prev => prev.map(inv =>
                      inv.id === planInvestorId ? { ...inv, planName, planId: String(plans.find(p => p.name === planName)?.id ?? inv.planId) } : inv
                    ));
                    setTimeout(() => setPlanModalOpen(false), 1500);
                  } catch (err: any) {
                    setPlanError(err.message);
                  } finally {
                    setPlanLoading(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-semibold hover:bg-[#2563EB] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {planLoading ? 'Assigning...' : 'Assign Plan'}
              </button>
            </div>

            <button onClick={() => setPlanModalOpen(false)} className="mt-3 w-full py-2 rounded-xl border border-[#2B393F] text-[#93A09A] text-xs hover:bg-[#1A252C] transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
