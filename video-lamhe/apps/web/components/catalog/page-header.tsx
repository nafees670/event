import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {eyebrow && (
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
      )}
      <h1 className="text-5xl leading-[1.05] sm:text-6xl">{title}</h1>
      {children && <div className="max-w-2xl text-muted">{children}</div>}
    </header>
  );
}
