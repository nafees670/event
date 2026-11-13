'use client';

import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui';

export default function SiteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-4xl">Something went wrong</h1>
      <p className="text-muted">
        We couldn’t load this page. Please check your connection and try again.
      </p>
      <Button onClick={reset}>
        <RotateCw aria-hidden="true" /> Try again
      </Button>
    </main>
  );
}
