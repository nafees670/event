'use client';

import { BadgeCheck, Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PublicShort } from '@video-lamhe/shared';
import { eventShort } from '@/lib/events';
import { recordViewOnce } from '@/lib/shorts/engagement';
import { ShortActions } from './short-actions';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  short: PublicShort;
  index: number;
  /** This item is ≥ 60 % visible. */
  active: boolean;
  /** Within one item of the active one → mount the <video> (others show only the poster). */
  near: boolean;
  onVisible: (index: number) => void;
}

/** One full-screen short: autoplay muted when in view, pause when not (Section 8.2). */
export function ShortPlayer({ short, index, active, near, onVisible }: Props) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  // Report visibility (≥ 60 %) to the feed.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio >= 0.6) onVisible(index);
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index, onVisible]);

  // Play only the active one; never autoplay under reduced motion.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active && !prefersReducedMotion()) {
      v.play()
        .then(() => setPaused(false))
        .catch(() => setPaused(true)); // autoplay blocked → show the play button
    } else {
      v.pause();
      if (!active) v.currentTime = 0;
      setPaused(true);
    }
  }, [active, near]);

  // A view = 2 s of actual playback, once per session.
  useEffect(() => {
    const v = video.current;
    if (!v || !active) return;
    const onTime = () => {
      if (v.currentTime >= 2) {
        recordViewOnce(short.id);
        v.removeEventListener('timeupdate', onTime);
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [active, near, short.id]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play().then(() => setPaused(false));
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <article
      ref={root}
      aria-label={short.title}
      className="relative flex h-dvh snap-start snap-always items-center justify-center bg-black"
    >
      <div className="relative h-full w-full max-w-[calc(100dvh*9/16)] overflow-hidden sm:rounded-card sm:py-4">
        <div className="relative h-full w-full overflow-hidden sm:rounded-card">
          {near ? (
            <video
              ref={video}
              src={short.videoUrl}
              poster={short.thumbnailUrl}
              muted
              loop
              playsInline
              preload={active ? 'auto' : 'metadata'}
              onClick={toggle}
              className="h-full w-full cursor-pointer object-cover"
            />
          ) : (
            <Image
              src={short.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className="object-cover"
            />
          )}

          {near && paused && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Play"
              className="absolute inset-0 m-auto inline-flex size-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            >
              <Play className="size-8 fill-current" aria-hidden="true" />
            </button>
          )}

          {/* bottom gradient + info */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
            <div className="min-w-0 flex-1">
              <Link
                href={`/operators/${short.operator.slug}`}
                className="inline-flex items-center gap-1 font-medium hover:underline"
              >
                {short.operator.businessName}
                {short.operator.isVerified && (
                  <BadgeCheck className="size-4 text-emerald-300" aria-label="Verified" />
                )}
              </Link>
              <p className="mt-0.5 text-xs text-white/80">
                {[short.city.name, eventShort(short.eventType), short.droneModel?.name]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h2 className="mt-2 font-serif text-2xl leading-tight">{short.title}</h2>
              {short.caption && (
                <p className="mt-1 line-clamp-2 text-sm text-white/85">{short.caption}</p>
              )}
            </div>
            <ShortActions short={short} />
          </div>
        </div>
      </div>
    </article>
  );
}
