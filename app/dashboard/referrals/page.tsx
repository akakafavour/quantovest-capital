"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InvestorSidebar from "@/components/InvestorSidebar";

type Summary = { link: { code: string } | null; referredUsers: { id: string; name: string | null; email: string | null }[]; rewards: { id: number; rewardAmountCents: number; status: string; createdAt: string }[]; withdrawals: { id: number; amountCents: number; destinationType: string; status: string; createdAt: string }[]; balanceCents: number };
type Point = { month: string; label: string; signUps: number; earningsCents: number };

const MIN_REFERRAL_WITHDRAWAL_CENTS = 150_000;
const MIN_REFERRAL_WITHDRAWAL_DOLLARS = MIN_REFERRAL_WITHDRAWAL_CENTS / 100;

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReferralsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [destinationType, setDestinationType] = useState<"bank" | "crypto">("bank");
  const [destination, setDestination] = useState("");
  const [destinationDetails, setDestinationDetails] = useState("");
  const [amount, setAmount] = useState(String(MIN_REFERRAL_WITHDRAWAL_DOLLARS));
  const [origin, setOrigin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/referrals/summary", { cache: "no-store" });
      if (response.ok) setSummary(await response.json());
      else setMessage(response.status === 401 ? "Sign in to view your live referral account." : "Referral data is temporarily unavailable.");
    } catch {
      setMessage("Referral data is temporarily unavailable. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const query = new URLSearchParams();
      if (start) query.set("start", start);
      if (end) query.set("end", end);
      const response = await fetch(`/api/referrals/analytics?${query.toString()}`, { cache: "no-store" });
      if (response.ok) setPoints(await response.json());
      else setMessage(response.status === 400 ? "Choose a valid date range." : "Analytics are temporarily unavailable.");
    } catch {
      setMessage("Analytics are temporarily unavailable. Check your connection and try again.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [start, end]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const maxEarnings = Math.max(1, ...points.map(point => point.earningsCents));
  const maxSignups = Math.max(1, ...points.map(point => point.signUps));
  const chartPoints = useMemo(() => points.map((point, index) => ({ x: points.length === 1 ? 50 : (index / (points.length - 1)) * 100, y: 100 - (point.earningsCents / maxEarnings) * 82 })), [points, maxEarnings]);
  const canWithdraw = (summary?.balanceCents ?? 0) >= MIN_REFERRAL_WITHDRAWAL_CENTS;

  async function createLink() {
    try {
      const response = await fetch("/api/referrals/link", { method: "POST" });
      if (response.ok) { const link = await response.json(); setSummary(current => current ? { ...current, link } : current); setMessage("Referral link ready."); }
      else setMessage("Sign in before creating a referral link.");
    } catch {
      setMessage("Could not create a referral link. Check your connection and try again.");
    }
  }

  async function submitWithdrawal(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < MIN_REFERRAL_WITHDRAWAL_CENTS) {
      setMessage(`Minimum withdrawal is $${MIN_REFERRAL_WITHDRAWAL_DOLLARS.toLocaleString()}.`);
      return;
    }
    if (!destination.trim()) {
      setMessage("Enter a payout destination before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/referrals/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents, destinationType, destination: destination.trim(), destinationDetails: destinationDetails.trim() }) });
      const data = await response.json().catch(() => ({}));
      setMessage(response.ok ? "Withdrawal request submitted for admin review." : data.error ?? "Withdrawal request failed.");
      if (response.ok) { setDestination(""); setDestinationDetails(""); await loadSummary(); }
    } catch {
      setMessage("Withdrawal request failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const referralUrl = summary?.link && origin ? `${origin}/r/${summary.link.code}` : "";

  return (
    <div className="dashboard-shell min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <InvestorSidebar onOpenDeposit={() => {}} onOpenWithdraw={() => {}} onOpenCalculator={() => {}} />
      <main className="dashboard-main flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto pb-24 md:pb-8">
        <header>
          <p className="text-xs uppercase tracking-[0.25em] text-[#22C55E] font-mono">Investor referrals</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl text-[#F3F7F4]">Build wealth together.</h1>
          <p className="mt-3 max-w-2xl text-sm text-[#93A09A]">Track real attributed sign-ups, first-deposit rewards, and payout requests from your account ledger.</p>
        </header>
        {message && <div role="status" aria-live="polite" className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-sm text-[#22C55E]">{message}</div>}
        {loading ? <div className="grid gap-4 sm:grid-cols-3" role="status" aria-label="Loading referral summary">{[1,2,3].map(item => <div key={`referral-skeleton-${item}`} className="h-28 motion-safe:animate-pulse rounded-2xl bg-[#141C1F] border border-[#263437]" />)}</div> : <>
          <section className="grid gap-3 grid-cols-1 sm:grid-cols-3" aria-label="Referral summary">
            <div className="rounded-2xl border border-[#263437] bg-[#141C1F] p-5">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#93A09A] font-mono">Available bonus</p>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-[#F3F7F4] truncate">${formatMoney(summary?.balanceCents ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-[#263437] bg-[#141C1F] p-5">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#93A09A] font-mono">Referrals</p>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-[#F3F7F4]">{summary?.referredUsers.length ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[#263437] bg-[#141C1F] p-5">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#93A09A] font-mono">Reward rate</p>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-[#F3F7F4]">10%</p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#263437] bg-[#141C1F] p-5 sm:p-7" aria-labelledby="referral-link-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="referral-link-heading" className="text-xl font-semibold text-[#F3F7F4]">Your referral link</h2>
                <p className="mt-1 text-sm text-[#93A09A]">A reward is created only after an attributed investor completes their first approved deposit.</p>
              </div>
              <button onClick={createLink} className="min-h-11 rounded-full bg-[#22C55E] px-5 py-3 text-sm font-semibold text-[#0A0F11] hover:bg-[#16A34A] motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]">{summary?.link ? "Refresh link" : "Create link"}</button>
            </div>
            <div className="mt-5 rounded-xl border border-[#263437] bg-[#0A0F11] px-4 py-3 font-mono text-sm text-[#93A09A] break-all">{referralUrl || "No referral link created yet."}</div>
          </section>

          <section className="rounded-2xl border border-[#263437] bg-[#141C1F] p-5 sm:p-7" aria-labelledby="referral-analytics-heading">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 id="referral-analytics-heading" className="text-xl font-semibold text-[#F3F7F4]">Sign-ups and earnings</h2>
                <p className="mt-1 text-sm text-[#93A09A]">Only persisted attribution and reward records appear here.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-[#93A09A]">From<input value={start} onChange={event => setStart(event.target.value)} type="date" className="mt-1 block min-h-11 rounded-lg border border-[#263437] bg-[#0A0F11] px-3 py-2 text-sm text-[#F3F7F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]" /></label>
                <label className="text-xs text-[#93A09A]">To<input value={end} onChange={event => setEnd(event.target.value)} type="date" className="mt-1 block min-h-11 rounded-lg border border-[#263437] bg-[#0A0F11] px-3 py-2 text-sm text-[#F3F7F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]" /></label>
              </div>
            </div>
            {analyticsLoading ? <div className="mt-6 h-64 motion-safe:animate-pulse rounded-xl bg-[#0A0F11] border border-[#263437]" role="status" aria-label="Loading analytics" /> : points.length ? <div className="mt-6"><svg viewBox="0 0 100 100" className="h-64 w-full overflow-visible" role="img" aria-label="Referral earnings over time"><polyline fill="none" stroke="#22C55E" strokeWidth="1.5" points={chartPoints.map(point => `${point.x},${point.y}`).join(" ")} />{chartPoints.map((point, index) => <circle key={`referral-point-${index}`} cx={point.x} cy={point.y} r="1.8" fill="#22C55E"><title>{points[index].label}: ${(points[index].earningsCents / 100).toFixed(2)} earnings, {points[index].signUps} sign-ups</title></circle>)}</svg><div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#93A09A]"><span>Max sign-ups: {maxSignups}</span><span className="text-right">Total earnings: ${(points.reduce((sum, point) => sum + point.earningsCents, 0) / 100).toFixed(2)}</span></div></div> : <div className="mt-6 rounded-xl border border-dashed border-[#263437] px-4 py-12 text-center text-sm text-[#93A09A]" role="status">No persisted referral activity matches this period.</div>}
          </section>

          <section className="rounded-2xl border border-[#263437] bg-[#141C1F] p-5 sm:p-7" aria-labelledby="referral-withdraw-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="referral-withdraw-heading" className="text-xl font-semibold text-[#F3F7F4]">Withdraw referral bonus</h2>
                <p className="mt-1 text-sm text-[#93A09A]">Minimum request: ${MIN_REFERRAL_WITHDRAWAL_DOLLARS.toLocaleString()}. Requests remain pending until admin review.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-mono ${canWithdraw ? "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30" : "bg-[#263437] text-[#93A09A] border border-[#263437]"}`}>{canWithdraw ? "Eligible" : `Locked below $${MIN_REFERRAL_WITHDRAWAL_DOLLARS.toLocaleString()}`}</span>
            </div>
            <form onSubmit={submitWithdrawal} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-[#93A09A]">Amount (USD)<input value={amount} onChange={event => setAmount(event.target.value)} type="number" min={MIN_REFERRAL_WITHDRAWAL_DOLLARS} step="0.01" required disabled={!canWithdraw || submitting} className="mt-2 min-h-11 w-full rounded-lg border border-[#263437] bg-[#0A0F11] px-3 py-3 text-[#F3F7F4] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]" /></label>
              <label className="text-sm text-[#93A09A]">Payout rail<select value={destinationType} onChange={event => setDestinationType(event.target.value as "bank" | "crypto")} disabled={!canWithdraw || submitting} className="mt-2 min-h-11 w-full rounded-lg border border-[#263437] bg-[#0A0F11] px-3 py-3 text-[#F3F7F4] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"><option value="bank">Bank transfer</option><option value="crypto">Crypto wallet</option></select></label>
              <label className="text-sm text-[#93A09A]">{destinationType === "bank" ? "Account / bank reference" : "Wallet address"}<input value={destination} onChange={event => setDestination(event.target.value)} required disabled={!canWithdraw || submitting} autoComplete={destinationType === "bank" ? "off" : "off"} className="mt-2 min-h-11 w-full rounded-lg border border-[#263437] bg-[#0A0F11] px-3 py-3 text-[#F3F7F4] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]" /></label>
              <label className="text-sm text-[#93A09A]">{destinationType === "bank" ? "Bank and account-holder details" : "Network (optional)"}<input value={destinationDetails} onChange={event => setDestinationDetails(event.target.value)} disabled={!canWithdraw || submitting} className="mt-2 min-h-11 w-full rounded-lg border border-[#263437] bg-[#0A0F11] px-3 py-3 text-[#F3F7F4] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]" /></label>
              <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={!canWithdraw || submitting} className="min-h-11 rounded-full bg-[#22C55E] px-6 py-3 text-sm font-semibold text-[#0A0F11] hover:bg-[#16A34A] motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]">{submitting ? "Submitting…" : "Submit withdrawal"}</button></div>
            </form>
          </section>

          {summary && summary.rewards.length > 0 && (
            <section className="rounded-2xl border border-[#263437] bg-[#141C1F] p-5 sm:p-7" aria-label="Reward history">
              <h2 className="text-xl font-semibold text-[#F3F7F4]">Reward history</h2>
              <p className="mt-1 text-sm text-[#93A09A]">Completed and pending rewards from attributed referrals.</p>
              <div className="mt-4 space-y-3">
                {summary.rewards.map(reward => (
                  <div key={`reward-${reward.id}`} className="flex items-center justify-between p-4 bg-[#0A0F11] border border-[#263437] rounded-xl">
                    <div>
                      <p className="text-xs font-semibold text-[#F3F7F4]">${(reward.rewardAmountCents / 100).toFixed(2)} reward</p>
                      <p className="text-[10px] text-[#93A09A] font-mono">{new Date(reward.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-mono ${reward.status === "approved" ? "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30" : reward.status === "pending" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-[#CF202F]/15 text-[#CF202F] border border-[#CF202F]/30"}`}>{reward.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>}
      </main>
    </div>
  );
}
