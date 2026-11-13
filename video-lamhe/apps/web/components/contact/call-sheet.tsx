'use client';

import { Phone } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useCallSheet } from '@/stores/call-sheet';

/** '923462590643' → '0346 2590643' */
const display = (n: string) => (n.startsWith('92') ? `0${n.slice(2, 5)} ${n.slice(5)}` : n);

export function CallSheetHost() {
  const { open, operatorName, contact, close } = useCallSheet();
  if (!contact) return null;
  const viaTeam = contact.routedTo === 'admin';
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title={viaTeam ? 'Call Video Lamhe' : `Call ${operatorName ?? 'the operator'}`}
      description={
        viaTeam
          ? `Our team arranges bookings${operatorName ? ` with ${operatorName}` : ''} — mention their name when you call.`
          : undefined
      }
      footer={
        <Button asChild size="lg">
          <a href={`tel:+${contact.phone}`}>
            <Phone aria-hidden="true" /> Call {display(contact.phone)}
          </a>
        </Button>
      }
    >
      <p className="font-serif text-4xl tracking-tight">{display(contact.phone)}</p>
    </Modal>
  );
}
