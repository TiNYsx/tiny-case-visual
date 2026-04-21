'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'sonner';
import i18n from '@/lib/i18n';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <I18nextProvider i18n={i18n}>
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#292524',
              color: '#fafaf9',
              border: '1px solid #44403c',
            },
          }}
        />
      </I18nextProvider>
    </SessionProvider>
  );
}