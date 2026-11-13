import { BadgeCheck, MapPin, Star } from 'lucide-react';
import Link from 'next/link';
import type { OperatorDroneOffer, PublicOperatorCard } from '@video-lamhe/shared';
import { Badge, Card } from '@/components/ui';
import { formatPKR, plural } from '@/lib/format';
import { OperatorActions } from './operator-actions';
import { OperatorAvatar } from './operator-avatar';

interface Props {
  operator: PublicOperatorCard;
  /** Price for a specific drone (drone detail page) instead of "from". */
  offer?: OperatorDroneOffer;
  /** City the user is browsing — goes into the WhatsApp message. */
  cityName?: string;
}

export function OperatorCard({ operator: op, offer, cityName }: Props) {
  const href = `/operators/${op.slug}`;
  const price = offer ? offer.pricePerEvent : op.priceFrom;
  const cities = [op.baseCity, ...op.serviceCities].map((c) => c.name);

  return (
    <Card interactive className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-4">
        <OperatorAvatar name={op.businessName} photoUrl={op.photoUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl leading-tight">
            <Link href={href} className="hover:underline">
              {op.businessName}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{cities.join(' · ')}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {op.isVerified && (
          <Badge variant="success">
            <BadgeCheck aria-hidden="true" /> Verified
          </Badge>
        )}
        {op.reviewCount > 0 && (
          <Badge variant="neutral">
            <Star aria-hidden="true" /> {op.rating.toFixed(1)} ({op.reviewCount})
          </Badge>
        )}
        {op.experienceYears > 0 && (
          <Badge variant="outline">{plural(op.experienceYears, 'year')}</Badge>
        )}
        {(offer ? [offer] : op.drones).map((d) => (
          <Badge key={d.id} variant="gold">
            {d.model.name.replace(/^DJI /, '')}
          </Badge>
        ))}
      </div>

      <p className="text-sm">
        {price !== null ? (
          <>
            <span className="text-muted">{offer ? 'Per event' : 'From'} </span>
            <span className="font-medium">{formatPKR(price)}</span>
          </>
        ) : (
          <span className="text-muted">Price on request</span>
        )}
      </p>

      <OperatorActions
        compact
        className="mt-auto"
        context={{
          operatorSlug: op.slug,
          operatorName: op.businessName,
          droneName: offer?.model.name,
          cityName: cityName ?? op.baseCity.name,
        }}
      />
    </Card>
  );
}
