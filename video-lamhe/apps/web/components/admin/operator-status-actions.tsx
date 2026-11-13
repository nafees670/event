'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ManagedOperator, OperatorStatus } from '@video-lamhe/shared';
import { Button } from '@/components/ui';
import { adminOperators, queryKeys } from '@/lib/api/catalog-client';
import { toastError } from './admin-page';

const NEXT: Record<
  OperatorStatus,
  { to: OperatorStatus; label: string; variant: 'primary' | 'outline' }[]
> = {
  pending: [
    { to: 'active', label: 'Approve', variant: 'primary' },
    { to: 'inactive', label: 'Reject', variant: 'outline' },
  ],
  active: [{ to: 'inactive', label: 'Deactivate', variant: 'outline' }],
  inactive: [{ to: 'active', label: 'Activate', variant: 'primary' }],
};

export function OperatorStatusActions({
  op,
  onChanged,
}: {
  op: ManagedOperator;
  onChanged?: (op: ManagedOperator) => void;
}) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (to: OperatorStatus) => adminOperators.setStatus(op.id, to),
    onSuccess: (updated, to) => {
      toast.success(
        to === 'active'
          ? `${op.businessName} is live`
          : `${op.businessName} deactivated and logged out`,
      );
      void qc.invalidateQueries({ queryKey: ['admin', 'operators'] });
      qc.setQueryData(queryKeys.adminOperator(op.id), updated);
      onChanged?.(updated);
    },
    onError: (err) => toast.error(toastError(err)),
  });
  return (
    <div className="flex gap-2">
      {NEXT[op.status].map((a) => (
        <Button
          key={a.to}
          size="sm"
          variant={a.variant}
          loading={m.isPending && m.variables === a.to}
          disabled={m.isPending}
          onClick={() => m.mutate(a.to)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
