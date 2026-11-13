'use client';

import { CalendarCheck, MessageCircle, Phone } from 'lucide-react';
import { ContactGate } from '@/components/contact/contact-gate';
import { WhatsappButton } from '@/components/contact/whatsapp-button';
import { Button, type ButtonProps } from '@/components/ui';
import type { ContactContext } from '@/lib/contact/types';
import { cn } from '@/lib/utils';

interface Props {
  context: ContactContext;
  size?: ButtonProps['size'];
  className?: string;
  /** Profile page shows Call too; cards keep it compact. */
  showCall?: boolean;
  /** Tighter buttons so WhatsApp / Chat / Book fit one row on a card. */
  compact?: boolean;
}

/** Chat / WhatsApp / Call / Book — all behind the login gate (Section 2.1). */
export function OperatorActions({
  context,
  size = 'sm',
  className,
  showCall = false,
  compact = false,
}: Props) {
  const tight = compact ? 'px-3.5' : undefined;
  return (
    <div className={cn('flex flex-wrap items-center', compact ? 'gap-1.5' : 'gap-2', className)}>
      <WhatsappButton size={size} context={context} className={tight} />
      <ContactGate action="chat" context={context}>
        <Button size={size} variant="outline" className={tight}>
          <MessageCircle aria-hidden="true" /> Chat
        </Button>
      </ContactGate>
      {showCall && (
        <ContactGate action="call" context={context}>
          <Button size={size} variant="outline">
            <Phone aria-hidden="true" /> Call
          </Button>
        </ContactGate>
      )}
      <ContactGate action="book" context={context}>
        <Button size={size} className={tight}>
          <CalendarCheck aria-hidden="true" /> Book
        </Button>
      </ContactGate>
    </div>
  );
}
