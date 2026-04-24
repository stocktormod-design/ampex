import Link from "next/link";

export function CtaBand() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-20">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Klar til å bruke Ampex?
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Kontakt din administrator for en konto, eller opprett firmaet ditt og inviter teamet.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/auth/register"
            className="inline-flex h-11 items-center rounded-lg bg-white px-7 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
          >
            Opprett konto
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center rounded-lg border border-zinc-700 px-7 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Logg inn
          </Link>
        </div>
      </div>
    </section>
  );
}
