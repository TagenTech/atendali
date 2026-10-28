'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { AuthProvider } from '@/lib/auth';
import { ServiceWorkerRegister } from '@/lib/pwa';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 24 * 3600_000,
            networkMode: 'offlineFirst',
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{ className: '!rounded-2xl !font-sans !shadow-soft' }}
      />
      <ServiceWorkerRegister />
    </QueryClientProvider>
  );
}
