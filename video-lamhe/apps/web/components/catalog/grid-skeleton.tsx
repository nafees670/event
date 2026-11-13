import { Skeleton } from '@/components/ui';

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <main
      className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-24 pt-10 sm:px-6"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-14 w-2/3 max-w-lg" />
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <Skeleton className="h-12 sm:w-48" />
        <Skeleton className="h-12 sm:w-48" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-card" />
        ))}
      </div>
    </main>
  );
}
