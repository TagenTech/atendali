'use client';

import { initials, Permission } from '@skedulei/contracts';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useOrg } from '@/lib/org';
import { useClients } from '@/lib/queries/agenda';
import { cn } from '@/lib/utils';
import { canSee, navItems } from './nav-items';

const OPEN_EVENT = 'skedulei:open-search';

/** Abre a busca global (usado pelo botão do menu lateral). */
export const openSearch = () => window.dispatchEvent(new Event(OPEN_EVENT));

interface Entry {
  key: string;
  label: string;
  hint: string;
  href: string;
  avatar?: string;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { can, has, vocab } = useOrg();
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const q = query.trim();
  const canClients = can(Permission.CLIENTS_VIEW);
  const people = useClients(canClients && q.length >= 2 ? q : '');
  const pages: Entry[] = navItems(vocab)
    .filter((i) => canSee(i, can, has))
    .map((i) => ({ key: i.href, label: i.label, hint: 'Ir para', href: i.href }));
  const needle = q.toLowerCase();
  const shownPages = needle ? pages.filter((p) => p.label.toLowerCase().includes(needle)) : pages;
  const found: Entry[] =
    q.length >= 2 && canClients
      ? (people.data ?? []).slice(0, 6).map((c) => ({ key: `c-${c.id}`, label: c.name, hint: vocab.client, href: `/clientes/${c.id}`, avatar: initials(c.name) }))
      : [];
  const entries = [...found, ...shownPages];

  const go = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    router.push(e.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(entries[active]);
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-5 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder={`Buscar ${vocab.client.toLowerCase()} ou ir para uma tela`}
          aria-label="Buscar"
          className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded-md border border-border px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">Esc</kbd>
      </div>
      <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
        {entries.length ? (
          entries.map((e, i) => (
            <li key={e.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => go(e)}
                onMouseMove={() => setActive(i)}
                className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', i === active && 'bg-primary-soft')}
              >
                {e.avatar ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-extrabold">{e.avatar}</span> : null}
                <span className="min-w-0 flex-1 truncate font-semibold">{e.label}</span>
                <span className="text-xs text-muted-foreground">{e.hint}</span>
              </button>
            </li>
          ))
        ) : (
          <li className="px-3 py-6 text-center text-muted-foreground">Nada encontrado.</li>
        )}
      </ul>
    </div>
  );
}

/** Ctrl/⌘+K: ir para uma tela ou abrir a ficha de alguém, sem tirar a mão do teclado. */
export function CommandPalette() {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <dialog
      ref={ref}
      aria-label="Busca"
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
      className="m-0 mx-auto mt-[12vh] w-[min(36rem,calc(100%-2rem))] rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/30"
    >
      {open ? <Palette onClose={close} /> : null}
    </dialog>
  );
}
