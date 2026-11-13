'use client';

import { Heart, MapPin, MessageCircle, Phone, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EVENT_TYPES, SEED_CITIES } from '@video-lamhe/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Chip,
  Input,
  Modal,
  ModalClose,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemeToggle,
} from '@/components/ui';

const SWATCHES = [
  'ground',
  'surface',
  'sand',
  'ink',
  'muted',
  'line',
  'primary',
  'gold',
  'gold-text',
  'band',
  'whatsapp',
  'danger',
  'success',
] as const;

// Literal class names so Tailwind's JIT picks them up.
const SWATCH_BG: Record<(typeof SWATCHES)[number], string> = {
  ground: 'bg-ground',
  surface: 'bg-surface',
  sand: 'bg-sand',
  ink: 'bg-ink',
  muted: 'bg-muted',
  line: 'bg-line',
  primary: 'bg-primary',
  gold: 'bg-gold',
  'gold-text': 'bg-gold-text',
  band: 'bg-band',
  whatsapp: 'bg-whatsapp',
  danger: 'bg-danger',
  success: 'bg-success',
};

const DRONES = [
  { value: 'air-2', label: 'Air 2' },
  { value: 'air-2s', label: 'Air 2S' },
  { value: 'air-3', label: 'Air 3' },
  { value: 'air-3s', label: 'Air 3S' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-line py-10">
      <h2 className="text-3xl">{title}</h2>
      {children}
    </section>
  );
}

export function UiShowcase() {
  const [events, setEvents] = useState<string[]>(['barat']);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-4 z-40 mx-4 flex items-center justify-between rounded-full border border-line bg-surface/90 py-1.5 pl-6 pr-1.5 shadow-soft backdrop-blur sm:mx-auto sm:max-w-5xl">
        <span className="font-serif text-xl">
          Video <em className="accent">Lamhe</em>
        </span>
        <div className="flex items-center gap-1">
          <span className="hidden text-sm text-muted sm:inline">Design system</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        <h1 className="text-5xl leading-[1.05] sm:text-6xl">
          Wedding stories, <em className="accent">from above.</em>
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Base components and tokens. Toggle the theme (top right) — every element should read well
          in both Light and Dark.
        </p>

        <Section title="Colour tokens">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {SWATCHES.map((s) => (
              <div key={s} className="flex flex-col gap-2">
                <div className={`h-16 rounded-media border border-line ${SWATCH_BG[s]}`} />
                <code className="text-xs text-muted">{s}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <p className="font-serif text-6xl leading-none">
            Instrument <em className="accent">Serif</em>
          </p>
          <p className="text-lg">Inter body — The quick brown fox jumps over the lazy dog.</p>
          <p className="text-sm text-muted">Muted secondary text for captions and hints.</p>
          <a href="#top" className="w-fit text-gold-text underline-offset-4 hover:underline">
            Gold text link
          </a>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="gold">
              <Search aria-hidden="true" /> Search
            </Button>
            <Button variant="outline">
              <MessageCircle aria-hidden="true" /> Chat
            </Button>
            <Button variant="whatsapp">
              <Phone aria-hidden="true" /> WhatsApp
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link button</Button>
            <Button variant="outline" size="icon" aria-label="Like">
              <Heart aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <Button
              loading={loading}
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1500);
              }}
            >
              {loading ? 'Saving…' : 'Click to load'}
            </Button>
          </div>
        </Section>

        <Section title="Inputs & selects">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Full name" placeholder="[Your name]" autoComplete="name" />
            <Input
              label="Phone"
              placeholder="03xx xxxxxxx"
              inputMode="tel"
              hint="We never share your number publicly."
            />
            <Select
              label="City"
              placeholder="Select a city"
              options={SEED_CITIES.map((c) => ({ value: c.slug, label: c.name }))}
              defaultValue=""
            />
            <Input
              label="Email"
              type="email"
              defaultValue="not-an-email"
              error="Enter a valid email address"
            />
            <Input label="Disabled" disabled defaultValue="Read only" />
            <Select label="Event" options={EVENT_TYPES} defaultValue="barat" />
          </div>
        </Section>

        <Section title="Chips & badges">
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((e) => {
              const selected = events.includes(e.value);
              return (
                <Chip
                  key={e.value}
                  selected={selected}
                  onClick={() =>
                    setEvents((prev) =>
                      selected ? prev.filter((v) => v !== e.value) : [...prev, e.value],
                    )
                  }
                >
                  {e.label}
                </Chip>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge variant="gold">Most booked</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">Verified</Badge>
            <Badge variant="danger">Rejected</Badge>
            <Badge variant="solid">New</Badge>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="air-2s">
            <TabsList aria-label="Drone model">
              {DRONES.map((d) => (
                <TabsTrigger key={d.value} value={d.value}>
                  {d.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {DRONES.map((d) => (
              <TabsContent key={d.value} value={d.value}>
                <p className="text-muted">
                  DJI {d.label} — specs, “Best for” and price{' '}
                  <span className="font-medium text-ink">[PRICE]</span> appear here.
                </p>
              </TabsContent>
            ))}
          </Tabs>
        </Section>

        <Section title="Cards">
          <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Card interactive>
              <div className="aspect-[4/5] rounded-t-card bg-sand" />
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="success">Verified</Badge>
                  <Badge variant="gold">Air 3S</Badge>
                </div>
                <CardTitle>[Operator name]</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden="true" /> Karachi · Hyderabad
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-5">
                <Button size="sm" variant="outline">
                  Chat
                </Button>
                <Button size="sm" variant="whatsapp">
                  WhatsApp
                </Button>
                <Button size="sm">Book</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Static card</CardTitle>
                <CardDescription>No hover lift. Borders carry more weight in dark.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Card body content.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="aspect-video rounded-media" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Modal / bottom sheet">
          <div>
            <Modal
              open={modalOpen}
              onOpenChange={setModalOpen}
              trigger={<Button variant="outline">Open modal</Button>}
              title="Welcome to Video Lamhe! Aap ko kya chahiye?"
              description="What do you need?"
              footer={
                <>
                  <ModalClose asChild>
                    <Button variant="ghost">Skip</Button>
                  </ModalClose>
                  <Button variant="whatsapp" onClick={() => setModalOpen(false)}>
                    Continue on WhatsApp
                  </Button>
                </>
              }
            >
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((e) => (
                  <Chip key={e.value} selected={e.value === 'barat'}>
                    {e.label}
                  </Chip>
                ))}
              </div>
            </Modal>
            <p className="mt-2 text-sm text-muted">
              Bottom sheet below 640px, centered modal above.
            </p>
          </div>
        </Section>

        <Section title="Bands & overlays">
          <div className="relative overflow-hidden rounded-card">
            <div className="aspect-[16/7] bg-gradient-to-br from-gold/60 via-sand to-muted" />
            <div className="absolute inset-0 bg-black" style={{ opacity: 'var(--hero-overlay)' }} />
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center font-serif text-4xl text-white">
              Hero overlay (45% / 55%)
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 rounded-card bg-band p-8 text-band-foreground">
            <h3 className="text-4xl">
              Anywhere in <em className="italic text-gold">Pakistan</em>
            </h3>
            <div className="flex flex-wrap gap-2">
              {SEED_CITIES.slice(0, 5).map((c) => (
                <span
                  key={c.slug}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm"
                >
                  {c.name}
                </span>
              ))}
            </div>
            <Button variant="whatsapp">WhatsApp us</Button>
          </div>
        </Section>
      </main>
    </div>
  );
}
