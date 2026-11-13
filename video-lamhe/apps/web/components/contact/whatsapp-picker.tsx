'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Crown,
  Flower2,
  HeartHandshake,
  Mountain,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  DEFAULT_CONTACT_SETTINGS,
  SEED_CITIES,
  type ContactSettings,
  type PublicCity,
  type EventType,
  type WhatsappContactInput,
} from '@video-lamhe/shared';
import { Button, Chip, Input, Modal, Select, Textarea } from '@/components/ui';
import { ApiError, api } from '@/lib/api/client';
import { openWhatsapp } from '@/lib/contact/whatsapp';
import { useWhatsappPicker } from '@/stores/whatsapp-picker';
import { WhatsappIcon } from './whatsapp-icon';

const EVENT_ICONS: Record<string, LucideIcon> = {
  mehndi: Flower2,
  barat: Crown,
  walima: UtensilsCrossed,
  nikah: HeartHandshake,
  outdoor: Mountain,
  other: Sparkles,
};

const CHOICE_KEY = 'vl-wa-choice';

interface Choice {
  eventType?: EventType;
  eventDate?: string;
  cityName?: string;
}

function loadChoice(): Choice {
  try {
    return JSON.parse(sessionStorage.getItem(CHOICE_KEY) ?? '{}') as Choice;
  } catch {
    return {};
  }
}

function saveChoice(c: Choice) {
  try {
    sessionStorage.setItem(CHOICE_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * "Welcome to Video Lamhe! 👋 Aap ko kya chahiye?" — shown before every WhatsApp hand-off
 * (Section 8.1). Mounted once; opened via useWhatsappPicker().openPicker(context).
 */
export function WhatsappPickerHost() {
  const { open, context, close } = useWhatsappPicker();
  const [choice, setChoice] = useState<Choice>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings', 'contact'],
    queryFn: () => api<ContactSettings>('/settings/contact'),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const s = settings ?? DEFAULT_CONTACT_SETTINGS;

  // Cities come from the admin-managed list; the seed list is only a fallback while loading/offline.
  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: () => api<PublicCity[]>('/cities'),
    staleTime: 10 * 60_000,
    enabled: open,
  });
  const cityOptions = (cities ?? SEED_CITIES).map((c) => ({ value: c.name, label: c.name }));

  // Each time the picker opens: restore this session's last choice, prefer the page's city.
  useEffect(() => {
    if (!open) return;
    const last = loadChoice();
    setChoice({ ...last, cityName: context.cityName ?? last.cityName });
    setNote('');
  }, [open, context.cityName]);

  async function submit(skip: boolean) {
    const body: WhatsappContactInput = {
      operatorSlug: context.operatorSlug,
      operatorName: context.operatorName,
      droneName: context.droneName,
      cityName: skip ? context.cityName : choice.cityName || undefined,
      ...(skip
        ? {}
        : {
            eventType: choice.eventType,
            eventDate: choice.eventDate || undefined,
            note: note.trim() || undefined,
          }),
    };
    if (!skip) saveChoice(choice);
    setSubmitting(true);
    try {
      await openWhatsapp(body);
      close();
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'RATE_LIMITED')) {
        toast.error(
          err instanceof ApiError ? err.message : 'Could not open WhatsApp. Please try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title={s.welcomeTitle}
      description={
        context.operatorName
          ? `${s.welcomeSubtitle} · About ${context.operatorName}`
          : s.welcomeSubtitle
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => submit(true)} disabled={submitting}>
            Skip
          </Button>
          <Button variant="whatsapp" onClick={() => submit(false)} loading={submitting}>
            {!submitting && <WhatsappIcon />}
            Continue on WhatsApp
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <fieldset>
          <legend className="sr-only">Event</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {s.eventOptions.map((o) => {
              const Icon = EVENT_ICONS[o.value] ?? Sparkles;
              const selected = choice.eventType === o.value;
              return (
                <Chip
                  key={o.value}
                  selected={selected}
                  className="h-auto min-h-14 justify-start whitespace-normal rounded-media px-3 py-2 text-left leading-tight"
                  onClick={() =>
                    setChoice((c) => ({
                      ...c,
                      eventType: selected ? undefined : (o.value as EventType),
                    }))
                  }
                >
                  <Icon aria-hidden="true" />
                  {o.label}
                </Chip>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label="Event date (optional)"
            min={todayIso()}
            value={choice.eventDate ?? ''}
            onChange={(e) => setChoice((c) => ({ ...c, eventDate: e.target.value }))}
          />
          <Select
            label="City (optional)"
            placeholder="Select city"
            options={cityOptions}
            value={choice.cityName ?? ''}
            onChange={(e) => setChoice((c) => ({ ...c, cityName: e.target.value || undefined }))}
          />
        </div>
        <Textarea
          label="Note (optional)"
          placeholder="Venue, timings, anything else…"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </form>
    </Modal>
  );
}
