'use client';

import { initials } from '@agendei/contracts';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/brand/logo';
import { useAuth } from '@/lib/auth';
import { useOrg } from '@/lib/org';
import { cn } from '@/lib/utils';
import { canSee, isActive, navItems } from './nav-items';
import { OrgSwitcher } from './org-switcher';


/** Navegação lateral fixa — só no desktop (lg+). No celular a navegação é a barra inferior. */
export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { can, has, vocab } = useOrg();
  const items = navItems(vocab).filter((i) => canSee(i, can, has));

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-card lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <LogoMark className="size-9" />
        <span className="font-display text-xl font-black">Agendei</span>
      </div>
      <div className="px-3">
        <OrgSwitcher />
      </div>

      <nav aria-label="Navegação principal" className="mt-4 flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 font-semibold transition-colors',
                    active ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {user ? (
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Link
            href="/mais"
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-muted',
              isActive(pathname, '/mais') && 'bg-muted',
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#8f7cf8] to-[#f28db8] text-sm font-black text-white">
              {initials(user.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">Minha conta</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sair"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
