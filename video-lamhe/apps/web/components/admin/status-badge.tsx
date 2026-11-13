import type { OperatorStatus } from '@video-lamhe/shared';
import { Badge } from '@/components/ui';

const MAP: Record<OperatorStatus, { label: string; variant: 'gold' | 'success' | 'danger' }> = {
  pending: { label: 'Pending', variant: 'gold' },
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'danger' },
};

export function OperatorStatusBadge({ status }: { status: OperatorStatus }) {
  const { label, variant } = MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
