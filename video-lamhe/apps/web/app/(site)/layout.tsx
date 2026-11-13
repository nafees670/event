import type { ReactNode } from 'react';
import { FloatingWhatsapp } from '@/components/contact/floating-whatsapp';
import { SiteHeader } from '@/components/layout/site-header';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <FloatingWhatsapp />
    </>
  );
}
