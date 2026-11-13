'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  hideLabel,
  disabled,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('inline-flex min-h-11 items-center gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50',
          checked ? 'border-primary bg-primary' : 'border-line bg-sand',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-5 rounded-full bg-surface shadow-soft transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
      <label htmlFor={id} className={cn('cursor-pointer text-sm', hideLabel && 'sr-only')}>
        {label}
      </label>
    </div>
  );
}
