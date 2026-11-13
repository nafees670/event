'use client';

import { Play } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import type { PublicShort } from '@video-lamhe/shared';

/** Thumbnail that turns into a playable video on click (admin/operator lists — no autoplay). */
export function VideoPreview({ short }: { short: PublicShort }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-media bg-black">
      {playing ? (
        <video
          src={short.videoUrl}
          poster={short.thumbnailUrl}
          controls
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${short.title}`}
          className="group absolute inset-0"
        >
          <Image src={short.thumbnailUrl} alt="" fill sizes="200px" className="object-cover" />
          <span className="absolute inset-0 m-auto inline-flex size-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
            <Play className="size-6 fill-current" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
