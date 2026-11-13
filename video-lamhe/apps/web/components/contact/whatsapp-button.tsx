'use client';

import { Button, type ButtonProps } from '@/components/ui';
import type { ContactContext } from '@/lib/contact/types';
import { ContactGate } from './contact-gate';
import { WhatsappIcon } from './whatsapp-icon';

interface WhatsappButtonProps extends Omit<ButtonProps, 'variant' | 'asChild'> {
  context?: ContactContext;
}

export function WhatsappButton({ context, children = 'WhatsApp', ...props }: WhatsappButtonProps) {
  return (
    <ContactGate action="whatsapp" context={context}>
      <Button variant="whatsapp" {...props}>
        <WhatsappIcon />
        {children}
      </Button>
    </ContactGate>
  );
}
