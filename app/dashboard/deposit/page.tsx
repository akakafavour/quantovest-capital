'use client';

import { useEffect, useRef, useState } from 'react';
import InvestorSidebar from '@/components/InvestorSidebar';
import { Icon } from '@iconify/react';

type Instruction = {
  id: number;
  method: string;
  label: string;
  details: string;
  qrPath: string | null;
  qrUrl: string | null;
};

type Deposit = {
  id: string;
  amountCents: number;
  method: string;
  status: string;
  proofPath: string | null;
  planId: number | null;
  createdAt: string;
};

const CRYPTO_COINS = [
  { value: 'usdt-trc20', label: 'USDT (TRC-20)', icon: 'cryptocurrency:usdt' },
  { value: 'btc', label: 'Bitcoin (BTC)', icon: 'cryptocurrency:btc' },
] as const;

type Plan = {
  id: number;
  name: string;
  minimumDepositCents: number;
  maximumDepositCents: number | null;
  minRoiBps: number;
  maxRoiBps: number;
};

export default function DepositPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [method, setMethod] = useState<string>('usdt-trc20');
  const [amount, setAmount] = useState(50);
  const [proof, setProof] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(true);
  const [instructionsError, setInstructionsError] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [amountError, setAmountError] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  async function load() {
    setInstructionsLoading(true);
    setInstructionsError(false);
    const [instructionResult, depositResult, planResult] = await Promise.allSettled([
      fetch('/api/deposit-instructions', { cache: 'no-store' }),
      fetch('/api/deposits', { cache: 'no-store' }),
      fetch('/api/plans', { cache: 'no-store' }),
    ]);

    if (instructionResult.status === 'fulfilled' && instructionResult.value.ok) {
      setInstructions(await instructionResult.value.json());
    } else {
      setInstructionsError(true);
    }

    if (depositResult.status === 'fulfilled' && depositResult.value.ok) {
      setDeposits(await depositResult.value.json());
    }

    if (planResult.status === 'fulfilled' && planResult.value.ok) {
      setPlans(await planResult.value.json());
    }
    setInstructionsLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function choosePlan(plan: Plan | null) {
    setSelectedPlan(plan);
    setAmount(plan ? plan.minimumDepositCents / 100 : 50);
  }

  const activeInstruction = instructions.find(item => item.method === method) ?? null;

  async function copyAddress() {
    if (activeInstruction) {
      try {
        await navigator.clipboard.writeText(activeInstruction.details);
        setMessage('Address copied to clipboard.');
      } catch {
        setMessage('Could not copy. Long-press the address to copy manually.');
      }
      if (messageTimer.current) clearTimeout(messageTimer.current);
      messageTimer.current = setTimeout(() => setMessage(''), 3000);
    }
  }

  function handleAmountChange(value: number) {
    setAmount(value);
    if (!Number.isFinite(value) || value < 50) {
      setAmountError('Minimum deposit is $50.');
    } else if (selectedPlan && value < selectedPlan.minimumDepositCents / 100) {
      setAmountError(`This plan requires at least $${(selectedPlan.minimumDepositCents / 100).toLocaleString()}.`);
    } else {
      setAmountError('');
    }
  }

  function handleProofChange(file: File | null) {
    if (!file) {
      setProof(null);
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setMessage('Proof must be a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Proof image must be 10 MB or smaller.');
      return;
    }
    setProof(file);
    setMessage('');
  }

  async function submitDeposit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!Number.isFinite(amount) || amount < 50) {
      setMessage('Minimum deposit is $50.');
      return;
    }
    if (!proof) {
      setMessage('Please upload the transaction confirmation screenshot before submitting.');
      return;
    }
    setLoading(true);

    try {
      const form = new FormData();
      form.append('file', proof);
      form.append('purpose', 'deposit-proof');

      const upload = await fetch('/api/uploads', { method: 'POST', body: form });
      const uploadData = await upload.json().catch(() => ({}));
      if (!upload.ok || !uploadData.path || uploadData.bucket !== 'quantovest-media') {
        setMessage(uploadData.error ?? 'Proof image upload failed. Please try again.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: Math.round(amount * 100),
          method,
          proofPath: uploadData.path,
          planId: selectedPlan?.id ?? null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? 'Deposit submission failed.');
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setProof(null);
      await load();
    } catch {
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <InvestorSidebar />
      <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto pb-24 md:pb-8">
        <div className="border-b border-[#263437] pb-6 space-y-1">
          <h1 className="text-2xl font-normal">Deposit Funds</h1>
          <p className="text-xs text-[#93A09A]">
            Select your preferred cryptocurrency, transfer the funds to the matching wallet address, and upload proof of payment.
          </p>
          <div className="mt-4 p-4 rounded-xl border border-[#263437] bg-[#141C1F] space-y-2">
            <div className="flex flex-wrap gap-4 text-xs font-mono text-[#93A09A]">
              <span>Minimum: <strong className="text-white">$50</strong></span>
              <span>Recommended Starting: <strong className="text-white">$500</strong></span>
              <span>Starter Plan threshold: <strong className="text-white">$1,500</strong></span>
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-mono text-[#93A09A]">
              <span>Duration: <strong className="text-white">7 days</strong></span>
              <span>ROI: <strong className="text-white">15% after 7 days</strong></span>
            </div>
          </div>
        </div>

        {message && (
          <div role="alert" aria-live="assertive" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-xs text-amber-100">
            {message}
          </div>
        )}

        {submitted ? (
          <div className="max-w-xl rounded-2xl border border-[#263437] bg-[#141C1F] p-6 sm:p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
              <Icon icon="solar:check-read-bold" className="h-6 w-6" />
            </div>
            <h2 className="text-xl">Deposit Proof Submitted</h2>
            <p className="text-xs text-[#93A09A] max-w-sm mx-auto leading-relaxed">
              Our accounts team will review and verify the screenshot. Your portfolio balance will update once approved.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="rounded-full bg-[#22C55E] px-6 py-3 text-xs font-semibold text-[#07110B] hover:bg-[#16A34A] transition-colors"
            >
              Make another deposit
            </button>
          </div>
        ) : (
          <div className="grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#263437] bg-[#141C1F] p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#93A09A]">Choose a plan or enter a custom amount</p>
                <div className="grid grid-cols-1 gap-2" role="group" aria-label="Choose a plan">
                  <button
                    type="button"
                    onClick={() => choosePlan(null)}
                    aria-pressed={selectedPlan === null}
                    className={`min-h-11 flex items-center justify-between rounded-xl border p-3.5 text-xs motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
                      selectedPlan === null
                        ? 'border-[#22C55E] bg-[#22C55E]/10 text-white font-semibold'
                        : 'border-[#263437] bg-[#0A0F11] text-[#93A09A] hover:text-white'
                    }`}
                  >
                    <span>Custom amount (any $50+)</span>
                    <span className="font-mono">min $50</span>
                  </button>
                  {plans.map(plan => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => choosePlan(plan)}
                      aria-pressed={selectedPlan?.id === plan.id}
                      className={`min-h-11 flex items-center justify-between rounded-xl border p-3.5 text-xs motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
                        selectedPlan?.id === plan.id
                          ? 'border-[#22C55E] bg-[#22C55E]/10 text-white font-semibold'
                          : 'border-[#263437] bg-[#0A0F11] text-[#93A09A] hover:text-white'
                      }`}
                    >
                      <span>{plan.name} Plan</span>
                      <span className="font-mono">${(plan.minimumDepositCents / 100).toLocaleString()} · {(plan.minRoiBps / 100).toFixed(1)}% / 7 days</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#93A09A]">Select Cryptocurrency</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Select cryptocurrency">
                  {CRYPTO_COINS.map(coin => (
                    <button
                      key={coin.value}
                      type="button"
                      onClick={() => setMethod(coin.value)}
                      aria-pressed={method === coin.value}
                      className={`min-h-11 flex items-center gap-2 rounded-xl border p-3.5 text-xs motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
                        method === coin.value
                          ? 'border-[#22C55E] bg-[#22C55E]/10 text-white font-semibold'
                          : 'border-[#263437] bg-[#0A0F11] text-[#93A09A] hover:text-white'
                      }`}
                    >
                      <Icon icon={coin.icon} className="w-5 h-5 text-[#22C55E]" />
                      <span>{coin.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {instructionsLoading ? (
                <div className="rounded-xl border border-[#263437] bg-[#0A0F11] p-8 text-center text-xs text-[#93A09A] flex flex-col items-center justify-center gap-3" aria-live="polite">
                  <Icon icon="solar:refresh-circle-bold" className="h-8 w-8 animate-spin text-[#22C55E]" aria-hidden="true" />
                  <p>Loading payment instructions…</p>
                </div>
              ) : activeInstruction ? (
                <div className="rounded-xl border border-[#263437] bg-[#0A0F11] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#22C55E] uppercase tracking-wider font-mono font-semibold">
                        {activeInstruction.label}
                      </p>
                      <p className="text-xs text-[#93A09A] mt-0.5">Transfer address:</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyAddress()}
                      className="min-h-11 text-xs font-semibold text-[#22C55E] hover:underline flex items-center gap-1 px-2 py-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                    >
                      <Icon icon="solar:copy-bold" className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                  <p className="select-all break-all font-mono text-xs text-white bg-[#141C1F] p-3 rounded-lg border border-[#263437]">
                    {activeInstruction.details}
                  </p>
                  {activeInstruction.qrUrl && (
                    <div className="flex flex-col items-center justify-center border-t border-[#263437]/60 pt-4">
                      <p className="text-[10px] text-[#93A09A] mb-2 font-mono">Scan QR Code to pay:</p>
                      <img
                        src={activeInstruction.qrUrl}
                        alt="Deposit QR code"
                        className="h-36 w-36 rounded-lg bg-white p-2 object-contain shadow-lg"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#263437] p-8 text-center text-xs text-[#93A09A] flex flex-col items-center justify-center gap-3" role={instructionsError ? 'alert' : undefined}>
                  <Icon icon={instructionsError ? 'solar:danger-triangle-bold' : 'solar:shield-warning-bold'} className="w-8 h-8 text-amber-500" aria-hidden="true" />
                  <p>{instructionsError ? 'We couldn’t load payment instructions. Please try again.' : 'This payment method is temporarily unavailable. Please choose another method.'}</p>
                  {instructionsError && (
                    <button
                      type="button"
                      onClick={() => void load()}
                      className="rounded-full border border-[#22C55E]/40 px-4 py-2 text-[11px] font-semibold text-[#22C55E] hover:bg-[#22C55E]/10 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={submitDeposit} className="space-y-4 pt-2" noValidate={false}>
                <label className="block text-xs text-[#93A09A]">
                  {selectedPlan ? `Deposit Amount — ${selectedPlan.name} Plan ($ USD)` : 'Custom Deposit Amount ($ USD)'}
                  <input
                    required
                    min="50"
                    type="number"
                    value={amount}
                    onChange={event => handleAmountChange(Number(event.target.value))}
                    disabled={!!selectedPlan}
                    aria-invalid={amountError ? true : undefined}
                    aria-describedby={amountError ? 'deposit-amount-error' : undefined}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[#263437] bg-[#0A0F11] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#22C55E] focus-visible:ring-2 focus-visible:ring-[#22C55E] disabled:opacity-60"
                  />
                </label>
                {amountError && <p id="deposit-amount-error" role="alert" className="text-[11px] text-rose-400">{amountError}</p>}

                <label className="block text-xs text-[#93A09A]">
                  Upload Transaction Screenshot / Proof
                  <input
                    required
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={event => handleProofChange(event.target.files?.[0] ?? null)}
                    className="mt-1.5 min-h-11 w-full text-xs text-[#93A09A] file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#22C55E]/10 file:text-[#22C55E] hover:file:bg-[#22C55E]/20"
                  />
                </label>

                <button
                  disabled={!activeInstruction || loading || !!amountError}
                  className="min-h-11 w-full rounded-full bg-[#22C55E] py-3.5 text-xs font-semibold text-[#07110B] hover:bg-[#16A34A] motion-safe:transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]"
                >
                  {loading ? 'Submitting...' : 'Submit Deposit Proof'}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-[#263437] bg-[#141C1F] p-6 sm:p-8 flex flex-col">
              <h2 className="text-base font-semibold">Deposit History</h2>
              <div className="mt-4 space-y-3 flex-1 overflow-y-auto max-h-[450px] pr-1">
                {deposits.map(deposit => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between rounded-xl border border-[#263437] bg-[#0A0F11] p-4 text-xs"
                  >
                    <div>
                      <p className="font-mono font-semibold text-white">
                        ${(deposit.amountCents / 100).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[#93A09A] mt-0.5 uppercase tracking-wider font-mono">
                        {deposit.method}{deposit.planId ? ' · PLAN' : ''}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        (deposit.status === 'approved' || deposit.status === 'completed')
                          ? 'bg-[#22C55E]/10 text-[#22C55E]'
                          : deposit.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {(deposit.status === 'completed' ? 'approved' : deposit.status).toUpperCase()}
                    </span>
                  </div>
                ))}
                {!deposits.length && (
                  <div className="py-12 text-center text-xs text-[#93A09A] space-y-2">
                    <Icon icon="solar:folder-empty-bold" className="w-8 h-8 text-[#263437] mx-auto" />
                    <p>No deposits submitted yet.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
