'use client';

import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const refMatch = document.cookie.match(/(?:^|;\s*)referral_code=([^;]+)/);
      const referralCode = refMatch ? decodeURIComponent(refMatch[1]) : null;
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (trimmedName.length < 2) {
        setMessage('Enter your full legal name.');
        setLoading(false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setMessage('Enter a valid email address.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail, password, referralCode }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || 'Signup failed'); setLoading(false); return; }
      // New contract: { user, emailConfirmationRequired }. Legacy fallback kept
      // for cached API responses that still include `session`.
      const needsConfirmation = data.emailConfirmationRequired ?? !data.session;
      if (!needsConfirmation) router.push('/dashboard'); else setMessage('Check your email to confirm your account, then sign in.');
    } catch {
      setMessage('Signup failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: 'google') {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } });
      if (error) setMessage(error.message);
    } catch {
      setMessage('Google sign up failed. Check your connection and try again.');
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
          <h2 className="text-2xl font-normal text-white">Create Account</h2>
          <p className="text-xs text-[#A8ACB3]">Start investing across FX, Crypto & Stocks from $1,500</p>
        </div>

        <button
          type="button"
          onClick={() => void oauth('google')}
          className="w-full py-3 rounded-full border border-[#202722] bg-[#1A1F24] text-white text-xs font-semibold hover:bg-[#202722] transition-colors flex items-center justify-center gap-2.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#202722] w-full" />
          <span className="bg-[#12161A] px-3 text-[10px] uppercase font-mono text-[#A8ACB3]">Or email</span>
        </div>

        {message && (
          <div className={`text-xs text-center px-4 py-2.5 rounded-xl border ${
            message.includes('Check your email')
              ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
              : 'bg-red-900/20 border-red-800/40 text-red-400'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <label className="text-xs text-[#A8ACB3] block mb-1.5">
            Full Legal Name
            <input
              required
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="e.g. John Doe"
              className="mt-1 w-full bg-[#0A0D0C] border border-[#202722] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#A8ACB3] focus:outline-none focus:border-[#22C55E]"
            />
          </label>

          <label className="text-xs text-[#A8ACB3] block mb-1.5">
            Email Address
            <input
              required
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full bg-[#0A0D0C] border border-[#202722] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#A8ACB3] focus:outline-none focus:border-[#22C55E]"
            />
          </label>

          <label className="text-xs text-[#A8ACB3] block mb-1.5">
            Password
            <div className="relative mt-1">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Min. 8 characters"
                className="w-full bg-[#0A0D0C] border border-[#202722] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#A8ACB3] focus:outline-none focus:border-[#22C55E] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#93A09A] hover:text-white transition-colors"
              >
                <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} className="w-4 h-4" />
              </button>
            </div>
          </label>

          <label className="text-xs text-[#A8ACB3] block mb-1.5">
            Confirm Password
            <div className="relative mt-1">
              <input
                required
                type={showConfirmPassword ? 'text' : 'password'}
                minLength={8}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                className="w-full bg-[#0A0D0C] border border-[#202722] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#A8ACB3] focus:outline-none focus:border-[#22C55E] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#93A09A] hover:text-white transition-colors"
              >
                <Icon icon={showConfirmPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} className="w-4 h-4" />
              </button>
            </div>
          </label>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[10px] text-red-400 -mt-2">Passwords do not match</p>
          )}

          <button
            type="submit"
            disabled={loading || !name || !email || !password || !confirmPassword || password !== confirmPassword}
            className="w-full py-3 rounded-full bg-[#22C55E] text-[#0A0D0C] text-xs font-semibold hover:bg-[#16A34A] transition-colors shadow-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-[#A8ACB3]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#22C55E] hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
