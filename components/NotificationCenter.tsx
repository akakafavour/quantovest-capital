'use client';

import { useEffect, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';

type Notice = { id: number; title: string; body: string; type: string; isRead: number; createdAt: string };
type Tab = 'all' | 'personal' | 'announcements';

const PERSONAL_TYPES = ['deposit', 'withdrawal', 'kyc', 'roi', 'referral', 'security', 'plan', 'swap'];
const ANNOUNCEMENT_TYPES = ['admin_broadcast', 'platform', 'system', 'announcement', 'maintenance'];

function isAnnouncement(type: string): boolean {
  return ANNOUNCEMENT_TYPES.some(t => type.includes(t));
}

function typeIcon(type: string): string {
  if (type.includes('deposit')) return 'solar:wallet-bold';
  if (type.includes('withdrawal')) return 'solar:card-transfer-bold';
  if (type.includes('kyc')) return 'solar:shield-check-bold';
  if (type.includes('roi')) return 'solar:graph-bold';
  if (type.includes('referral')) return 'solar:share-bold';
  if (type.includes('security')) return 'solar:lock-bold';
  if (type.includes('swap')) return 'solar:transfer-horizontal-bold';
  if (type.includes('plan')) return 'solar:medal-bold';
  if (isAnnouncement(type)) return 'solar:megaphone-bold';
  return 'solar:bell-bold';
}

export default function NotificationCenter({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [tab, setTab] = useState<Tab>('all');

  async function load() {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data) {
          setItems(data.items ?? []);
          setUnread(data.unreadCount ?? 0);
        }
      }
    } catch { /* bell stays in empty state rather than throwing to console */ }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'personal') return items.filter(i => !isAnnouncement(i.type));
    if (tab === 'announcements') return items.filter(i => isAnnouncement(i.type));
    return items;
  }, [items, tab]);

  const unreadByTab = useMemo(() => {
    return {
      all: items.filter(i => !i.isRead).length,
      personal: items.filter(i => !i.isRead && !isAnnouncement(i.type)).length,
      announcements: items.filter(i => !i.isRead && isAnnouncement(i.type)).length,
    };
  }, [items]);

  async function mark(id?: number) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
    } catch { /* ignore — list refresh below still runs */ }
    await load();
  }

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="relative rounded-full border border-white/10 bg-white/[.04] p-2 text-[#d8e5dd] transition-colors hover:bg-white/[.08] focus:outline-none focus:ring-2 focus:ring-[#d6a85c]/60"
      >
        <Icon icon="solar:bell-bold" className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#d6a85c] px-1 text-[9px] font-bold text-[#07100c]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification center"
          className={`${align === 'left' ? 'left-0' : 'right-0'} absolute top-12 z-50 w-[min(380px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#101714]/[.98] shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-xl`}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-white/[.06] px-4 py-4">
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">Notifications</p>
              <p className="mt-0.5 text-[10px] text-[#7f9185]">Account activity and platform updates</p>
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <span className="rounded-full bg-[#d6a85c]/15 px-2 py-1 text-[9px] font-semibold text-[#d6a85c]">{unread} unread</span>
              )}
              <button aria-label="Close notifications" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[#7f9185] hover:bg-white/[.06] hover:text-white">
                <Icon icon="solar:close-circle-bold" className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-[10px] font-mono uppercase tracking-[.16em] text-[#7f9185]">Inbox</p>
            {unread > 0 && (
              <button onClick={() => void mark()} className="text-[10px] text-[#d6a85c] hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pb-3">
            {([
              { key: 'all' as Tab, label: 'All', count: unreadByTab.all },
              { key: 'personal' as Tab, label: 'Personal', count: unreadByTab.personal },
              { key: 'announcements' as Tab, label: 'Updates', count: unreadByTab.announcements },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-[#d6a85c]/20 text-[#d6a85c]'
                    : 'text-[#7f9185] hover:text-[#b9c6bd] hover:bg-white/[.04]'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`min-w-4 rounded-full px-1 text-center text-[8px] font-bold ${
                    tab === t.key ? 'bg-[#d6a85c] text-[#07100c]' : 'bg-white/10 text-[#7f9185]'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-white/5" />

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-[#7f9185]">
                {tab === 'personal' && 'No personal notifications.'}
                {tab === 'announcements' && 'No announcements yet.'}
                {tab === 'all' && 'No notifications yet.'}
              </p>
            ) : (
              filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => void mark(item.id)}
                  className={`flex items-start gap-3 w-full rounded-xl p-3 text-left transition-colors ${
                    item.isRead ? 'bg-white/[.02] hover:bg-white/[.04]' : 'bg-[#d6a85c]/10 hover:bg-[#d6a85c]/15'
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                    item.isRead ? 'bg-white/[.06]' : 'bg-[#d6a85c]/20'
                  }`}>
                    <Icon icon={typeIcon(item.type)} className={`w-3.5 h-3.5 ${item.isRead ? 'text-[#7f9185]' : 'text-[#d6a85c]'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isAnnouncement(item.type) && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#d6a85c]/15 text-[8px] font-mono font-bold text-[#d6a85c] uppercase">
                          Broadcast
                        </span>
                      )}
                      <p className={`text-xs font-semibold truncate ${item.isRead ? 'text-[#b9c6bd]' : 'text-white'}`}>{item.title}</p>
                      {!item.isRead && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#d6a85c]" />}
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[#b9c6bd] line-clamp-2">{item.body}</p>
                    <p className="mt-1 text-[9px] text-[#7f9185]">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
