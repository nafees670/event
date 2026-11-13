'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ContactGate } from './contact-gate';
import { WhatsappIcon } from './whatsapp-icon';

/** Floating WhatsApp button on all public pages (goes through the contact gate). */
export function FloatingWhatsapp({ className }: { className?: string }) {
  // The shorts feed has its own WhatsApp button on every short.
  if (usePathname().startsWith('/shorts')) return null;
  return (
    <ContactGate action="whatsapp">
      <button
        type="button"
        aria-label="Chat with Video Lamhe on WhatsApp"
        className={cn(
          'fixed bottom-5 right-5 z-40 inline-flex size-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lift transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:hover:translate-y-0',
          'mb-[env(safe-area-inset-bottom)]',
          className,
        )}
      >
        <WhatsappIcon className="size-7" />
      </button>
    </ContactGate>
  );
}
