'use client';

import { Slot } from '@radix-ui/react-slot';
import type { MouseEvent, ReactElement } from 'react';
import { useContactAction } from '@/lib/contact/use-contact-action';
import type { ContactRequest } from '@/lib/contact/types';

interface ContactGateProps extends ContactRequest {
  /** A single clickable element (Button, a, …). Its own onClick still runs first. */
  children: ReactElement<{ onClick?: (e: MouseEvent) => void }>;
}

/**
 * Wraps any contact button: <ContactGate action="whatsapp" context={{ operatorName }}><Button/></ContactGate>
 */
export function ContactGate({ action, context, children }: ContactGateProps) {
  const run = useContactAction();
  return (
    <Slot
      onClick={(e: MouseEvent) => {
        children.props.onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        void run({ action, context });
      }}
    >
      {children}
    </Slot>
  );
}
