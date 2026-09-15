'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import EmptyState from '@/components/admin/EmptyState';
import SkeletonRows from '@/components/admin/SkeletonRows';
import { Icon } from '@iconify/react';

type Investor = { id: string; name: string | null; email: string | null; planName: string | null; balanceCents: number | null; planId: number | null };
type Performance = { id: number; investorId: string; investorName: string | null; investorEmail: string | null; planName: string | null; percentageBps: number; profitCents: number; marketNote: string; publishedBy: string; entryDate: string; createdAt: string };

const PLAN_ROI: Record<string, { weekly: number; label: string }> = {
  Starter: { weekly: 15, label: '15% / 7 Days' },
  Growth: { weekly: 25, label: '25% / 7 Days' },
  Elite: { weekly: 35, label: '35% / 7 Days' },
};

function formatCents(cents: number | null | undefined) {
  return `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminPerformanceHomePage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [history, setHistory] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? investors.filter(investor =>
        investor.name?.toLowerCase().includes(query) ||
        investor.email?.toLowerCase().includes(query) ||
        investor.id.toLowerCase().includes(query)
      )
    : investors;

  useEffect(() => {
    (async () => {
      try {
        const [investorResponse, historyResponse] = await Promise.all([
          fetch('/api/admin/investors', { cache: 'no-store' }),
          fetch('/api/admin/roi', { cache: 'no-store' }).catch(() => null),
        ]);
        if (investorResponse.ok) setInvestors(await investorResponse.json());
        else setMessage('Unable to load investors.');
        if (historyResponse && historyResponse.ok) setHistory(await historyResponse.json());
      } catch {
        setMessage('Unable to load investors.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0D1215] text-[#E8EFEB] flex flex-col md:flex-row font-sans">
      <AdminSidebar />
      <main className="flex-1 min-w-0 p-3 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto pb-24 md:pb-8">
        <div className="border-b border-[#2B393F] pb-5 sm:pb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#22C55E] font-mono"><span className="w-2 h-2 rounded-full bg-[#22C55E]" /> PERFORMANCE OPERATIONS</div>
          <h1 className="text-xl sm:text-2xl font-normal">Daily ROI Entry</h1>
          <p className="max-w-2xl text-xs leading-relaxed text-[#93A09A]">Select an investor to enter an exact ROI/profit credit and a message. Credits can be applied at any time.</p>
        </div>

        {message && <div role="status" className="p-4 rounded-xl text-xs bg-[#CF202F]/10 border border-[#CF202F]/50 text-[#FCA5A5]">{message}</div>}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[#2B393F] bg-[#151E23] p-3 sm:p-4">
          <label className="relative flex-1 block">
            <span className="sr-only">Search investors</span>
            <Icon icon="solar:magnifer-bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7F8C86]" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search by name or email…"
              className="w-full min-h-12 rounded-xl border border-[#2B393F] bg-[#0D1215] pl-11 pr-4 py-3 text-sm text-white placeholder-[#7F8C86] focus:border-[#F59E0B]/50 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/15"
            />
          </label>
          <span className="text-[11px] font-mono text-[#7F8C86] whitespace-nowrap">
            {searchQuery ? `${filtered.length} of ` : ''}{investors.length} investors
          </span>
        </div>

        {loading ? (
          <SkeletonRows rows={4} height="h-16" />
        ) : investors.length === 0 ? (
          <EmptyState title="No investors yet" hint="Investors appear here once they fund their account." icon="solar:users-group-rounded-bold" />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" hint="Try a different name or email." icon="solar:magnifer-bold" />
        ) : (
          <div className="max-h-[calc(100vh-18rem)] min-h-0 overflow-y-auto pr-1 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(investor => (
              <button
                key={investor.id}
                onClick={() => router.push(`/admin/performance/${investor.id}`)}
                className="min-h-[156px] rounded-2xl border border-[#2B393F] bg-[#151E23] p-4 sm:p-5 text-left hover:border-[#F59E0B]/50 hover:bg-[#1A252C] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 transition-all space-y-3 touch-manipulation"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{investor.name ?? 'Unnamed investor'}</p>
                    <p className="text-[10px] text-[#7F8C86] truncate mt-0.5">{investor.email ?? investor.id}</p>
                    <p className="mt-2 text-[10px] text-[#93A09A]">Tap to open ROI entry</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                    <Icon icon="solar:graph-up-bold" className="w-3 h-3" />
                    Add ROI
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-[#0D1215] border border-[#2B393F] p-2.5">
                    <p className="text-[9px] uppercase font-mono text-[#7F8C86]">Plan</p>
                    <p className="mt-0.5 font-mono font-semibold text-white">{investor.planName ?? 'No plan'}</p>
                  </div>
                  <div className="rounded-xl bg-[#0D1215] border border-[#2B393F] p-2.5">
                    <p className="text-[9px] uppercase font-mono text-[#7F8C86]">Balance</p>
                    <p className="mt-0.5 font-mono font-semibold text-[#22C55E]">{formatCents(investor.balanceCents)}</p>
                  </div>
                </div>
              </button>
              ))}
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-[#2B393F] bg-[#151E23] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><h2 className="text-base font-semibold text-white">Performance credit history</h2><p className="text-xs text-[#7F8C86] mt-1">UTC-dated records for audit and duplicate prevention.</p></div><span className="text-[11px] font-mono text-[#93A09A]">{history.length} records</span></div>
          {loading ? (
            <SkeletonRows rows={3} height="h-16" />
          ) : history.length === 0 ? (
            <EmptyState
              title="No performance credits yet"
              hint="Applied strategy credits will appear here, dated for audit and duplicate prevention."
              icon="solar:graph-up-bold"
            />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-[10px] uppercase font-mono text-[#7F8C86] border-b border-[#2B393F]"><tr><th className="py-3 pr-4">Investor</th><th className="py-3 pr-4">Plan</th><th className="py-3 pr-4">Rate</th><th className="py-3 pr-4">Credit</th><th className="py-3 pr-4">Date</th><th className="py-3">Admin</th></tr></thead><tbody>{history.map(entry => <tr key={entry.id} className="border-b border-[#2B393F]/60 last:border-0"><td className="py-3 pr-4"><p className="font-semibold text-white">{entry.investorName ?? 'Unnamed investor'}</p><p className="text-[10px] text-[#7F8C86]">{entry.investorEmail ?? entry.investorId}</p></td><td className="py-3 pr-4 text-[#93A09A]">{entry.planName ?? '—'}</td><td className="py-3 pr-4 font-mono text-[#22C55E]">{entry.percentageBps / 100}%</td><td className="py-3 pr-4 font-mono text-white">{formatCents(entry.profitCents)}</td><td className="py-3 pr-4 text-[#93A09A]">{formatDate(entry.entryDate)}</td><td className="py-3 text-[#7F8C86] font-mono">{entry.publishedBy}</td></tr>)}</tbody></table></div>
          )}
        </section>

        <section className="rounded-2xl border border-[#2B393F] bg-[#151E23] p-5 space-y-4"><h2 className="text-sm font-semibold text-white">Fixed performance reference</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{Object.entries(PLAN_ROI).map(([plan, { weekly, label }]) => <div key={plan} className="rounded-xl bg-[#0D1215] border border-[#2B393F] p-4 text-center"><p className="text-xs text-[#93A09A]">{plan}</p><p className="text-2xl font-mono font-bold text-[#22C55E] mt-1">{weekly}%</p><p className="text-[10px] text-[#7F8C86] mt-1">{label}</p></div>)}</div></section>
      </main>
    </div>
  );
}
