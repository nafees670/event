import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { PublicShort, ShortFeedMeta } from '@video-lamhe/shared';
import { WhatsappButton } from '@/components/contact/whatsapp-button';
import { ShortThumb } from '@/components/shorts/short-thumb';
import { Button } from '@/components/ui';
import { serverApiSafe } from '@/lib/api/server';

// ISR: featured shorts refresh every minute; the hero ships in Phase 4.
export const revalidate = 60;

async function featuredShorts(): Promise<PublicShort[]> {
  const featured = await serverApiSafe<PublicShort[], ShortFeedMeta>(
    '/shorts?featured=true&limit=8',
  );
  if (featured?.data?.length) return featured.data;
  // Nothing featured yet → latest published.
  const latest = await serverApiSafe<PublicShort[], ShortFeedMeta>('/shorts?limit=8');
  return latest?.data ?? [];
}

/** Placeholder Home with the featured shorts row — the full Home page is built in Phase 4. */
export default async function HomePage() {
  const shorts = await featuredShorts();

  return (
    <main className="flex flex-col gap-16 pb-24">
      <section className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-center justify-center gap-8 px-6 pt-10 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Video Lamhe</p>
        <h1 className="text-5xl leading-[1.05] sm:text-7xl">
          Wedding stories, <em className="accent">from above.</em>
        </h1>
        <p className="max-w-md text-muted">
          Watch wedding drone shorts, compare drones and book a verified operator in your city.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <WhatsappButton size="lg">Plan your shoot on WhatsApp</WhatsappButton>
          <Button asChild variant="outline" size="lg">
            <Link href="/operators">Find an operator</Link>
          </Button>
        </div>
      </section>

      {shorts.length > 0 && (
        <section
          aria-labelledby="featured-shorts"
          className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 sm:px-6"
        >
          <div className="flex items-end justify-between gap-4">
            <h2 id="featured-shorts" className="text-4xl">
              Featured <em className="accent">shorts</em>
            </h2>
            <Button asChild variant="link">
              <Link href="/shorts">
                Watch all <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {shorts.map((s) => (
              <ShortThumb key={s.id} short={s} className="w-40 shrink-0 snap-start sm:w-52" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
