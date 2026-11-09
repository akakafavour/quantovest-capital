'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App error boundary caught]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0D0C] text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-[#121614] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
          !
        </div>
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Something went wrong</h1>
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          An unexpected system issue occurred. Your portfolio data and balances remain secure.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl transition duration-150"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm rounded-xl border border-white/10 transition duration-150 flex items-center justify-center"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
