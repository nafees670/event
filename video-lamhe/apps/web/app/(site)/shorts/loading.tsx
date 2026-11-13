export default function Loading() {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black" aria-busy="true">
      <span className="sr-only">Loading shorts…</span>
      <div className="aspect-[9/16] h-full max-h-[100dvh] animate-pulse bg-white/5 motion-reduce:animate-none" />
    </div>
  );
}
