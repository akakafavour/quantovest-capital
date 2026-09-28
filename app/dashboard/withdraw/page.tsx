'use client';

import React, { useEffect, useState } from 'react';
import InvestorSidebar from '@/components/InvestorSidebar';
import { Icon } from '@iconify/react';
import Link from 'next/link';

type UserProfile = {
  balance: number;
  plan: string;
  twoFactorEnabled: boolean;
  payoutDetails: { cryptoAddress: string; cryptoNetwork: string; bankName: string; bankAccountName: string; bankAccountNumber: string };
};

type Withdrawal = { id: number; amountCents: number; destination: string; destinationType: string; status: string; createdAt: string };

const MIN_WITHDRAW_BALANCE = 3000;

function maskBankAccount(accountNumber: string): string {
  if (!accountNumber) return '';
  if (accountNumber.length <= 4) return '****';
  return `****${accountNumber.slice(-4)}`;
}

export default function WithdrawPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState(MIN_WITHDRAW_BALANCE);
  const [destinationType, setDestinationType] = useState<'bank' | 'crypto'>('bank');
  const [closeAccountMode, setCloseAccountMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function loadProfile() {
    try {
      const res = await fetch('/api/investor-profile', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          balance: data.balanceCents != null ? data.balanceCents / 100 : Number(data.balance ?? 0),
          plan: data.plan ?? '',
          twoFactorEnabled: data.twoFactorEnabled ?? false,
          payoutDetails: data.payoutDetails ?? { cryptoAddress: '', cryptoNetwork: '', bankName: '', bankAccountName: '', bankAccountNumber: '' },
        });
      } else if (res.status === 401) {
        setLoadError('Sign in to manage withdrawals.');
      }
    } catch {
      setLoadError('Could not load your balance. Check your connection and try again.');
    }
  }

  async function loadWithdrawals() {
    try {
      const res = await fetch('/api/withdrawals', { cache: 'no-store' });
      if (res.ok) setWithdrawals(await res.json());
    } catch {
      setLoadError('Could not load withdrawal history. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError('');
      await Promise.all([loadProfile(), loadWithdrawals()]);
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (closeAccountMode && profile) setAmount(profile.balance);
  }, [closeAccountMode, profile]);

  function getPayoutDisplay(): string {
    if (!profile) return '';
    if (destinationType === 'crypto') {
      const addr = profile.payoutDetails.cryptoAddress || '';
      if (!addr) return '';
      return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : maskBankAccount(addr);
    }
    const { bankName, bankAccountNumber } = profile.payoutDetails;
    if (bankName && bankAccountNumber) return `${bankName} ${maskBankAccount(bankAccountNumber)}`;
    return '';
  }

  function getPayoutPayload(): string {
    if (!profile) return '';
    if (destinationType === 'crypto') return (profile.payoutDetails.cryptoAddress || '').trim();
    const { bankName, bankAccountNumber, bankAccountName } = profile.payoutDetails;
    const parts = [bankName?.trim(), bankAccountNumber?.trim(), bankAccountName?.trim()].filter(Boolean);
    return parts.join(' ').trim();
  }

  const balance = profile?.balance ?? 0;
  const eligible = balance >= MIN_WITHDRAW_BALANCE;
  const hasPayoutDetails = destinationType === 'crypto'
    ? !!profile?.payoutDetails.cryptoAddress
    : (!!profile?.payoutDetails.bankName && !!profile?.payoutDetails.bankAccountNumber);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true); setMessage('');

    if (!eligible) {
      setMessage('A minimum balance of $3,000 is required to withdraw.');
      setSubmitting(false);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setMessage('Enter a valid amount within your available balance.');
      setSubmitting(false);
      return;
    }
    if (profile?.twoFactorEnabled && !/^\d{6}$/.test(otpCode.trim())) {
      setMessage('Enter the 6-digit code from your authenticator app.');
      setSubmitting(false);
      return;
    }

    const destination = getPayoutPayload();
    if (!destination || destination.includes('****')) {
      setMessage('No payout details found. Please save payout details in Settings first.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 2FA codes are verified server-side; the TOTP secret never leaves the server.
        body: JSON.stringify({
          amountCents: Math.round(amount * 100),
          destinationType,
          destination,
          ...(profile?.twoFactorEnabled ? { totpCode: otpCode.trim() } : {}),
          ...(closeAccountMode ? { closeAccount: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmitted(true);
        setOtpCode('');
        setCloseAccountMode(false);
        await Promise.all([loadProfile(), loadWithdrawals()]);
      } else setMessage(data.error ?? 'Withdrawal request failed.');
    } catch {
      setMessage('Network error — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <InvestorSidebar />
      <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto pb-24 md:pb-8">
        <div className="border-b border-[#263437] pb-6 space-y-1">
          <h1 className="text-2xl font-normal">Withdraw Capital</h1>
          <p className="text-xs text-[#93A09A]">Request capital withdrawals to your saved bank account or crypto wallet.</p>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-xs text-amber-100">{loadError}</div>
        )}

        {message && (
          <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-4 text-xs text-rose-200">{message}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#141C1F] border border-[#263437] rounded-2xl p-6 sm:p-8 space-y-6">
            {submitted ? (
              <div className="py-6 text-center space-y-3" role="status">
                <Icon icon="solar:check-circle-bold" className="w-10 h-10 text-[#22C55E] mx-auto" aria-hidden="true" />
                <h3 className="text-base">Withdrawal Request Submitted</h3>
                <p className="text-xs text-[#93A09A]">Your request for ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is pending admin processing.</p>
                <button onClick={() => setSubmitted(false)} className="min-h-11 px-5 py-2 rounded-full text-xs font-semibold bg-[#22C55E] text-[#07110B] hover:bg-[#16A34A] motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]">New Request</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
                <div className="rounded-xl border border-[#263437] bg-[#0A0F11] p-4 text-xs text-[#93A09A] overflow-hidden">
                  Available balance: <strong className="text-white">${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  <span className="ml-2 text-[#22C55E]">Minimum balance to withdraw: $3,000</span>
                </div>

                <label className="flex items-center gap-3 p-4 bg-[#0A0F11] border border-[#263437] rounded-xl cursor-pointer hover:border-rose-500/30 motion-safe:transition-colors">
                  <input
                    type="checkbox"
                    checked={closeAccountMode}
                    onChange={e => { setCloseAccountMode(e.target.checked); setMessage(''); }}
                    className="w-4 h-4 accent-rose-500 rounded"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-[#F3F7F4]">Close Account &amp; Withdraw Entire Balance</span>
                    <span className="block text-[10px] text-[#93A09A]">Withdraw everything and close your account. This action cannot be undone.</span>
                  </span>
                </label>

                <label className="text-xs text-[#93A09A] block">
                  Withdrawal Amount ($)
                  <input
                    type="number"
                    min={closeAccountMode ? 0 : 0.01}
                    max={balance}
                    step="0.01"
                    required
                    value={amount}
                    disabled={closeAccountMode}
                    onChange={event => setAmount(Number(event.target.value))}
                    className="mt-1 min-h-11 w-full bg-[#0A0F11] border border-[#263437] rounded-xl px-4 py-2.5 text-xs text-white font-mono disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                  />
                </label>

                {!eligible && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-300" role="status">
                    <Icon icon="solar:warning-bold" className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    You need a balance of at least $3,000 to request a withdrawal. Add funds to unlock withdrawals.
                  </div>
                )}

                {closeAccountMode && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[10px] text-rose-300" role="status">
                    <Icon icon="solar:warning-bold" className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    You are about to withdraw your entire balance (${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) and close your account. After approval, your account will be set to $0 with no active plan.
                  </div>
                )}

                <label className="text-xs text-[#93A09A] block">
                  Payout rail
                  <select
                    value={destinationType}
                    onChange={event => setDestinationType(event.target.value as 'bank' | 'crypto')}
                    className="mt-1 min-h-11 w-full bg-[#0A0F11] border border-[#263437] rounded-xl px-4 py-3 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="crypto">Crypto Wallet</option>
                  </select>
                </label>

                {hasPayoutDetails ? (
                  <div className="rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/5 p-3 text-[10px] text-[#86EFAC]" role="status">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {destinationType === 'crypto' ? 'Crypto wallet' : 'Bank'} details from Settings: <strong>{getPayoutDisplay()}</strong>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-300" role="status">
                    <Icon icon="solar:warning-bold" className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    No {destinationType} payout details saved. Add them in <Link href="/dashboard/settings" className="underline font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded">Settings</Link> first.
                  </div>
                )}

                {profile?.twoFactorEnabled && (
                  <div className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/5 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:shield-check-bold" className="w-4 h-4 text-[#22C55E]" aria-hidden="true" />
                      <p className="text-xs font-semibold text-[#22C55E]">Two-Factor Verification Required</p>
                    </div>
                    <p className="text-[10px] text-[#93A09A]">Enter the 6-digit code from your authenticator app.</p>
                    <input
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      placeholder="000000"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="One-time verification code"
                      pattern="[0-9]{6}"
                      className="min-h-11 w-full rounded-xl border border-[#263437] bg-[#0A0F11] px-4 py-3 text-sm text-white font-mono text-center tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || amount <= 0 || !eligible || !hasPayoutDetails || (profile?.twoFactorEnabled ? otpCode.length !== 6 : false)}
                  className={`min-h-11 w-full rounded-full px-5 py-3 text-xs font-semibold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11] ${
                    closeAccountMode
                      ? 'bg-rose-500 text-white hover:bg-rose-600'
                      : 'bg-[#22C55E] text-[#07110B] hover:bg-[#16A34A]'
                  }`}
                >
                  {submitting ? 'Submitting...' : closeAccountMode ? 'Close Account & Withdraw All' : 'Submit Withdrawal'}
                </button>
              </form>
            )}
          </div>

          <div className="bg-[#141C1F] border border-[#263437] rounded-2xl p-6 sm:p-8 space-y-4">
            <h4 className="text-sm font-semibold">Withdrawal History</h4>
            {loading ? (
              <div className="space-y-3" role="status" aria-label="Loading withdrawals">
                {[1, 2, 3].map(i => <div key={`withdraw-skeleton-${i}`} className="h-16 bg-[#0A0F11] border border-[#263437] rounded-xl motion-safe:animate-pulse" />)}
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="py-8 text-center" role="status">
                <Icon icon="solar:document-text-bold" className="w-8 h-8 text-[#263437] mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs text-[#93A09A]">No withdrawal requests yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {withdrawals.map(w => (
                  <div key={`withdrawal-${w.id}`} className="p-4 bg-[#0A0F11] border border-[#263437] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#F3F7F4]">${(w.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-[#93A09A]">{w.destinationType === 'crypto' ? 'Crypto' : 'Bank'} &rarr; {w.destination}</p>
                      <p className="text-[10px] text-[#93A09A]">{new Date(w.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                      w.status === 'approved' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                      w.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {w.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
