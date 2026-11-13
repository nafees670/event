import type { ReactNode } from 'react';

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Scrollable table wrapper + consistent cell styles. */
export function DataTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm [&_tbody_tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted [&_tr]:border-b [&_tr]:border-line">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}

export const toastError = (err: unknown) =>
  err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.';
