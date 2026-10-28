'use client';

import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org';
import { cn, haptic } from '@/lib/utils';
import { canSee, isActive, MOBILE_HREFS, navItems, type NavItem } from './nav-items';

/** Barra inferior — só no celular/tablet. Serviços, equipe e negócio ficam em "Mais" para caber no polegar. */
export function BottomNav() {
  const pathname = usePathname();
  const { can, has, vocab } = useOrg();
  const items: NavItem[] = [
    ...navItems(vocab).filter((i) => MOBILE_HREFS.includes(i.href) && canSee(i, can, has)),
    { href: '/mais', label: 'Mais', icon: Ellipsis },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--nav-bg)] pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href) || (href === '/mais' && ['/configuracoes', '/servicos', '/equipe', '/caixa', '/financeiro', '/relatorios', '/comissoes', '/estoque', '/fidelidade', '/avaliacoes', '/atividade', '/tv'].some((p) => isActive(pathname, p)));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => !active && haptic(8)}
                aria-current={active ? 'page' : undefined}
                className="group flex flex-col items-center gap-1 pb-2 pt-2.5"
              >
                <span
                  className={cn(
                    'grid h-8 w-14 place-items-center rounded-full transition-all duration-200',
                    active ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground group-active:scale-90',
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cn('text-[11px] font-semibold', active ? 'text-primary-soft-foreground' : 'text-muted-foreground')}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
