import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none [&_svg]:size-3',
  {
    variants: {
      variant: {
        neutral: 'bg-sand text-ink',
        gold: 'bg-gold/15 text-gold-text',
        outline: 'border border-line text-muted',
        success: 'bg-success/12 text-success',
        danger: 'bg-danger/12 text-danger',
        solid: 'bg-primary text-primary-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
