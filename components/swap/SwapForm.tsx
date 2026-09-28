'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', icon: 'solar:bitcoin-bold' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'solar:bitcoin-bold' },
  { symbol: 'SOL', name: 'Solana', icon: 'solar:bitcoin-bold' },
  { symbol: 'USDT', name: 'Tether', icon: 'solar:dollar-minimalistic-bold' },
  { symbol: 'USDC', name: 'USD Coin', icon: 'solar:dollar-minimalistic-bold' },
  { symbol: 'XRP', name: 'Ripple', icon: 'solar:bitcoin-bold' },
];

interface Quote {
  from: string;
  to: string;
  fromAmount: number;
  rate: string;
  fee: string;
  feeBps: number;
  receiveAmount: string;
}

interface SwapFormProps {
  onPreview: (quote: Quote) => void;
}

export default function SwapForm({ onPreview }: SwapFormProps) {
  const [fromAsset, setFromAsset] = useState('BTC');
  const [toAsset, setToAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableTo = ASSETS.filter(a => a.symbol !== fromAsset);

  useEffect(() => {
    if (availableTo.find(a => a.symbol === toAsset)) return;
    setToAsset(availableTo[0]?.symbol ?? 'USDT');
  }, [fromAsset]);

  async function handleGetQuote() {
    const parsed = parseFloat(amount);
    if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (fromAsset === toAsset) {
      setError('Choose two different assets to swap.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from: fromAsset, to: toAsset, amount });
      const res = await fetch(`/api/swap/rate?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to get quote');
        setLoading(false);
        return;
      }
      const quote = await res.json();
      onPreview(quote);
    } catch {
      setError('Failed to fetch rate');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* From Asset */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-mono text-[#93A09A]">You Pay</label>
        <div className="flex gap-2">
          <select
            value={fromAsset}
            onChange={e => setFromAsset(e.target.value)}
            aria-label="Pay asset"
            className="min-h-11 rounded-xl border border-[#263437] bg-[#0A0F11] px-3 py-3 text-sm text-white font-mono min-w-[100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
          >
            {ASSETS.map(a => (
              <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
            ))}
          </select>
          <input
            type="number"
            value={amount}
            onChange={e => { setAmount(e.target.value); setError(''); }}
            placeholder="0.00"
            min="0"
            step="any"
            required
            aria-label="Pay amount"
            className="min-h-11 flex-1 rounded-xl border border-[#263437] bg-[#0A0F11] px-4 py-3 text-sm text-white font-mono text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
          />
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => { const temp = fromAsset; setFromAsset(toAsset); setToAsset(temp); }}
          aria-label="Reverse swap direction"
          className="min-h-11 min-w-11 w-11 h-11 rounded-full bg-[#141C1F] border border-[#263437] flex items-center justify-center text-[#22C55E] hover:bg-[#1A2528] motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
        >
          <Icon icon="solar:arrow-right-left-bold" className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* To Asset */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-mono text-[#93A09A]">You Receive</label>
        <div className="flex gap-2">
          <select
            value={toAsset}
            onChange={e => setToAsset(e.target.value)}
            aria-label="Receive asset"
            className="min-h-11 rounded-xl border border-[#263437] bg-[#0A0F11] px-3 py-3 text-sm text-white font-mono min-w-[100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
          >
            {availableTo.map(a => (
              <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
            ))}
          </select>
          <div className="flex-1 rounded-xl border border-[#263437] bg-[#0A0F11]/50 px-4 py-3 text-sm text-[#93A09A] font-mono text-right">
            Quote pending
          </div>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}

      <button
        type="button"
        onClick={handleGetQuote}
        disabled={!amount || parseFloat(amount) <= 0 || loading}
        className="min-h-11 w-full py-3 rounded-full bg-[#22C55E] text-[#0A0D0C] text-xs font-semibold hover:bg-[#16A34A] disabled:opacity-40 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]"
      >
        {loading ? 'Fetching Rate...' : 'Get Swap Quote'}
      </button>
    </div>
  );
}
