import { Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { PublicShort } from '@video-lamhe/shared';
import { eventShort } from '@/lib/events';
import { cn } from '@/lib/utils';

/** Poster card that opens the short in the feed (/shorts?start=<id>). */
export function ShortThumb({ short, className }: { short: PublicShort; className?: string }) {
  return (
    <Link
      href={`/shorts?start=${short.id}`}
      className={cn(
        'group relative block aspect-[9/16] overflow-hidden rounded-media bg-sand transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <Image
        src={short.thumbnailUrl}
        alt=""
        fill
        sizes="(min-width: 1024px) 220px, 45vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
      />
      <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
        {eventShort(short.eventType)}
      </span>
      <Play
        className="absolute right-2 top-2 size-5 fill-white text-white drop-shadow"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-white">
        <p className="line-clamp-2 font-serif text-lg leading-tight">{short.title}</p>
        <p className="mt-0.5 truncate text-xs text-white/80">
          {short.operator.businessName} · {short.city.name}
        </p>
      </div>
    </Link>
  );
}

export function ShortThumbGrid({ shorts }: { shorts: PublicShort[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {shorts.map((s) => (
        <ShortThumb key={s.id} short={s} />
      ))}
    </div>
  );
}
