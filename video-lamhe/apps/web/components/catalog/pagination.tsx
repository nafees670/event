import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { PageMeta } from '@video-lamhe/shared';
import { Button } from '@/components/ui';

/** Prev/next links that keep the current filters. */
export function Pagination({
  meta,
  basePath,
  params,
}: {
  meta: PageMeta;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (meta.pages <= 1) return null;
  const href = (page: number) => {
    const p = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    );
    if (page > 1) p.set('page', String(page));
    else p.delete('page');
    const s = p.toString();
    return `${basePath}${s ? `?${s}` : ''}`;
  };
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-4">
      {meta.page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(meta.page - 1)} rel="prev">
            <ChevronLeft aria-hidden="true" /> Previous
          </Link>
        </Button>
      ) : null}
      <span className="text-sm text-muted">
        Page {meta.page} of {meta.pages}
      </span>
      {meta.page < meta.pages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(meta.page + 1)} rel="next">
            Next <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}
