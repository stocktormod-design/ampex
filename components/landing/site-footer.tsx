import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-medium text-foreground">Ampex</p>
          <p className="mt-0.5 text-xs">Norske elektrofirma.</p>
        </div>
        <div className="flex gap-6">
          <Link href="/auth/login" className="hover:text-foreground">
            Logg inn
          </Link>
          <Link href="/auth/register" className="hover:text-foreground">
            Registrer
          </Link>
        </div>
      </div>
    </footer>
  );
}
