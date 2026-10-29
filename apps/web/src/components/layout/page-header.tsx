import * as React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 px-5 pb-4 pt-5 lg:pb-5 lg:pt-8">
      <div className="min-w-0">
        {subtitle ? <p className="text-sm font-medium text-muted-foreground">{subtitle}</p> : null}
        <h1 className="truncate text-2xl font-extrabold tracking-tight lg:text-3xl">{title}</h1>
      </div>
      {action}
    </header>
  );
}
