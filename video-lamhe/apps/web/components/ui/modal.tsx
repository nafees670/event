'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the modal (rendered via asChild). */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Accessible dialog. Bottom sheet on mobile, centered modal from `sm` up.
 * Focus trap, Esc to close and scroll lock come from Radix.
 */
export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed z-50 flex max-h-[90dvh] w-full flex-col overflow-hidden border border-line bg-surface text-ink shadow-lift focus:outline-none',
            // mobile: bottom sheet
            'inset-x-0 bottom-0 rounded-t-card pb-[env(safe-area-inset-bottom)] data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
            // desktop: centered
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-0 sm:data-[state=closed]:animate-fade-out sm:data-[state=open]:animate-pop-in',
            className,
          )}
        >
          <div
            className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line sm:hidden"
            aria-hidden="true"
          />
          <div className="flex items-start justify-between gap-4 px-6 pt-5 sm:pt-6">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-serif text-2xl leading-tight">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-sand hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children && <div className="overflow-y-auto px-6 py-5">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalClose = Dialog.Close;
