'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthBootstrap } from '@/components/auth/auth-bootstrap';
import { CallSheetHost } from '@/components/contact/call-sheet';
import { PendingActionRunner } from '@/components/contact/pending-action-runner';
import { WhatsappPickerHost } from '@/components/contact/whatsapp-picker';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="top-center"
      closeButton
      toastOptions={{ className: 'font-sans' }}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        themes={['light', 'dark']}
        storageKey="vl-theme"
      >
        <AuthBootstrap />
        <PendingActionRunner />
        {children}
        <WhatsappPickerHost />
        <CallSheetHost />
        <ThemedToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
