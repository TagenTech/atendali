import * as React from 'react';
import { LogoMark } from '@/components/brand/logo';

/** Fundo com bolhas + logo, compartilhado pelas telas de entrada. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden pt-safe">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary-soft blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 top-40 size-60 rounded-full bg-pink-soft blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-success-soft opacity-70 blur-2xl" />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 animate-fade-up text-center">
          <LogoMark className="mx-auto mb-4 size-16 drop-shadow-[0_12px_24px_rgb(143_124_248/0.35)]" />
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="animate-fade-up">{children}</div>
      </div>
    </main>
  );
}
