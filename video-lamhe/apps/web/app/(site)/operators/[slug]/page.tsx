import { BadgeCheck, MapPin, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PublicOperator, PublicShort, ShortFeedMeta } from '@video-lamhe/shared';
import { ShortThumbGrid } from '@/components/shorts/short-thumb';
import { OperatorActions } from '@/components/catalog/operator-actions';
import { OperatorAvatar } from '@/components/catalog/operator-avatar';
import { Badge, Card, CardContent } from '@/components/ui';
import { serverApi, serverApiSafe } from '@/lib/api/server';
import { formatPKR, plural } from '@/lib/format';

type Params = Promise<{ slug: string }>;

/** Missing → null (never notFound() here: see generateMetadata). */
const getOperator = (slug: string) =>
  serverApi<PublicOperator | null>(`/operators/${encodeURIComponent(slug)}`, {
    allowMissing: true,
  });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // Metadata streams after the page shell, so notFound() here would leave the status at 200.
  // Only the page calls notFound() → a real 404 for unknown/pending operators.
  const { data: op } = await getOperator(slug);
  if (!op) return { title: 'Operator not found', robots: { index: false } };
  const cities = [op.baseCity, ...op.serviceCities].map((c) => c.name).join(', ');
  return {
    title: `${op.businessName} — drone videography in ${op.baseCity.name}`,
    description:
      op.bio?.slice(0, 160) ??
      `Wedding drone videography by ${op.businessName}. Serving ${cities}.`,
    alternates: { canonical: `/operators/${slug}` },
  };
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  website: 'Website',
};

export default async function OperatorPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { data: op } = await getOperator(slug);
  if (!op) notFound();
  const portfolio =
    (
      await serverApiSafe<PublicShort[], ShortFeedMeta>(
        `/shorts?operator=${encodeURIComponent(slug)}&limit=12`,
      )
    )?.data ?? [];
  const cities = [op.baseCity, ...op.serviceCities];
  const links = Object.entries(op.socialLinks).filter(([, v]) => v);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-24 pt-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/operators" className="hover:underline">
          Operators
        </Link>{' '}
        / <span className="text-ink">{op.businessName}</span>
      </nav>

      <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <OperatorAvatar name={op.businessName} photoUrl={op.photoUrl} size={96} />
        <div className="flex flex-1 flex-col gap-3">
          <h1 className="text-5xl leading-[1.05]">{op.businessName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {op.isVerified && (
              <Badge variant="success">
                <BadgeCheck aria-hidden="true" /> Verified
              </Badge>
            )}
            {op.reviewCount > 0 && (
              <Badge>
                <Star aria-hidden="true" /> {op.rating.toFixed(1)} ·{' '}
                {plural(op.reviewCount, 'review')}
              </Badge>
            )}
            {op.experienceYears > 0 && (
              <Badge variant="outline">{plural(op.experienceYears, 'year')} experience</Badge>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-muted">
            <MapPin className="size-4" aria-hidden="true" />
            {cities.map((c, i) => (
              <span key={c.id}>
                <Link href={`/cities/${c.slug}`} className="hover:text-ink hover:underline">
                  {c.name}
                </Link>
                {i === 0 && cities.length > 1 ? ' (base)' : ''}
                {i < cities.length - 1 ? ' ·' : ''}
              </span>
            ))}
          </p>
          <OperatorActions
            size="md"
            showCall
            className="pt-2"
            context={{
              operatorSlug: op.slug,
              operatorName: op.businessName,
              cityName: op.baseCity.name,
            }}
          />
        </div>
      </section>

      {op.bio && (
        <section aria-labelledby="about" className="flex flex-col gap-3">
          <h2 id="about" className="text-3xl">
            About
          </h2>
          <p className="max-w-3xl whitespace-pre-line text-muted">{op.bio}</p>
        </section>
      )}

      <section aria-labelledby="drones" className="flex flex-col gap-4">
        <h2 id="drones" className="text-3xl">
          Drones &amp; <em className="accent">prices</em>
        </h2>
        {op.drones.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {op.drones.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <Link
                      href={`/drones/${d.model.slug}`}
                      className="font-serif text-2xl hover:underline"
                    >
                      {d.model.name}
                    </Link>
                    {d.model.tag && (
                      <Badge variant="gold" className="ml-2 align-middle">
                        {d.model.tag}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    {d.pricePerEvent !== null ? (
                      <p className="font-medium">{formatPKR(d.pricePerEvent)} / event</p>
                    ) : (
                      <p className="text-muted">Price on request</p>
                    )}
                    {d.pricePerHour !== null && (
                      <p className="text-muted">{formatPKR(d.pricePerHour)} / hour</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted">Drone list coming soon.</p>
        )}
      </section>

      {portfolio.length > 0 && (
        <section aria-labelledby="portfolio" className="flex flex-col gap-4">
          <h2 id="portfolio" className="text-3xl">
            Portfolio
          </h2>
          <ShortThumbGrid shorts={portfolio} />
        </section>
      )}

      {links.length > 0 && (
        <section aria-labelledby="links" className="flex flex-col gap-3">
          <h2 id="links" className="text-3xl">
            Find them online
          </h2>
          <ul className="flex flex-wrap gap-2">
            {links.map(([k, url]) => (
              <li key={k}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-sm hover:bg-sand"
                >
                  {SOCIAL_LABELS[k] ?? k}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
