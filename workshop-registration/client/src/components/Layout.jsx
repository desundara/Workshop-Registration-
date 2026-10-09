import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, LogOut, Menu, ScrollText, Sparkles, Users, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Avatar, Badge, ROLE_TONE, cn } from './ui.jsx';
import { ROLE_LABEL } from '../lib/format.js';

const NAV = [
  { to: '/workshops', label: 'Workshops', icon: CalendarDays, perm: 'workshops:read' },
  { to: '/users', label: 'Staff accounts', icon: Users, perm: 'users:manage' },
  { to: '/audit', label: 'Audit trail', icon: ScrollText, perm: 'audit:read' },
];

function SidebarContent({ onNavigate }) {
  const { user, can, logout } = useAuth();
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-brand-950 text-slate-300">
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-semibold leading-tight text-white">Workshop Desk</div>
          <div className="text-xs text-slate-400">Registration service</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.filter((n) => can(n.perm)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-white/10 text-white ring-1 ring-inset ring-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-white')
            }
          >
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{user.name}</div>
            <div className="truncate text-xs text-slate-400">{user.email}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-full">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><SidebarContent /></aside>

      {/* mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-brand-400" /> Workshop Desk</div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 hover:bg-white/10"><Menu className="h-5 w-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72 max-w-[85%]">
            <SidebarContent onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-300 hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><Outlet /></div>
      </main>
    </div>
  );
}
