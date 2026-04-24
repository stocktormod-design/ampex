import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="text-base font-bold tracking-tight text-white">
          Ampex
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
          >
            Logg inn
          </Link>
          <Link
            href="/auth/register"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
          >
            Kom i gang
          </Link>
        </nav>
      </div>
    </header>
  );
}
