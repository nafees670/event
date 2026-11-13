'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import type { ThemePreference } from '@video-lamhe/shared';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

const noopSubscribe = () => () => {};
/** true only after hydration, so we never render a theme-dependent value on the server. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

interface ThemeToggleProps {
  className?: string;
  /** Called after the user picks a theme (e.g. to persist on User.themePreference). */
  onChange?: (theme: ThemePreference) => void;
}

export function ThemeToggle({ className, onChange }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Change theme"
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand',
          className,
        )}
      >
        {/* Pure CSS swap — correct on first paint, no hydration mismatch. */}
        <Sun className="size-5 dark:hidden" aria-hidden="true" />
        <Moon className="hidden size-5 dark:block" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-40 rounded-media border border-line bg-surface p-1.5 text-ink shadow-lift outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:animate-fade-in"
        >
          <DropdownMenu.RadioGroup
            value={hydrated ? theme : undefined}
            onValueChange={(v) => {
              setTheme(v);
              onChange?.(v as ThemePreference);
            }}
          >
            {OPTIONS.map(({ value, label, Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex h-11 cursor-pointer select-none items-center gap-3 rounded-input px-3 text-sm outline-none data-[highlighted]:bg-sand"
              >
                <Icon className="size-4 text-muted" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4 text-gold-text" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
