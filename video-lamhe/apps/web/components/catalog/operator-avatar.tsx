import Image from 'next/image';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export function OperatorAvatar({
  name,
  photoUrl,
  size = 56,
  className,
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-sand font-serif text-gold-text',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
