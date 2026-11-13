'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AdminShortUpdateInput, ManagedShort, ShortStatus } from '@video-lamhe/shared';
import { ShortStatusBadge } from '@/components/shorts/short-status-badge';
import { VideoPreview } from '@/components/shorts/video-preview';
import {
  Badge,
  Button,
  Card,
  CardContent,
  FormAlert,
  Modal,
  Skeleton,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import { adminShorts, shortKeys } from '@/lib/api/shorts-client';
import { eventShort } from '@/lib/events';
import { AdminPageHeader, toastError } from './admin-page';
import { AdminShortUpload } from './admin-short-upload';
import { ConfirmDialog } from './confirm-dialog';

const TABS: { value: ShortStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Drafts' },
  { value: 'all', label: 'All' },
];

function RejectDialog({
  short,
  onReject,
}: {
  short: ManagedShort;
  onReject: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button size="sm" variant="outline">
          <X aria-hidden="true" /> Reject
        </Button>
      }
      title={`Reject “${short.title}”?`}
      description="The operator sees this reason and can fix and resubmit."
      footer={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onReject(reason);
              setOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          Reject short
        </Button>
      }
    >
      <Textarea
        label="Reason (optional)"
        rows={3}
        maxLength={300}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
}

function ShortRow({ short }: { short: ManagedShort }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (body: AdminShortUpdateInput) => adminShorts.update(short.id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'shorts'] }),
    onError: (err) => toast.error(toastError(err)),
  });

  return (
    <Card>
      <CardContent className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div className="mx-auto w-[140px]">
          <VideoPreview short={short} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ShortStatusBadge status={short.status} />
            {short.isFeatured && <Badge variant="gold">Featured</Badge>}
            {short.operatorInactive && <Badge variant="danger">Operator inactive</Badge>}
          </div>
          <div>
            <h2 className="text-2xl leading-tight">{short.title}</h2>
            <p className="text-sm text-muted">
              {short.operator.businessName} · {short.city.name} · {eventShort(short.eventType)}
              {short.droneModel ? ` · ${short.droneModel.name}` : ''} · {short.durationSec}s
            </p>
            {short.caption && <p className="mt-1 text-sm">{short.caption}</p>}
            {short.rejectionReason && (
              <p className="mt-1 text-sm text-danger">Reason: {short.rejectionReason}</p>
            )}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {short.status !== 'published' && (
              <Button
                size="sm"
                loading={m.isPending && m.variables?.status === 'published'}
                onClick={() => m.mutate({ status: 'published' })}
              >
                <Check aria-hidden="true" /> Approve &amp; publish
              </Button>
            )}
            {short.status !== 'rejected' && (
              <RejectDialog
                short={short}
                onReject={(reason) =>
                  m
                    .mutateAsync({ status: 'rejected', rejectionReason: reason })
                    .then(() => undefined)
                }
              />
            )}
            {short.status === 'published' && (
              <Switch
                checked={short.isFeatured}
                disabled={m.isPending}
                onCheckedChange={(v) => m.mutate({ isFeatured: v })}
                label="Featured on Home"
              />
            )}
            <ConfirmDialog
              title={`Delete “${short.title}”?`}
              description="Removes the short, its likes and the video file. This can’t be undone."
              onConfirm={async () => {
                try {
                  await adminShorts.remove(short.id);
                  toast.success('Short deleted');
                  void qc.invalidateQueries({ queryKey: ['admin', 'shorts'] });
                } catch (err) {
                  toast.error(toastError(err));
                }
              }}
              trigger={
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${short.title}`}
                  className="ml-auto"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ShortsAdmin() {
  const [tab, setTab] = useState<ShortStatus | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const query = { status: tab === 'all' ? undefined : tab, page, limit: 12 };
  const shorts = useQuery({
    queryKey: shortKeys.admin(query),
    queryFn: () => adminShorts.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <AdminPageHeader
        title="Shorts"
        description="Approve operator uploads, feature shorts on Home, or upload on an operator’s behalf."
        actions={
          <Button onClick={() => setUploading(true)}>
            <Plus aria-hidden="true" /> Upload short
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as ShortStatus | 'all');
          setPage(1);
        }}
      >
        <TabsList aria-label="Filter by status" className="mb-5">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {shorts.isError ? (
        <FormAlert>Couldn’t load shorts.</FormAlert>
      ) : !shorts.data ? (
        <Skeleton className="h-96 rounded-card" />
      ) : shorts.data.data.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-6 py-12 text-center text-muted">
          {tab === 'pending' ? 'Nothing waiting for review.' : 'No shorts here yet.'}
        </p>
      ) : (
        <div
          className={`grid gap-4 xl:grid-cols-2 ${shorts.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          {shorts.data.data.map((s) => (
            <ShortRow key={s.id} short={s} />
          ))}
        </div>
      )}

      {shorts.data && shorts.data.meta.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" /> Previous
          </Button>
          <span className="text-sm text-muted">
            Page {shorts.data.meta.page} of {shorts.data.meta.pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= shorts.data.meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}

      <Modal
        open={uploading}
        onOpenChange={setUploading}
        title="Upload short"
        className="sm:max-w-2xl"
      >
        {uploading && <AdminShortUpload onDone={() => setUploading(false)} />}
      </Modal>
    </>
  );
}
