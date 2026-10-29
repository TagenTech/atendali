'use client';

import { initials } from '@skedulei/contracts';
import { LogOut, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand/logo';
import { useAuth } from '@/lib/auth';
import { useOrg } from '@/lib/org';
import { cn } from '@/lib/utils';
import { openSearch } from './command-palette';
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
      <div className="px-5 pb-3 pt-5">
        <Wordmark />
      </div>
      <div className="px-3">
        <OrgSwitcher />
      </div>

      <div className="mt-3 px-3">
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded-md border border-border px-1.5 text-xs font-semibold">Ctrl K</kbd>
        </button>
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
                    'flex items-center gap-3 rounded-2xl border-l-[3px] px-3 py-2.5 font-semibold transition-colors',
                    active
                      ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
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
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-extrabold text-primary-soft-foreground">
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
