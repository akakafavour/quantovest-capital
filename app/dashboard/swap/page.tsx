'use client';

import React, { useEffect, useRef, useState } from 'react';
import InvestorSidebar from '@/components/InvestorSidebar';
import SwapForm from '@/components/swap/SwapForm';
import SwapPreview from '@/components/swap/SwapPreview';
import SwapHistory from '@/components/swap/SwapHistory';
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

export default function SwapPage() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'swap' | 'history'>('swap');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  function handleSwapSuccess() {
    setQuote(null);
    setHistoryRefreshKey(key => key + 1);
    setSuccess(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div className="min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <InvestorSidebar />
      <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto pb-24 md:pb-8">
        <div className="border-b border-[#263437] pb-6 space-y-1">
          <h1 className="text-2xl font-normal text-[#F3F7F4]">Asset Swap</h1>
          <p className="text-xs text-[#93A09A]">Convert between crypto and fiat currencies instantly.</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2" role="tablist" aria-label="Swap views">
          <button
            role="tab"
            aria-selected={activeTab === 'swap'}
            onClick={() => setActiveTab('swap')}
            className={`min-h-11 px-4 py-2 rounded-full text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11] ${
              activeTab === 'swap'
                ? 'bg-[#22C55E] text-[#0A0D0C]'
                : 'bg-[#141C1F] border border-[#263437] text-[#93A09A] hover:border-[#22C55E]/50'
            }`}
          >
            Swap
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`min-h-11 px-4 py-2 rounded-full text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11] ${
              activeTab === 'history'
                ? 'bg-[#22C55E] text-[#0A0D0C]'
                : 'bg-[#141C1F] border border-[#263437] text-[#93A09A] hover:border-[#22C55E]/50'
            }`}
          >
            History
          </button>
        </div>

        {success && (
          <div role="status" aria-live="polite" className="p-4 bg-[#22C55E]/10 border border-[#22C55E] rounded-xl text-xs text-[#22C55E] flex items-center gap-2">
            <Icon icon="solar:check-circle-bold" className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Swap completed successfully!</span>
          </div>
        )}

        {activeTab === 'swap' ? (
          <div className="max-w-md">
            <div className="p-6 bg-[#141C1F] border border-[#263437] rounded-2xl space-y-6">
              <h3 className="text-sm font-semibold text-[#F3F7F4]">Swap Assets</h3>
              {quote ? (
                <SwapPreview
                  quote={quote}
                  onConfirm={handleSwapSuccess}
                  onCancel={() => setQuote(null)}
                />
              ) : (
                <SwapForm onPreview={setQuote} />
              )}
            </div>
          </div>
        ) : (
          <SwapHistory refreshKey={historyRefreshKey} />
        )}
      </main>
    </div>
  );
}
