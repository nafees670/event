'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, FormAlert, Skeleton } from '@/components/ui';
import { fetchSavedShorts, shortKeys } from '@/lib/api/shorts-client';
import { ShortThumbGrid } from './short-thumb';

export function SavedShorts() {
  const saved = useQuery({ queryKey: shortKeys.saved, queryFn: fetchSavedShorts });
  return (
    <section aria-labelledby="saved" className="flex flex-col gap-4">
      <h2 id="saved" className="text-3xl">
        Saved <em className="accent">shorts</em>
      </h2>
      {saved.isError ? (
        <FormAlert>Couldn’t load your saved shorts.</FormAlert>
      ) : !saved.data ? (
        <Skeleton className="h-60 rounded-card" />
      ) : saved.data.length === 0 ? (
        <div className="flex flex-col items-start gap-3 text-sm text-muted">
          <p>Tap the bookmark on any short to keep it here.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/shorts">Watch shorts</Link>
          </Button>
        </div>
      ) : (
        <ShortThumbGrid shorts={saved.data} />
      )}
    </section>
  );
}
