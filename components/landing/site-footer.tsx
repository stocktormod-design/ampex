import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
        <div>
          <span className="text-sm font-semibold text-white">Ampex</span>
          <p className="mt-0.5 text-xs text-zinc-600">Prosjektverktøy for elektrobransjen</p>
        </div>
        <nav className="flex gap-6 text-xs text-zinc-600">
          <Link href="/auth/login" className="transition-colors hover:text-zinc-300">
            Logg inn
          </Link>
          <Link href="/auth/register" className="transition-colors hover:text-zinc-300">
            Registrer
          </Link>
        </nav>
      </div>
    </footer>
  );
}
