import Link from 'next/link';
import * as React from 'react';
import { LogoMark } from '@/components/brand/logo';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/login" className="mb-8 inline-flex items-center gap-2 font-display font-extrabold">
        <LogoMark className="size-8" /> Skedulei
      </Link>
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Atualizado em {updated}</p>
      <div className="mt-6 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  );
}
