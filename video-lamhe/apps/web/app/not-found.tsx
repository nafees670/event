import Link from 'next/link';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">404</p>
      <h1 className="text-5xl">
        Page not <em className="accent">found</em>
      </h1>
      <p className="text-muted">The page you’re looking for doesn’t exist or was moved.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/operators">Browse operators</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
