'use client';

import { Permission } from '@skedulei/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/financeiro', label: 'Resumo' },
  { href: '/financeiro/contas', label: 'Contas' },
  { href: '/financeiro/dre', label: 'DRE' },
  { href: '/financeiro/fluxo', label: 'Fluxo de caixa' },
];

/** Abas do financeiro (só para quem pode ver o financeiro). */
export function FinanceTabs() {
  const { can } = useOrg();
  const pathname = usePathname();
  if (!can(Permission.FINANCE_VIEW)) return null;
  return (
    <nav aria-label="Financeiro" className="mb-4 flex gap-2 overflow-x-auto px-5">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold transition-all',
              active ? 'border-transparent bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
