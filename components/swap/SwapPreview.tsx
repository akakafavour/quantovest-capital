'use client';

import React, { useState } from 'react';
import { Icon } from '@iconify/react';

interface Quote {
  from: string;
  to: string;
  fromAmount: number;
  rate: string;
  fee: string;
  feeBps: number;
  receiveAmount: string;
}

interface SwapPreviewProps {
  quote: Quote;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SwapPreview({ quote, onConfirm, onCancel }: SwapPreviewProps) {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setExecuting(true);
    setError('');
    try {
      const res = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset: quote.from,
          toAsset: quote.to,
          fromAmount: quote.fromAmount,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Swap failed');
        setExecuting(false);
        return;
      }
      onConfirm();
    } catch {
      setError('An error occurred');
      setExecuting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="p-4 bg-[#0A0F11] border border-[#263437] rounded-xl space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-[#93A09A]">From</span>
          <span className="text-white font-mono font-semibold">{quote.fromAmount} {quote.from}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#93A09A]">To</span>
          <span className="text-[#22C55E] font-mono font-semibold">{quote.receiveAmount} {quote.to}</span>
        </div>
        <div className="border-t border-[#263437] pt-2 flex justify-between text-xs">
          <span className="text-[#93A09A]">Rate</span>
          <span className="text-white font-mono">1 {quote.from} = {quote.rate} {quote.to}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#93A09A]">Fee ({quote.feeBps / 100}%)</span>
          <span className="text-amber-400 font-mono">{quote.fee} {quote.to}</span>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 py-2.5 rounded-full border border-[#263437] text-xs font-medium text-[#93A09A] hover:bg-[#0A0F11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={executing}
          className="min-h-11 flex-1 py-2.5 rounded-full bg-[#22C55E] text-[#07110B] text-xs font-semibold hover:bg-[#16A34A] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]"
        >
          {executing ? 'Swapping...' : 'Confirm Swap'}
        </button>
      </div>
    </div>
  );
}
