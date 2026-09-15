'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import EmptyState from '@/components/admin/EmptyState';
import SkeletonRows from '@/components/admin/SkeletonRows';

export const dynamic = 'force-dynamic';
type Withdrawal = { id: number; investorId: string; investorName: string | null; investorEmail: string | null; amountCents: number; destinationType: string; destination: string; status: string; reviewedBy: string | null; reviewNote: string | null; accountStatus: string | null; createdAt: string; updatedAt: string };
function formatDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function formatCents(value: number) { return `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [view, setView] = useState<'pending' | 'history'>('pending');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  async function load() { setLoading(true); const response = await fetch('/api/admin/withdrawals', { cache: 'no-store' }); if (response.ok) setWithdrawals(await response.json()); else setMessage('Withdrawal records are temporarily unavailable.'); setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function review(withdrawalId: number, action: 'approve' | 'reject') { setMessage(''); const response = await fetch('/api/admin/withdrawals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ withdrawalId, action }) }); const data = await response.json().catch(() => ({})); setMessage(response.ok ? (data.accountClosed ? 'Withdrawal approved and investor account closed.' : `Withdrawal ${action}d successfully.`) : data.error ?? 'Action failed.'); await load(); }
  const visible = useMemo(() => withdrawals.filter(row => view === 'pending' ? row.status === 'pending' : row.status !== 'pending'), [withdrawals, view]);
  return (
    <div className="min-h-screen bg-[#0D1215] text-[#E8EFEB] flex flex-col md:flex-row font-sans">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto pb-24 md:pb-8">
        <div className="border-b border-[#2B393F] pb-6 space-y-1">
          <h1 className="text-2xl font-normal">Withdrawal Operations</h1>
          <p className="text-xs text-[#93A09A]">Review pending payout requests and audit completed decisions.</p>
        </div>
        {message && <div role="status" className="rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/10 p-4 text-xs text-[#86EFAC]">{message}</div>}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">Withdrawal Records</h2>
            <p className="text-xs text-[#7F8C86] mt-1">{withdrawals.length} total records</p>
          </div>
          <div className="flex rounded-full border border-[#2B393F] bg-[#151E23] p-1">
            {(['pending', 'history'] as const).map(tab => <button key={tab} type="button" onClick={() => setView(tab)} className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${view === tab ? 'bg-[#22C55E] text-[#07110B]' : 'text-[#93A09A] hover:text-white'}`}>{tab}</button>)}
          </div>
        </div>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={view === 'pending' ? 'No pending withdrawals' : 'No withdrawal history'}
            hint="Approved or rejected payout requests will show up in the history view."
            icon="solar:card-transfer-bold"
          />
        ) : (
          <div className="space-y-4">
            {visible.map(row => (
              <article key={row.id} className="p-5 rounded-2xl bg-[#151E23] border border-[#2B393F]">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{row.investorName ?? 'Unnamed investor'}</p>
                      {row.status === 'pending' && row.accountStatus === 'closing' && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[9px] font-bold uppercase tracking-wider">Close account</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#7F8C86]">{row.investorEmail ?? row.investorId}</p>
                    <p className="text-2xl font-mono font-semibold text-white mt-3">{formatCents(row.amountCents)}</p>
                    <p className="text-xs text-[#93A09A] font-mono">{row.destinationType}: {row.destination}</p>
                    <p className="text-[10px] text-[#93A09A] font-mono">Submitted {formatDate(row.createdAt)} · <span className="capitalize">{row.status}</span>{row.reviewedBy ? ` · Reviewed by ${row.reviewedBy}` : ''}</p>
                    {row.reviewNote && <p className="text-xs text-[#A8B6AD] mt-2">Note: {row.reviewNote}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {row.status === 'pending' ? (
                      <>
                        <button type="button" onClick={() => void review(row.id, 'approve')} className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[#22C55E] text-[#E8EFEB] hover:bg-[#16A34A]">Approve</button>
                        <button type="button" onClick={() => void review(row.id, 'reject')} className="px-6 py-2.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">Reject</button>
                      </>
                    ) : (
                      <span className={`px-4 py-1.5 rounded-full font-mono text-xs font-semibold ${row.status === 'approved' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-red-500/10 text-red-400'}`}>{row.status.toUpperCase()}</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}