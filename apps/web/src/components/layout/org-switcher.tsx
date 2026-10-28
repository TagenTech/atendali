'use client';

import { ROLE_INFO, SEGMENT_PRESETS } from '@skedulei/contracts';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { useOrg } from '@/lib/org';
import { cn } from '@/lib/utils';
import { SegmentIcon } from './segment-icon';

/** Nome do negócio ativo; com mais de um, troca entre eles. Sempre permite criar outro. */
export function OrgSwitcher({ className }: { className?: string }) {
  const { org, orgs, switchOrg } = useOrg();
  const router = useRouter();

  return (
    <Menu>
      <MenuTrigger
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl p-2 text-left outline-none transition-colors hover:bg-muted data-[state=open]:bg-muted',
          className,
        )}
        aria-label={`Negócio ativo: ${org.name}. Trocar de negócio`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <SegmentIcon segment={org.segment} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display font-extrabold leading-tight">{org.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{ROLE_INFO[org.me.role].label}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </MenuTrigger>
      <MenuContent className="w-72">
        {orgs.map((o) => (
          <MenuItem
            key={o.id}
            icon={<SegmentIcon segment={o.segment} />}
            onSelect={() => {
              switchOrg(o.id);
              router.push('/inicio');
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.name}</span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {SEGMENT_PRESETS[o.segment].label} · {ROLE_INFO[o.role].label}
              </span>
            </span>
            {o.id === org.id ? <Check className="text-primary" /> : null}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<Plus />} onSelect={() => router.push('/onboarding')}>
          Criar outro negócio
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
