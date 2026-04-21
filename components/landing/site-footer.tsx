import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-zinc-950 py-12 text-zinc-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-semibold text-white">Ampex</p>
          <p className="mt-1 text-xs">Prosjektstyring for elektro — MVP.</p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <Link href="/auth/login" className="hover:text-white">
            Logg inn
          </Link>
          <Link href="/auth/register" className="hover:text-white">
            Registrer
          </Link>
        </div>
      </div>
    </footer>
  );
}
