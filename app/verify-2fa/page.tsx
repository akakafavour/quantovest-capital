'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@iconify/react';

export default function Verify2FAPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      if (cancelled) return;
      setUserId(session.user.id);

      try {
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (!data.twoFactorEnabled) {
            router.replace('/dashboard');
            return;
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setChecking(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function handleVerify() {
    if (!code) return;
    setLoading(true);
    setMessage('');

    if (mode === 'totp') {
      try {
        const res = await fetch('/api/auth/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', code }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          router.replace('/dashboard');
          return;
        }
        setMessage(data.error ?? 'Invalid TOTP code. Please try again.');
      } catch {
        setMessage('Unable to verify the authenticator code.');
      }
      setLoading(false);
    } else {
      try {
        const res = await fetch('/api/auth/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, code }),
        });
        const data = await res.json();
        if (res.ok) {
          router.replace('/dashboard');
          return;
        }
        setMessage(data.error ?? 'Invalid recovery code.');
      } catch {
        setMessage('Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0D0C] text-white flex items-center justify-center">
        <p className="text-xs text-[#A8ACB3]">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0D0C] text-white flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      <div className="w-full max-w-md bg-[#12161A] border border-[#202722] rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        <button
          onClick={() => router.push('/login')}
          className="absolute top-4 right-4 text-[#A8ACB3] hover:text-white p-1"
          aria-label="Close"
        >
          <Icon icon="solar:close-circle-bold" className="w-6 h-6" />
        </button>
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block mb-2">
            <span className="text-xl tracking-tight font-medium text-white">QUANTOVEST</span>
            <span className="text-[10px] tracking-widest text-[#22C55E] uppercase font-mono block -mt-0.5">CAPITAL</span>
          </Link>
          <h2 className="text-2xl font-normal text-white">Two-Factor Verification</h2>
          <p className="text-xs text-[#A8ACB3]">Enter the code from your authenticator app</p>
        </div>

        <div className="flex gap-2 p-1 bg-[#0A0D0C] rounded-xl border border-[#202722]">
          <button
            onClick={() => { setMode('totp'); setCode(''); setMessage(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${mode === 'totp' ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30' : 'text-[#A8ACB3] hover:text-white'}`}
          >
            Authenticator
          </button>
          <button
            onClick={() => { setMode('recovery'); setCode(''); setMessage(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${mode === 'recovery' ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30' : 'text-[#A8ACB3] hover:text-white'}`}
          >
            Recovery Code
          </button>
        </div>

        {message && (
          <div className="text-xs text-center px-4 py-2.5 rounded-xl border bg-red-900/20 border-red-800/40 text-red-400">
            {message}
          </div>
        )}

        <div className="space-y-4">
          <label className="text-xs text-[#A8ACB3] block">
            {mode === 'totp' ? 'TOTP Code' : 'Recovery Code'}
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={mode === 'totp' ? 6 : 20}
              placeholder={mode === 'totp' ? '000000' : 'XXXXXXXX'}
              className="mt-1 w-full rounded-xl border border-[#202722] bg-[#0A0D0C] px-4 py-3 text-sm text-white font-mono text-center tracking-[0.3em]"
            />
          </label>
          <button
            onClick={handleVerify}
            disabled={loading || code.length < 6}
            className="w-full py-3 rounded-full bg-[#22C55E] text-[#0A0D0C] text-xs font-semibold hover:bg-[#16A34A] transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              'Verifying...'
            ) : (
              <>
                <Icon icon="solar:shield-check-bold" className="w-4 h-4" />
                Verify & Continue
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-[#A8ACB3]">
          <Link href="/login" className="text-[#22C55E] hover:underline font-medium">
            ← Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
