'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Field, controlClasses, describedBy } from './field';

export interface TextareaProps extends ComponentProps<'textarea'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export function Textarea({
  id,
  label,
  hint,
  error,
  className,
  containerClassName,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  return (
    <Field id={textareaId} label={label} hint={hint} error={error} className={containerClassName}>
      <textarea
        id={textareaId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(textareaId, hint, error)}
        className={cn(
          controlClasses,
          'h-auto min-h-24 resize-y py-3',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      />
    </Field>
  );
}
