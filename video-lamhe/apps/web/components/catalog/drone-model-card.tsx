import { Plane } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { PublicDroneModel } from '@video-lamhe/shared';
import { Badge, Card } from '@/components/ui';
import { formatPKR, plural } from '@/lib/format';

export function DroneMedia({ model, className }: { model: PublicDroneModel; className?: string }) {
  const img = model.images[0];
  return (
    <div className={`relative overflow-hidden rounded-media bg-sand ${className ?? ''}`}>
      {img ? (
        <Image
          src={img}
          alt={model.name}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted" aria-hidden="true">
          <Plane className="size-10" />
        </div>
      )}
    </div>
  );
}

export function DroneModelCard({
  model,
  citySlug,
}: {
  model: PublicDroneModel;
  citySlug?: string;
}) {
  const href = `/drones/${model.slug}${citySlug ? `?city=${citySlug}` : ''}`;
  return (
    <Card interactive className="relative flex flex-col overflow-hidden p-3">
      <DroneMedia model={model} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-2xl leading-tight">
            <Link href={href} className="after:absolute after:inset-0 hover:underline">
              {model.name}
            </Link>
          </h3>
          {model.tag && <Badge variant="gold">{model.tag}</Badge>}
        </div>
        {model.bestFor && <p className="line-clamp-2 text-sm text-muted">{model.bestFor}</p>}
        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
          <span>
            {model.priceFrom !== null ? (
              <>
                <span className="text-muted">From </span>
                <span className="font-medium">{formatPKR(model.priceFrom)}</span>
              </>
            ) : (
              <span className="text-muted">Price on request</span>
            )}
          </span>
          <span className="text-muted">{plural(model.operatorCount, 'operator')}</span>
        </div>
      </div>
    </Card>
  );
}
