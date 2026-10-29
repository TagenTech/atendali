import * as React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-3 px-6 pb-4 pt-5 lg:px-8 lg:pb-5 lg:pt-8">
      <div className="min-w-0">
        {subtitle ? <p className="text-sm font-medium text-muted-foreground">{subtitle}</p> : null}
        <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}
