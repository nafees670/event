'use client';

import { Bookmark, CalendarCheck, Heart, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { PublicShort } from '@video-lamhe/shared';
import { ContactGate } from '@/components/contact/contact-gate';
import { WhatsappIcon } from '@/components/contact/whatsapp-icon';
import { setShortLiked, setShortSaved } from '@/lib/shorts/engagement';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useShortEngagement } from '@/stores/short-engagement';

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

function ActionButton({
  label,
  children,
  caption,
  active,
  onClick,
  className,
}: {
  label: string;
  children: ReactNode;
  caption?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn('flex flex-col items-center gap-1 text-white drop-shadow', className)}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm transition-transform active:scale-90 [&_svg]:size-6">
        {children}
      </span>
      {caption && <span className="text-xs font-medium">{caption}</span>}
    </button>
  );
}

/** Right-hand action column on a short. Like/Save/WhatsApp/Book go through the login gate. */
export function ShortActions({ short }: { short: PublicShort }) {
  const authed = useAuthStore((s) => s.status === 'authenticated');
  const liked = useShortEngagement((s) => s.liked[short.id] ?? false);
  const saved = useShortEngagement((s) => s.saved[short.id] ?? false);
  const likeCount = useShortEngagement((s) => s.likeCount[short.id] ?? short.likeCount);
  const context = {
    shortId: short.id,
    operatorSlug: short.operator.slug,
    operatorName: short.operator.businessName,
    droneName: short.droneModel?.name,
    cityName: short.city.name,
  };

  const share = async () => {
    const url = `${window.location.origin}/shorts?start=${short.id}`;
    try {
      if (navigator.share) await navigator.share({ title: short.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {authed && liked ? (
        <ActionButton
          label="Unlike"
          active
          caption={compact.format(likeCount)}
          onClick={() => setShortLiked(short.id, false, likeCount)}
        >
          <Heart className="fill-current text-red-500" aria-hidden="true" />
        </ActionButton>
      ) : (
        <ContactGate action="like" context={context}>
          <ActionButton label="Like" active={false} caption={compact.format(likeCount)}>
            <Heart aria-hidden="true" />
          </ActionButton>
        </ContactGate>
      )}
      {authed && saved ? (
        <ActionButton
          label="Remove from saved"
          active
          caption="Saved"
          onClick={() => setShortSaved(short.id, false)}
        >
          <Bookmark className="fill-current" aria-hidden="true" />
        </ActionButton>
      ) : (
        <ContactGate action="save" context={context}>
          <ActionButton label="Save" active={false} caption="Save">
            <Bookmark aria-hidden="true" />
          </ActionButton>
        </ContactGate>
      )}
      <ActionButton label="Share" caption="Share" onClick={share}>
        <Share2 aria-hidden="true" />
      </ActionButton>
      <ContactGate action="whatsapp" context={context}>
        <ActionButton
          label={`WhatsApp about ${short.operator.businessName}`}
          caption="WhatsApp"
          className="[&>span:first-child]:bg-whatsapp [&>span:first-child]:text-whatsapp-foreground"
        >
          <WhatsappIcon />
        </ActionButton>
      </ContactGate>
      <ContactGate action="book" context={context}>
        <ActionButton label={`Book ${short.operator.businessName}`} caption="Book">
          <CalendarCheck aria-hidden="true" />
        </ActionButton>
      </ContactGate>
    </div>
  );
}
