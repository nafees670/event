import type { ShortStatus } from '@video-lamhe/shared';
import { Badge } from '@/components/ui';

const MAP: Record<
  ShortStatus,
  { label: string; variant: 'gold' | 'success' | 'danger' | 'outline' }
> = {
  pending: { label: 'Pending review', variant: 'gold' },
  published: { label: 'Published', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  draft: { label: 'Draft', variant: 'outline' },
};

export function ShortStatusBadge({ status }: { status: ShortStatus }) {
  const { label, variant } = MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
