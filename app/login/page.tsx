'use client';

import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setMessage('Enter your email and password.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    if (error) {
      setMessage(error.message);
    } else {
      try {
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          if (profile.twoFactorEnabled) {
            await fetch('/api/auth/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'challenge' }) });
            router.push('/verify-2fa');
            setLoading(false);
            return;
          }
          if (profile.role === 'admin') {
            router.push('/admin');
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore — fall through to dashboard */ }
      router.push('/dashboard');
    }
    } catch {
      setMessage('Sign in failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: 'google') {
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } });
      if (error) setMessage(error.message);
    } catch {
      setMessage('Google sign in failed. Check your connection and try again.');
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0D0C] text-white flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      <div className="w-full max-w-md bg-[#12161A] border border-[#202722] rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block mb-2">
            <span className="text-xl tracking-tight font-medium text-white">QUANTOVEST</span>
            <span className="text-[10px] tracking-widest text-[#22C55E] uppercase font-mono block -mt-0.5">CAPITAL</span>
          </Link>
          <h2 className="text-2xl font-normal text-white">Welcome Back</h2>
          <p className="text-xs text-[#A8ACB3]">Sign in to access your investment portfolio</p>
        </div>

        <button
          type="button"
          onClick={() => void oauth('google')}
          className="min-h-11 w-full py-3 rounded-full border border-[#202722] bg-[#1A1F24] text-white text-xs font-semibold hover:bg-[#202722] motion-safe:transition-colors flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#202722] w-full" />
          <span className="bg-[#12161A] px-3 text-[10px] uppercase font-mono text-[#A8ACB3]">Or email</span>
        </div>

        {message && (
          <div role="alert" aria-live="assertive" className="text-xs text-center px-4 py-2.5 rounded-xl border bg-red-900/20 border-red-800/40 text-red-400">
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4" noValidate={false}>
          <div>
            <label htmlFor="login-email" className="text-xs text-[#A8ACB3] block mb-1.5">Email Address</label>
            <input
              id="login-email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="min-h-11 w-full bg-[#0A0D0C] border border-[#202722] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#A8ACB3] focus:outline-none focus:border-[#22C55E] focus-visible:ring-2 focus-visible:ring-[#22C55E]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="text-xs text-[#A8ACB3]">Password</label>
              <Link href="/forgot-password" className="text-[10px] text-[#22C55E] hover:underline font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                required
                minLength={8}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="••••••••••••"
                className="min-h-11 w-full bg-[#0A0D0C] border border-[#202722] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#A8ACB3] focus:outline-none focus:border-[#22C55E] focus-visible:ring-2 focus-visible:ring-[#22C55E] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-[#93A09A] hover:text-white motion-safe:transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
              >
                <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full py-3 rounded-full bg-[#22C55E] text-[#0A0D0C] text-xs font-semibold hover:bg-[#16A34A] motion-safe:transition-colors shadow-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0D0C]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-[#A8ACB3]">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[#22C55E] hover:underline font-medium">Create one</Link>
        </p>

        <p className="text-center text-xs text-[#A8ACB3]">
          <Link href="/" className="text-[#22C55E] hover:underline font-medium">
            ← Back to Homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
