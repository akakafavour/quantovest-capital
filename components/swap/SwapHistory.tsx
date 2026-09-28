'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

interface SwapRow {
  id: number;
  investorId: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  feeCents: number;
  status: string;
  createdAt: string;
}

interface SwapHistoryProps {
  refreshKey?: number;
}

export default function SwapHistory({ refreshKey = 0 }: SwapHistoryProps) {
  const [swaps, setSwaps] = useState<SwapRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/swap/history');
        if (!cancelled && res.ok) setSwaps(await res.json());
      } catch { /* ignore — empty state covers failure */ }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading swap history">
        {[1, 2, 3].map(i => (
          <div key={`swap-skeleton-${i}`} className="h-16 bg-[#141C1F] border border-[#263437] rounded-xl motion-safe:animate-pulse" />
        ))}
      </div>
    );
  }

  if (swaps.length === 0) {
    return (
      <div className="p-8 text-center" role="status">
        <Icon icon="solar:arrow-right-left-bold" className="w-10 h-10 text-[#263437] mx-auto mb-3" aria-hidden="true" />
        <p className="text-xs text-[#93A09A]">No swap history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {swaps.map(swap => (
        <div key={swap.id} className="p-4 bg-[#0A0F11] border border-[#263437] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Icon icon="solar:arrow-right-left-bold" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#F3F7F4]">
                {swap.fromAmount} {swap.fromAsset} → {swap.toAmount} {swap.toAsset}
              </p>
              <p className="text-[10px] text-[#93A09A] font-mono">
                {new Date(swap.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
              swap.status === 'completed' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {swap.status.toUpperCase()}
            </span>
            <p className="text-[10px] text-[#93A09A] font-mono mt-1">Rate: {swap.rate}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
