import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export interface ChipProps extends ComponentProps<'button'> {
  selected?: boolean;
}

/** Toggleable filter/option pill. Uses aria-pressed so screen readers announce state. */
export function Chip({ selected = false, className, type, ...props }: ChipProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-[background-color,color,border-color] duration-[250ms] ease-out [&_svg]:size-4',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-line bg-surface text-ink hover:border-ink/30 hover:bg-sand',
        className,
      )}
      {...props}
    />
  );
}
