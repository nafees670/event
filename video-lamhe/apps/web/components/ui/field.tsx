import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error wrapper shared by Input and Select. */
export function Field({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses =
  'h-12 w-full rounded-input border bg-surface px-4 text-[15px] text-ink transition-colors duration-200 placeholder:text-muted/70 hover:border-ink/30 focus-visible:border-gold focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(var(--gold)/0.25)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger';

export function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
