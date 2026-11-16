import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-sm text-primary">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Page not found</h1>
      <p className="text-sm text-muted">The page you are looking for doesn&apos;t exist.</p>
      <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
        Go to dashboard
      </Link>
    </main>
  );
}
