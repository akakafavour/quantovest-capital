'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { createClient } from '@/lib/supabase/client';
import { signOutWithCookies } from '@/lib/auth-logout';
import NotificationCenter from '@/components/NotificationCenter';

interface InvestorSidebarProps {
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onOpenCalculator?: () => void;
}

const navLinks = [
  { label: 'Overview', href: '/dashboard', icon: 'solar:widget-bold' },
  { label: 'Portfolio Managers', href: '/dashboard/traders', icon: 'solar:users-group-rounded-bold' },
  { label: 'Deposit', href: '/dashboard/deposit', icon: 'solar:wallet-money-bold' },
  { label: 'Withdraw', href: '/dashboard/withdraw', icon: 'solar:card-send-bold' },
  { label: 'History', href: '/dashboard/history', icon: 'solar:clock-circle-bold' },
  { label: 'Portfolio', href: '/dashboard/portfolio', icon: 'solar:chart-square-bold' },
  { label: 'Swap', href: '/dashboard/swap', icon: 'solar:transfer-horizontal-bold' },
  { label: 'Referrals', href: '/dashboard/referrals', icon: 'solar:share-bold' },
  { label: 'Identity KYC', href: '/dashboard/kyc', icon: 'solar:shield-check-bold' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'solar:settings-bold' },
];

export default function InvestorSidebar({ onOpenDeposit, onOpenWithdraw, onOpenCalculator }: InvestorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; avatar: string | null; kycStatus: string }>({ name: '', email: '', avatar: null, kycStatus: 'unverified' });

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch('/api/investor-profile', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) {
          const data = await res.json();
          setUser({ name: data.name ?? '', email: data.email ?? '', avatar: data.avatar, kycStatus: data.kycStatus ?? 'unverified' });
        }
      } catch { /* ignore */ }
    }
    void load();
  }, []);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const displayName = user.name || 'Investor';
  const displayEmail = user.email || '';
  const avatarSrc = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;

  async function handleLogout() {
    await signOutWithCookies();
    router.replace('/login');
  }

  return (
    <>
      {/* Mobile Sticky Header */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 bg-[#0D1214] border-b border-[#202A2D] sticky top-0 z-40">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 -ml-2 rounded-lg text-[#9AA7A0] hover:text-[#F4F7F3] hover:bg-[#172124] transition-colors"
          aria-label="Open menu"
        >
          <Icon icon="solar:hamburger-menu-bold" className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#151D20] border border-[#2C393C] flex items-center justify-center text-[#4ADE80]">
            <Icon icon="solar:chart-square-bold" className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-[#F4F7F3] tracking-tight">QUANTOVEST</span>
        </Link>
        <NotificationCenter />
      </div>

      {/* Drawer Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[85vw] max-w-72 bg-[#0D1214] border-r border-[#202A2D] z-50 md:hidden flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-[#202A2D] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setDrawerOpen(false)}>
            <div className="w-9 h-9 rounded-xl bg-[#151D20] border border-[#2C393C] flex items-center justify-center text-[#4ADE80]">
              <Icon icon="solar:chart-square-bold" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[#F4F7F3] text-base tracking-tight">QUANTOVEST</span>
            </div>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 -mr-2 rounded-lg text-[#9AA7A0] hover:text-[#F4F7F3] hover:bg-[#172124] transition-colors"
            aria-label="Close menu"
          >
            <Icon icon="solar:close-bold" className="w-5 h-5" />
          </button>
        </div>

        <div className="m-4 p-4 bg-[#151D20] border border-[#263437] rounded-xl flex items-center gap-3">
          <img src={avatarSrc} alt={displayName} className="w-9 h-9 rounded-full object-cover border border-[#4ADE80]/40" />
          <div className="truncate">
            <p className="text-xs font-semibold text-[#F4F7F3] truncate">{displayName}</p>
            <p className="text-[10px] text-[#8D9994] truncate font-mono">{displayEmail}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] uppercase font-mono text-[#74817B] px-2 tracking-wider mb-2">Navigation</p>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive ? 'bg-[#4ADE80] text-[#07110B] font-semibold shadow-[0_8px_24px_rgba(74,222,128,0.16)]' : 'text-[#9AA7A0] hover:text-[#F4F7F3] hover:bg-[#172124]'
                }`}
              >
                <Icon icon={link.icon} className={`w-5 h-5 ${isActive ? 'text-[#07110B]' : 'text-[#4ADE80]'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#202A2D] text-xs space-y-2">
          <button onClick={handleLogout} className="flex items-center gap-2 text-[#8D9994] hover:text-[#F4F7F3] text-xs">
            <Icon icon="solar:logout-3-bold" className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="investor-sidebar hidden md:flex flex-col w-64 bg-[#0D1214] border-r border-[#202A2D] h-screen sticky top-0 text-[#F4F7F3] z-30 font-sans">
        <div className="p-6 border-b border-[#202A2D] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#151D20] border border-[#2C393C] flex items-center justify-center text-[#4ADE80]"><Icon icon="solar:chart-square-bold" className="w-5 h-5" /></div>
            <div><span className="text-[#F4F7F3] text-base tracking-tight">QUANTOVEST</span></div>
          </Link>
          <NotificationCenter align="left" />
        </div>
        <div className="m-4 p-4 bg-[#151D20] border border-[#263437] rounded-xl flex items-center gap-3">
          <img src={avatarSrc} alt={displayName} className="w-9 h-9 rounded-full object-cover border border-[#4ADE80]/40" />
          <div className="truncate"><p className="text-xs font-semibold text-[#F4F7F3] truncate">{displayName}</p><p className="text-[10px] text-[#8D9994] truncate font-mono">{displayEmail}</p></div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] uppercase font-mono text-[#74817B] px-2 tracking-wider mb-2">Navigation</p>
          {navLinks.map((link) => { const isActive = pathname === link.href; return <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${isActive ? 'bg-[#4ADE80] text-[#07110B] font-semibold shadow-[0_8px_24px_rgba(74,222,128,0.16)]' : 'text-[#9AA7A0] hover:text-[#F4F7F3] hover:bg-[#172124]'}`}><Icon icon={link.icon} className={`w-5 h-5 ${isActive ? 'text-[#07110B]' : 'text-[#4ADE80]'}`} /><span>{link.label}</span></Link>; })}
        </nav>
        <div className="p-4 border-t border-[#202A2D] text-xs space-y-2">
          <button onClick={handleLogout} className="flex items-center gap-2 text-[#8D9994] hover:text-[#F4F7F3] text-xs"><Icon icon="solar:logout-3-bold" className="w-4 h-4" />Logout</button>
        </div>
      </aside>
    </>
  );
}
