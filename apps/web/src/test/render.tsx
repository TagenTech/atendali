import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import * as React from 'react';

/** Renderiza com um cache de queries novo (sem repetição, para o erro aparecer logo). */
export function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const out = render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return { qc, ...out };
}
