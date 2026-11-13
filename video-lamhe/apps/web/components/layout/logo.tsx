import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('font-serif text-xl leading-none text-ink', className)}>
      Video <em className="accent">Lamhe</em>
    </Link>
  );
}
